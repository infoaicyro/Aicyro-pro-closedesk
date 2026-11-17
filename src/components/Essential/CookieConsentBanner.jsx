// src/components/Essential/CookieConsentBanner.jsx
// Merged: New UI banner design + Latest Code tracking (dual IP providers, GPS with network fallback, API plus direct RTDB sync).
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { ref, set } from "firebase/database";
import { db } from "../../lib/firebase";
import {
  setStrictCookie,
  getStrictCookie,
  getOrCreateAnonId,
  CONSENT_COOKIE_NAME,
  ANON_ID_COOKIE,
} from "../../lib/cookiePersonalization";

// Implement the Website Logger and Tracer
import { createWebsiteLogger } from "../../lib/loggerPresets";
import { generateCorrelationId } from "../../lib/tracer";
import { isInternalPath } from "../../lib/routeScopes";

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
 * Features dual-provider fallback (ipinfo.io -> freeipapi.com) with timeout protection.
 */
const getIpAndLocation = async (txLogger = baseLogger) => {
  // Provider 1: ipinfo.io
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller && controller.abort(), 4000);
    const response = await fetch("https://ipinfo.io/json", {
      signal: controller ? controller.signal : undefined,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      let lat = null,
        lng = null;

      if (data.loc) {
        const [parsedLat, parsedLng] = data.loc.split(",");
        lat = parseFloat(parsedLat);
        lng = parseFloat(parsedLng);
      }

      if (data.ip) {
        return {
          ip: data.ip || "unknown",
          city: data.city || "Unknown",
          region: data.region || "Unknown",
          country: data.country || "Unknown",
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
        };
      }
    }
  } catch (error) {
    txLogger.warn("network_request", "ipinfo_fetch_failed", { error: error?.message });
  }

  // Provider 2: freeipapi.com (reliable free CORS fallback)
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller && controller.abort(), 4000);
    const response = await fetch("https://freeipapi.com/api/json", {
      signal: controller ? controller.signal : undefined,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const fallback = await response.json();
      return {
        ip: fallback.ipAddress || "unknown",
        city: fallback.cityName || "Unknown",
        region: fallback.regionName || "Unknown",
        country: fallback.countryName || "Unknown",
        lat: fallback.latitude ? parseFloat(fallback.latitude) : null,
        lng: fallback.longitude ? parseFloat(fallback.longitude) : null,
      };
    }
  } catch (error) {
    txLogger.warn("network_request", "freeipapi_fetch_failed", { error: error?.message });
  }

  return {
    ip: "unknown",
    city: "Unknown",
    region: "Unknown",
    country: "Unknown",
    lat: null,
    lng: null,
  };
};

/**
 * Helper: Requests the user's location via the browser's Geolocation API.
 * High-Accuracy First with Progressive Fallback:
 * 1. Tries High-Accuracy GPS first (enableHighAccuracy: true, timeout: 7000ms, maximumAge: 0).
 * 2. On TIMEOUT or POSITION_UNAVAILABLE, immediately falls back to low-accuracy network triangulation.
 * 3. Captures latitude, longitude, and accuracy radius (meters).
 */
