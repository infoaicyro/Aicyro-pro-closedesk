// src/pages/api/cookie-consent.js
import { ref, query, orderByChild, equalTo } from "firebase/database";
import { safeDbGet, safeDbSet } from "../../lib/safeDb";
import { withApiLogger } from "../../lib/apiMiddleware";
import { db } from "../../lib/firebase";
import { resolveTenantId } from "../../lib/tenantResolver";
import { sanitizeFirebaseKey, sanitizeUntrustedTelemetry } from "../../lib/sanitizer";
import { validateRequestBodySize } from "../../lib/publicEndpointGuard";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16kb',
    },
  },
};

// Helper: Safely deep-sanitize objects to ensure NO property contains `undefined`
// which causes Firebase Realtime Database set() to throw fatal errors
function sanitizeForFirebase(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => (value === undefined ? null : value))
  );
}

/**
 * Finds the record this device should keep using.
 * Returns null when the visitor's own record should be written (it already exists
 * or no other active record matches), or { id, username } of the existing active
 * record with the same public IP and identical user agent (newest wins).
 */
async function findSameDeviceRecord(basePath, ownId, clientIp, userAgent, apiLogger) {
  if (!clientIp || clientIp === "unknown" || !userAgent || userAgent === "unknown") return null;

  try {
    let snap;
    try {
      // Fast path: needs ".indexOn": "ipAddress" (see database.rules.json).
      snap = await safeDbGet(
        query(ref(db, basePath), orderByChild("ipAddress"), equalTo(clientIp)),
        2500
      );
    } catch (err) {
      if (!/index not defined/i.test(String(err && err.message))) throw err;
      // Deployed rules lack the index: scan the partition instead.
      snap = await safeDbGet(ref(db, basePath), 2500);
    }
    if (!snap || !snap.exists()) return null;

    const candidates = Object.entries(snap.val()).filter(
      ([, rec]) =>
        rec &&
        rec.ipAddress === clientIp &&
        rec.rawUserAgent === userAgent &&
        !rec.isArchived
    );

    // This browser already has its own active record: keep writing to it.
    if (candidates.some(([key]) => key === ownId)) return null;
    if (!candidates.length) return null;

    candidates.sort(([, a], [, b]) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const [id, rec] = candidates[0];
    return { id, username: rec.username || null };
  } catch (err) {
    // Lookup failure must never block consent recording; fall back to a new record.
    apiLogger.warn("database", "same_device_lookup_failed", { error: err });
    return null;
  }
}

async function handler(req, res, apiLogger) {
  // CORS Headers for cross-domain SDK embed requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-tenant-id, x-correlation-id, x-session-id"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  // 1. Enforce 16KB body size cap (returns 413)
  if (!validateRequestBodySize(req, res, 16384)) return;

  try {
    // Robust body parsing: handle objects, raw JSON strings, and buffers
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = {};
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf8"));
      } catch (_) {
        body = {};
      }
    }

    if (!body || typeof body !== "object") {
      body = {};
    }
    body = sanitizeUntrustedTelemetry(body);

    const {
      anonId,
      username,
      deviceName,
      consentStatus = "accepted",
      ipAddress,
      ipLocation = {},
      location = {},
      language,
      timeZone,
      rawUserAgent,
      hostUrl = "",
      pagePath = "",
      tenant_id,
    } = body;

    const safeAnonId = sanitizeFirebaseKey(anonId, "visitor");
    if (!anonId || !safeAnonId) {
      return res.status(400).json({ error: "Valid anonId is required" });
    }

    const tenantId = resolveTenantId(req) || tenant_id || "default";
    const timestamp = new Date().toISOString();

    // Fallback IP extraction from server headers if client didn't supply it
    const clientIp =
      ipAddress && ipAddress !== "unknown"
        ? ipAddress
        : (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
            .split(",")[0]
            .trim();

    // Parse numeric coordinates safely for Google Maps markers and exact GPS auditing
    const ipLat =
      ipLocation && ipLocation.lat != null && !isNaN(Number(ipLocation.lat))
        ? Number(ipLocation.lat)
        : null;
    const ipLng =
      ipLocation && ipLocation.lng != null && !isNaN(Number(ipLocation.lng))
        ? Number(ipLocation.lng)
        : null;

    const exactLat =
      location && location.exactLat != null && !isNaN(Number(location.exactLat))
        ? Number(location.exactLat)
        : location && location.source === "gps_exact" && location.lat != null && !isNaN(Number(location.lat))
        ? Number(location.lat)
        : null;

    const exactLng =
      location && location.exactLng != null && !isNaN(Number(location.exactLng))
        ? Number(location.exactLng)
        : location && location.source === "gps_exact" && location.lng != null && !isNaN(Number(location.lng))
        ? Number(location.lng)
        : null;

    // Effective display coordinates (exact GPS if available, else IP fallback when accepted)
    const displayLat =
      exactLat != null
        ? exactLat
        : location && location.lat != null && !isNaN(Number(location.lat))
        ? Number(location.lat)
        : consentStatus === "accepted" && ipLat != null
        ? ipLat
        : null;

    const displayLng =
      exactLng != null
        ? exactLng
        : location && location.lng != null && !isNaN(Number(location.lng))
        ? Number(location.lng)
        : consentStatus === "accepted" && ipLng != null
        ? ipLng
        : null;

    const locationStatus =
      exactLat != null
        ? "allowed"
        : location && location.status === "allowed"
        ? "allowed"
        : consentStatus === "accepted" && displayLat != null
        ? "allowed"
        : location && location.status
        ? location.status
        : "rejected";

    const locationSource =
      exactLat != null
        ? (location && location.source) || "gps_exact"
        : location && location.source
        ? location.source
        : displayLat != null && displayLat === ipLat
        ? "ip_fallback"
        : "unknown";

    const userAgent = String(rawUserAgent || req.headers["user-agent"] || "unknown").substring(0, 255);
    // Every record lands in the global partition (read by the /lg dashboard), so the
    // same-device lookup runs there.
    // One device = one entry: if this visitor ID is new but the same device
    // (same public IP + identical browser user agent) already has an active
    // record, update that record instead of creating a duplicate location entry.
    const deviceMatch = await findSameDeviceRecord("user_cookies", safeAnonId, clientIp, userAgent, apiLogger);
    const recordId = deviceMatch ? deviceMatch.id : String(safeAnonId);

    const payload = sanitizeForFirebase({
      id: recordId,
      anonId: recordId,
      username: String(
        (deviceMatch && deviceMatch.username) ||
          username ||
          `Visitor_${recordId.substring(4, 12)}`
      ).substring(0, 50),
      deviceName: String(deviceName || "Unknown Device").substring(0, 60),
      consentStatus: String(consentStatus).substring(0, 20),
      ipAddress: clientIp,
      ipLocation: {
        ip: clientIp,
        city: (ipLocation && ipLocation.city) || "Unknown",
        region: (ipLocation && ipLocation.region) || "Unknown",
        country: (ipLocation && ipLocation.country) || "Unknown",
        lat: ipLat,
        lng: ipLng,
      },
      location: {
        status: locationStatus,
        lat: displayLat,
        lng: displayLng,
        exactLat: exactLat,
        exactLng: exactLng,
        accuracy:
          location && location.accuracy != null && !isNaN(Number(location.accuracy))
            ? Number(location.accuracy)
            : null,
        source: locationSource,
      },
      language: String(language || "en-US").substring(0, 20),
      timeZone: String(timeZone || "UTC").substring(0, 40),
      rawUserAgent: userAgent,
      hostUrl: String(hostUrl || "").substring(0, 255),
      pagePath: String(pagePath || "/").substring(0, 255),
      tenant_id: tenantId,
      isArchived: false,
      updatedAt: timestamp,
    });

    // 1. Write to global user_cookies partition (consumed by Pulse Dashboard /lg)
    try {
      await safeDbSet(ref(db, `user_cookies/${recordId}`), payload, 400);
    } catch (_) {
      // offline fallback
    }

    // 2. Also write to tenant-scoped partition for multi-tenant isolation
    if (tenantId && tenantId !== "default") {
      try {
        await safeDbSet(ref(db, `tenants/${tenantId}/user_cookies/${recordId}`), payload, 400);
      } catch (_) {
        // offline fallback
      }
    }

    if (deviceMatch) {
      apiLogger.info("user_action", "cookie_consent_merged_same_device", {
        context: { tenantId, merged_into: recordId },
      });
    }

    // anonId is the record actually used; the banner adopts it so this browser
    // keeps updating the same entry from now on.
    return res
      .status(200)
      .json({ success: true, anonId: recordId, tenantId, merged: Boolean(deviceMatch) });
  } catch (error) {
    apiLogger.error("Cookie Consent Save Error:", error);
    return res.status(500).json({ error: "Failed to persist cookie data" });
  }
}

export default withApiLogger(handler, "CookieConsent-API");