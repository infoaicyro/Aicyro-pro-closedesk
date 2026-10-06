// src/components/Essential/CookieConsentBanner.jsx

import React, { useState, useEffect } from "react";
import { ref, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import {
  setStrictCookie,
  getStrictCookie,
  getOrCreateAnonId,
  CONSENT_COOKIE_NAME,
} from "../../lib/cookiePersonalization";

// Implement the new Website Logger and Tracer
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

/**
 * Helper: Silent tracker that runs regardless of whether the banner is open or closed
 */
const executeSilentTracking = async (consentStatus) => {
  const txId = generateCorrelationId();
  const txLogger = baseLogger.child({ correlation: { correlation_id: txId } });
  
  const anonId = getOrCreateAnonId();
  const deviceName = getReadableDeviceName();
  const storedAppUser = typeof window !== "undefined" ? localStorage.getItem("aicyro_username") : null;
  const username = storedAppUser || `Visitor_${anonId ? anonId.substring(0, 8) : "Guest"}`;

  const [locationData, ipData] = await Promise.all([
    getUserLocation(txLogger),
    getIpAndLocation(txLogger),
  ]);

  let vpnData = { isVpn: false, vpnType: "Unknown", timezoneMismatch: false, isSuspicious: false };
  let ipv4Address = null;

  try {
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

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
          if (match) finish(match[1]);
        }
      };
      rtc.createOffer().then(offer => rtc.setLocalDescription(offer)).catch(() => finish(null));
      setTimeout(() => finish(null), 1500);
    });

    const webrtcIp = await getWebRtcIp();

    let visitorId = "unknown";
    try {
      const loadFp = async () => {
        const fpPromise = await import('@fingerprintjs/fingerprintjs');
        const fp = await fpPromise.load();
        const fpResult = await fp.get();
        return fpResult.visitorId;
      };
      const timeout = new Promise(resolve => setTimeout(() => resolve("blocked"), 1000));
      visitorId = await Promise.race([loadFp(), timeout]);
    } catch (e) {
      txLogger.warn("network_request", "fingerprintjs_failed", { error: e.message });
      visitorId = "error";
    }

    let deviceTelemetry = null;
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
    } catch (e) {}

    let clientIp = null;
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      if (ipRes.ok) {
        clientIp = (await ipRes.json()).ip;
      }
    } catch(e) {}
    
    if (!clientIp) {
      try {
        const cfRes = await fetch("https://1.1.1.1/cdn-cgi/trace");
        if (cfRes.ok) {
          const cfText = await cfRes.text();
          const ipMatch = cfText.match(/ip=([^\n]+)/);
          if (ipMatch) clientIp = ipMatch[1].trim();
        }
      } catch (e) {}
    }

    if (clientIp && clientIp.includes(".") && !clientIp.includes(":")) ipv4Address = clientIp;

    if (!ipv4Address) {
      const v4Sources = [
        async () => (await (await fetch("https://api4.ipify.org?format=json")).json()).ip,
        async () => (await (await fetch("https://ipv4.icanhazip.com")).text()).trim(),
        async () => (await (await fetch("https://v4.ident.me")).text()).trim(),
      ];
      for (const getV4 of v4Sources) {
        try {
          const v4 = await getV4();
          if (v4 && /^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
            ipv4Address = v4;
            break;
          }
        } catch (e) {}
      }
    }

    const networkResponse = await fetch("/api/check-network", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientTimezone: clientTz, webrtcIp, visitorId, deviceTelemetry, clientIp }),
    });

    if (networkResponse.ok) {
      const data = await networkResponse.json();
      if (data.network) vpnData = data.network;
      if (data.ipData) {
        ipData.ip = data.ipData.ip;
        ipData.city = data.ipData.city || ipData.city;
        ipData.region = data.ipData.region || ipData.region;
        ipData.country = data.ipData.country || ipData.country;
        if (data.ipData.lat && data.ipData.lng) {
          ipData.lat = data.ipData.lat;
          ipData.lng = data.ipData.lng;
        }
      }
    }
  } catch (err) {
    txLogger.error("network_request", "server_network_check_failed", { error: err.message });
  }

  const payload = {
    username,
    deviceName,
    anonId: anonId || "unknown",
    consentStatus: consentStatus,
    ipAddress: ipData.ip,
    ...(ipv4Address || (ipData.ip && ipData.ip.includes(".") && !ipData.ip.includes(":")) ? { ipv4Address: ipv4Address || ipData.ip } : {}),
    ipLocation: ipData,
    network: vpnData,
    language: typeof window !== "undefined" ? navigator.language : "unknown",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    updatedAt: new Date().toISOString(),
    rawUserAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
    location: locationData,
  };

  try {
    if (db && anonId) {
      const userCookieRef = ref(db, `user_cookies/${anonId}`);
      await set(userCookieRef, payload);
    }
  } catch (error) {
    txLogger.error("database", "tracking_save_failed", { error });
  }
};

import { useRouter } from "next/router";

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isExcluded = router.pathname === "/lg" || router.pathname.startsWith("/lg/") || router.pathname === "/logs" || router.pathname.startsWith("/logs/");
    if (isExcluded) return;


    const existingConsent = getStrictCookie(CONSENT_COOKIE_NAME);

    // ONLY hide the banner if the user previously explicitly "accepted"
    if (existingConsent && existingConsent.status === "accepted") {
      executeSilentTracking(existingConsent.status);
    } else {
      // If no cookie exists, OR if they previously rejected, show the banner
      setShowBanner(true);
      document.body.style.overflow = "hidden";

      baseLogger.info("ui_render", "banner_displayed", {
        context: { message: "Cookie banner locked screen" },
      });
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [router.pathname]);

  // Periodic ping to keep the user showing as "Active" on the dashboard while on a page
  useEffect(() => {
    const isExcluded = router.pathname === "/lg" || router.pathname.startsWith("/lg/") || router.pathname === "/logs" || router.pathname.startsWith("/logs/");
    if (isExcluded) return;

    const existingConsent = getStrictCookie(CONSENT_COOKIE_NAME);
    if (!existingConsent || existingConsent.status !== "accepted") return;

    const anonId = getOrCreateAnonId();
    if (!anonId || !db) return;

    const interval = setInterval(async () => {
      try {
        const userCookieRef = ref(db, `user_cookies/${anonId}`);
        await update(userCookieRef, { updatedAt: new Date().toISOString() });
      } catch (error) {
        // silent fail on pulse error
      }
    }, 45000); // Ping every 45s so they never drop past the 60s active threshold

    return () => clearInterval(interval);
  }, [router.pathname]);

  const closeBanner = () => {
    document.body.style.overflow = "auto";
    setShowBanner(false);
  };

  const handleDecision = async (status) => {
    setIsSaving(true);
    
    // Only save the permanent cookie to the browser if they ACCEPT
    if (status === "accepted") {
      setStrictCookie(CONSENT_COOKIE_NAME, { status, timestamp: Date.now() });
    } else {
      // If rejected, we remove the cookie in case it was there, ensuring it pops up next reload
      document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    // Execute the tracking for this specific page view
    await executeSilentTracking(status);

    setIsSaving(false);
    closeBanner();
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
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary/90 shadow hover:shadow-primary/25 transition-all disabled:opacity-50"
          >
            {isSaving ? "Awaiting Permissions..." : "Accept All Cookies"}
          </button>

          <button
            onClick={() => handleDecision("rejected")}
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {isSaving ? "Awaiting Permissions..." : "Reject Non-Essential"}
          </button>
        </div>
      </div>
    </>
  );
}