const getUserLocation = (txLogger = baseLogger) => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve({ status: "unsupported", source: "unsupported", lat: null, lng: null, accuracy: null });
      return;
    }

    const highAccuracyOptions = {
      enableHighAccuracy: true, // Forces exact hardware GPS fix
      timeout: 7000,           // 7 seconds GPS lock timeout
      maximumAge: 0,           // Force fresh fix, no stale cached coords
    };

    const fallbackOptions = {
      enableHighAccuracy: false, // Network/Wi-Fi triangulation fallback
      timeout: 5000,
      maximumAge: 60000,        // 1-minute acceptable cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "allowed",
          source: "gps_exact",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (firstError) => {
        // If user explicitly denied permission (code 1 = PERMISSION_DENIED), do not retry
        if (firstError && firstError.code === 1) {
          txLogger.debug("user_action", "geolocation_permission_denied", {
            error_code: firstError.code,
            message: firstError.message,
          });
          resolve({
            status: "rejected",
            source: "denied",
            error: firstError.message,
            lat: null,
            lng: null,
            accuracy: null,
          });
          return;
        }

        // On code 2 (POSITION_UNAVAILABLE) or 3 (TIMEOUT), fallback to network triangulation
        txLogger.warn("geolocation", "high_accuracy_failed_attempting_fallback", {
          error_code: firstError?.code,
          message: firstError?.message,
        });

        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            resolve({
              status: "allowed",
              source: "network_triangulation",
              lat: fallbackPos.coords.latitude,
              lng: fallbackPos.coords.longitude,
              accuracy: fallbackPos.coords.accuracy,
            });
          },
          (secondError) => {
            txLogger.warn("geolocation", "all_browser_geolocation_failed", {
              error_code: secondError?.code,
              message: secondError?.message,
            });
            resolve({
              status: secondError && secondError.code === 1 ? "rejected" : "unavailable",
              source: "unavailable",
              error: secondError?.message || firstError?.message || "Geolocation unavailable",
              lat: null,
              lng: null,
              accuracy: null,
            });
          },
          fallbackOptions
        );
      },
      highAccuracyOptions
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
  const storedAppUser =
    typeof window !== "undefined" ? localStorage.getItem("aicyro_username") : null;
  const username = storedAppUser || `Visitor_${anonId ? anonId.substring(0, 8) : "Guest"}`;

  // Only request device geolocation if user consented; never prompt on rejected
  let locationData = { status: "rejected", source: "denied", lat: null, lng: null, accuracy: null };
  let ipData = { ip: "unknown", city: "Unknown", region: "Unknown", country: "Unknown", lat: null, lng: null };

  if (consentStatus === "accepted") {
    [locationData, ipData] = await Promise.all([
      getUserLocation(txLogger),
      getIpAndLocation(txLogger),
    ]);
  } else {
    ipData = await getIpAndLocation(txLogger);
  }

  const hasGps = locationData.lat != null && !isNaN(Number(locationData.lat));
  const hasIp = ipData.lat != null && !isNaN(Number(ipData.lat));

  const effectiveLat = hasGps
    ? Number(locationData.lat)
    : consentStatus === "accepted" && hasIp
    ? Number(ipData.lat)
    : null;

  const effectiveLng = hasGps
    ? Number(locationData.lng)
    : consentStatus === "accepted" && hasIp
    ? Number(ipData.lng)
    : null;

  const effectiveStatus = hasGps
    ? "allowed"
    : consentStatus === "accepted" && (locationData.status === "allowed" || hasIp)
    ? "allowed"
    : locationData.status || (consentStatus === "accepted" ? "allowed" : "rejected");

  const activeTenant =
    typeof window !== "undefined" ? (localStorage.getItem("currentTenant") || "default") : "default";

  const payload = {
    username,
    deviceName,
    anonId: anonId || "unknown",
    consentStatus: consentStatus,
    ipAddress: ipData.ip,
    ipLocation: ipData,
    language: typeof window !== "undefined" ? navigator.language : "unknown",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    updatedAt: new Date().toISOString(),
    rawUserAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
    location: {
      status: effectiveStatus,
      lat: effectiveLat,
      lng: effectiveLng,
      exactLat: hasGps ? Number(locationData.lat) : null,
      exactLng: hasGps ? Number(locationData.lng) : null,
      accuracy: locationData.accuracy || null,
      source: hasGps
        ? locationData.source
        : hasIp && consentStatus === "accepted"
        ? "ip_fallback"
        : "rejected",
    },
    tenant_id: activeTenant,
  };

  try {
    // 1. Ingest via API route for server sanitization, logging, and tenant partitioning
    const response = await fetch("/api/cookie-consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(activeTenant && activeTenant !== "default" ? { "x-tenant-id": activeTenant } : {}),
      },
      body: JSON.stringify(payload),
    }).catch((fetchErr) => {
      txLogger.warn("network_request", "cookie_consent_api_failed", { error: fetchErr?.message });
      return null;
    });

    // The server merges a re-issued visitor ID into this device's existing record;
    // adopt that ID so this browser keeps updating one entry from now on.
    const result = response ? await response.json().catch(() => null) : null;
    let recordId = anonId;
    if (result && result.anonId && result.anonId !== anonId) {
      recordId = result.anonId;
      setStrictCookie(ANON_ID_COOKIE, recordId, 30);
    }

    // 2. Direct client RTDB sync for real-time reactivity (written to the resolved record)
    if (db && recordId) {
      const syncedPayload = { ...payload, id: recordId, anonId: recordId };
      await set(ref(db, "user_cookies/" + recordId), syncedPayload);
      if (activeTenant && activeTenant !== "default") {
        await set(ref(db, "tenants/" + activeTenant + "/user_cookies/" + recordId), syncedPayload);
      }
    }
  } catch (error) {
    txLogger.error("database", "tracking_save_failed", { error });
  }
};

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Never ask for cookies or run visitor tracking on operator/engine routes
    if (isInternalPath(window.location.pathname)) return;

    const existingConsent = getStrictCookie(CONSENT_COOKIE_NAME);

    // Accepted: track as before. Rejected: remember the choice and stay quiet.
    if (existingConsent && existingConsent.status === "accepted") {
      executeSilentTracking(existingConsent.status);
    } else if (existingConsent && existingConsent.status === "rejected") {
      // The visitor already said no; do not ask again on every page load.
    } else {
      // No decision yet: show the banner
      setShowBanner(true);
      document.body.style.overflow = "hidden";

      baseLogger.info("ui_render", "banner_displayed", {
        context: { message: "Cookie banner locked screen" },
      });
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const closeBanner = () => {
    // Clear the inline lock so the stylesheet (overflow-x: clip) applies again
    document.body.style.overflow = "";
    setShowBanner(false);
  };

  const handleDecision = async (status) => {
    setIsSaving(true);

    // Save the decision either way, so a visitor who rejects is not asked again
    setStrictCookie(CONSENT_COOKIE_NAME, { status, timestamp: Date.now() });

    // Execute the tracking for this specific page view
    await executeSilentTracking(status);

    setIsSaving(false);
    closeBanner();
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <>
          {/* Background Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-[var(--background)]/80 backdrop-blur-sm select-none"
            aria-hidden="true"
          />

          {/* Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed top-4 left-4 right-4 md:right-auto md:w-[360px] z-[9999] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-md p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex w-9 h-9 bg-[var(--primary)]/15 text-[var(--primary)] items-center justify-center rounded-full shrink-0">
                <Lock size={16} aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)] leading-none">
                Cookie &amp; Location Policy
              </h2>
            </div>

            <p className="text-sm text-[var(--foreground-muted)] mb-5 leading-relaxed">
              We use essential browser cookies and log basic device metrics
              (including an optional location request) to secure our platform.
              Please accept or reject to unlock the website.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleDecision("accepted")}
                disabled={isSaving}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-sm text-[var(--foreground)] bg-[var(--card-bg)] hover:bg-[var(--background)] border border-[var(--border-color)] hover:border-[var(--foreground-muted)] transition-colors duration-150 motion-safe:active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer"
              >
                {isSaving ? "Awaiting Permissions…" : "Accept All Cookies"}
              </button>

              <button
                onClick={() => handleDecision("rejected")}
                disabled={isSaving}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-sm text-[var(--foreground)] bg-[var(--card-bg)] hover:bg-[var(--background)] border border-[var(--border-color)] hover:border-[var(--foreground-muted)] transition-colors duration-150 motion-safe:active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer"
              >
                {isSaving ? "Awaiting Permissions…" : "Reject Non-Essential"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
