// src/components/Essential/CookieConsentBanner.jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ref, set, update, get } from "firebase/database";
import { db } from "../../lib/firebase";
import {
  setStrictCookie,
  getStrictCookie,
  getOrCreateAnonId,
  CONSENT_COOKIE_NAME,
} from "../../lib/cookiePersonalization";

import { createWebsiteLogger } from "../../lib/loggerPresets";
import { generateCorrelationId } from "../../lib/tracer";

const baseLogger = createWebsiteLogger("CookieConsentBanner");

/**
 * Helper: Parses the browser environment into a clean, readable Device Name
 */
function getReadableDeviceName() {
  if (typeof window === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  let type = "Desktop";

  if (/Windows/i.test(ua)) os = "Windows PC";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Macintosh";
  else if (/Android/i.test(ua)) {
    os = "Android";
    type = "Mobile";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS Device";
    type = "Mobile";
  } else if (/Linux/i.test(ua)) os = "Linux";

  if (/Tablet|iPad/i.test(ua)) type = "Tablet";

  return `${os} (${type})`;
}

/**
 * Helper: Fetches the user's public IPv4 address AND location based on that IP.
 */
const getIpAndLocation = async (txLogger = baseLogger) => {
  try {
    const response = await fetch("https://ipinfo.io/json");
    const data = await response.json();
    let lat = null,
      lng = null;

    if (data.loc) {
      const [parsedLat, parsedLng] = data.loc.split(",");
      lat = parseFloat(parsedLat);
      lng = parseFloat(parsedLng);
    }

    return {
      ip: data.ip || "unknown",
      city: data.city || "Unknown",
      region: data.region || "Unknown",
      country: data.country || "Unknown",
      timezone: data.timezone || "Unknown",
      lat,
      lng,
    };
  } catch (error) {
    txLogger.warn("network_request", "ip_fetch_failed", { error });
    return {
      ip: "unknown",
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      lat: null,
      lng: null,
    };
  }
};

/**
 * Helper: Requests the user's location via the browser's Geolocation API.
 */
const getUserLocation = (txLogger = baseLogger) => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve({ status: "unsupported", lat: null, lng: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "allowed",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        txLogger.debug("user_action", "geolocation_denied", {
          error,
          context: { error_message: error.message },
        });
        resolve({
          status: "rejected",
          error: error.message,
          lat: null,
          lng: null,
        });
      },
      { timeout: 8000 },
    );
  });
};

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname.replace(/\/+/g, "/") : "";
    const isDashboard = currentPath === "/lg" || currentPath.startsWith("/lg/");
    const isPulse = currentPath === "/pulse" || currentPath.startsWith("/pulse/") || currentPath === "/logs" || currentPath.startsWith("/logs/");

    if (isDashboard || isPulse) {
      return; // Exclude Admin/Dashboard/Pulse routes entirely from tracking
    }

    const existingConsent = getStrictCookie(CONSENT_COOKIE_NAME);
    
    let adminHeartbeat;
    
    // We need to verify if their database record still exists (in case they manually deleted it while testing)
    const verifyDatabaseRecord = async () => {
      let recordExists = true;
      if (existingConsent) {
        const anonId = getOrCreateAnonId();
        if (anonId && db) {
          try {
            const { ref, get } = await import("firebase/database");
            const snapshot = await get(ref(db, `user_cookies/${anonId}`));
            recordExists = snapshot.exists() && snapshot.val().consentStatus;
          } catch (e) {
            // ignore network errors, assume it exists to prevent spamming
          }
        }
      }

      // If they already accepted AND the database record is safe, do nothing
      if (existingConsent && recordExists) {
        return;
      }

      // Auto-track the visitor silently in the background before they even click accept
      handleDecision("pending", false, true);

      // Always show the banner when a NEW user lands on the page (or their DB record was wiped)
      setShowBanner(true);
      document.body.style.overflow = "hidden";
      
      baseLogger.info("ui_render", "banner_displayed", {
        context: { message: "Cookie banner locked screen" },
      });
    };

    verifyDatabaseRecord();

    // Cleanup function
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [router.pathname]);

  // Visitor Active Time Heartbeat
  useEffect(() => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname.replace(/\/+/g, "/") : "";
    if (currentPath === "/lg" || currentPath.startsWith("/lg/")) return;
    if (currentPath === "/pulse" || currentPath.startsWith("/pulse/") || currentPath === "/logs" || currentPath.startsWith("/logs/")) return;

    const visitorHeartbeat = setInterval(async () => {
      const anonId = getOrCreateAnonId();
      if (anonId && db) {
        try {
          const { ref, update } = await import("firebase/database");
          await update(ref(db, `user_cookies/${anonId}`), {
            updatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
    }, 30000);

    return () => clearInterval(visitorHeartbeat);
  }, []);



  function closeBanner() {
    document.body.style.overflow = "auto";
    setShowBanner(false);
  };

  function handleDecision(status, isSilentAdmin = false, keepBannerOpen = false) {
    // Instantly close the banner so the user is not blocked
    if (!isSilentAdmin && !keepBannerOpen) {
      closeBanner();
    }

    // Perform data gathering and DB write in the background
    (async () => {
      // 1. START TRANSACTION: Generate one correlation ID for this entire decision flow
      const txId = generateCorrelationId();

      // 2. Spawn a transaction-scoped logger. It inherits the session_id from presets,
      // and binds this correlation_id to ALL logs created using `txLogger`.
      const txLogger = baseLogger.child({
        correlation: { correlation_id: txId },
      });

      const endTimer = txLogger.startTimer();
      const anonId = getOrCreateAnonId();

      setStrictCookie(CONSENT_COOKIE_NAME, { status, timestamp: Date.now() });

      const deviceName = getReadableDeviceName();
      const username = `Visitor_${anonId ? anonId.substring(0, 8) : "Guest"}`;

      // If silent admin, we skip the native GPS prompt so we don't annoy them,
      // but we still fetch their IP-based location so they appear on the map!
      let locationData;
      if (isSilentAdmin) {
        const ipLoc = await getIpAndLocation(txLogger);
        locationData = {
          status: "allowed", // Spoofed as allowed so it renders on the map
          lat: ipLoc.lat,
          lng: ipLoc.lng,
        };
      } else {
        locationData = await getUserLocation(txLogger);
      }

      // Offload Network Analysis (IP extraction + VPN detection) to the secure server backend
      let vpnData = { isVpn: false, vpnType: "Unknown", timezoneMismatch: false, isSuspicious: false };
      let ipData = { ip: "unknown", city: "Unknown", region: "Unknown", country: "Unknown", lat: null, lng: null };
      let deviceTelemetry = null;
      
      try {
        // 1. WebRTC Leak Detection
        const getWebRtcIp = () => new Promise((resolve) => {
          const rtc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
          rtc.createDataChannel("");
          
          let resolved = false;
          const finish = (ip) => {
            if (resolved) return;
            resolved = true;
            rtc.close();
            resolve(ip);
          };

          rtc.onicecandidate = (evt) => {
            if (evt.candidate && evt.candidate.candidate) {
              const match = evt.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
              if (match) {
                // Return the first IP found (server-reflexive IP from STUN)
                finish(match[1]);
              }
            }
          };
          
          rtc.createOffer().then(offer => rtc.setLocalDescription(offer)).catch(() => finish(null));
          
          // Timeout after 1500ms to prevent race conditions as requested
          setTimeout(() => finish(null), 1500);
        });

        const webrtcIp = await getWebRtcIp();
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        // 2. Identity Persistence (FingerprintJS) with Adblocker Resilience
        let visitorId = "unknown";
        try {
          const loadFp = async () => {
            const fpPromise = await import('@fingerprintjs/fingerprintjs');
            const fp = await fpPromise.load();
            const fpResult = await fp.get();
            return fpResult.visitorId;
          };
          
          // Timeout after 1000ms. Adblockers can indefinitely block the script from executing.
          const timeout = new Promise(resolve => setTimeout(() => resolve("blocked"), 1000));
          visitorId = await Promise.race([loadFp(), timeout]);
        } catch (e) {
          txLogger.warn("network_request", "fingerprintjs_failed", { error: e.message });
          visitorId = "error";
        }

        try {
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
          if (gl) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
              deviceTelemetry = {
                gpuVendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                gpuRenderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
              };
            }
          }
        } catch (e) {
          // ignore webgl extraction errors
        }

        // 3. Force IPv4 fetch to catch browser VPN extensions (IPv6 leak bypassing)
        let clientIp = null;
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            clientIp = ipData.ip;
          }
        } catch(e) {}

        const networkResponse = await fetch("/api/check-network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientTimezone: clientTz, webrtcIp, visitorId, deviceTelemetry, clientIp }),
        });
        if (networkResponse.ok) {
          const data = await networkResponse.json();
          if (data.network) vpnData = data.network;
          if (data.ipData) ipData = data.ipData;
        }
      } catch (err) {
        txLogger.error("network_request", "server_network_check_failed", { error: err.message });
      }

      const payload = {
        username,
        deviceName,
        anonId: anonId || "unknown",
        consentStatus: status,
        ipAddress: ipData.ip,
        ipLocation: ipData,
        network: vpnData,
        language: typeof window !== "undefined" ? navigator.language : "unknown",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        updatedAt: new Date().toISOString(),
        rawUserAgent:
          typeof window !== "undefined" ? navigator.userAgent : "unknown",
        location: locationData,
        deviceTelemetry: deviceTelemetry
      };

      try {
        if (!db) {
          txLogger.warn("database", "firebase_uninitialized");
        } else if (anonId) {
          const userCookieRef = ref(db, `user_cookies/${anonId}`);
          // Fire-and-forget to prevent UI blocking
          set(userCookieRef, payload).catch((error) => {
            txLogger.error("database", "consent_save_failed", { error });
          });

          txLogger.info("user_action", "consent_saved", {
            context: { user_id: username, message: `User ${status} consent` },
            duration_ms: endTimer(),
          });
        }
      } catch (error) {
        txLogger.error("database", "consent_logic_failed", { error });
      }
    })();
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Background Overlay */}
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm select-none" />

      {/* Banner */}
      <div className="fixed top-4 left-4 right-4 md:right-auto md:w-[340px] z-[9999] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-top-5 slide-in-from-left-5 duration-300">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex w-8 h-8 bg-primary/10 text-primary items-center justify-center rounded-full text-sm shrink-0">
            🔒
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-none">
            Cookie & Location Policy
          </h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
          We use essential browser cookies and log basic device metrics
          (including an optional location request) to secure our platform.
          Please accept or reject to unlock the website.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleDecision("accepted")}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary/90 shadow hover:shadow-primary/25 transition-all"
          >
            Accept All Cookies
          </button>

          <button
            onClick={() => handleDecision("rejected")}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
          >
            Reject Non-Essential
          </button>
        </div>
      </div>
    </>
  );
}
