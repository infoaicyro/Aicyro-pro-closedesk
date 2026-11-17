// src/pages/api/founding-application.js
// Founding 25 application intake for the marketing site popup form.
// Replaces the old direct client-side Firebase writes (blocked by the
// multi-tenant database rules) with a guarded server endpoint.
//
// POST { action: "create", name, business, website, phone, email, industry, source? }
//   -> { success, applicationId, updateToken }
// POST { action: "segment", applicationId, updateToken, segmentationGoal }
//   -> { success }
import crypto from "crypto";
import { ref, push } from "firebase/database";
import { db } from "../../lib/firebase";
import { withApiLogger } from "../../lib/apiMiddleware";
import { safeDbGet, safeDbSet, safeDbUpdate } from "../../lib/safeDb";
import { sanitizeFirebaseKey, sanitizeFirebasePayload, stripCrlf } from "../../lib/sanitizer";
import { validateRequestMethod, validateRequestBodySize } from "../../lib/publicEndpointGuard";
import { checkRateLimit, recordFailedAttempt, getClientIp } from "../../lib/persistentRateLimiter";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8kb",
    },
  },
};

const COLLECTION = "founding_applications";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_INDUSTRIES = new Set([
  "hvac",
  "plumbing",
  "restoration",
  "roofing",
  "pest-control",
  "electrical",
  "appliance",
  "other",
]);
const RATE_OPTIONS = { maxAttempts: 5, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 };

const clean = (value, max) => stripCrlf(String(value ?? "")).trim().slice(0, max);
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function validateApplication(body) {
  const data = {
    name: clean(body.name, 80),
    business: clean(body.business, 120),
    website: clean(body.website, 255),
    phone: clean(body.phone, 40),
    email: clean(body.email, 160).toLowerCase(),
    industry: clean(body.industry, 40),
    source: clean(body.source || "desktop_modal", 40),
  };

  const missing = ["name", "business", "website", "phone", "email", "industry"].filter(
    (field) => !data[field]
  );
  if (missing.length) return { error: `Missing required fields: ${missing.join(", ")}` };
  if (!EMAIL_REGEX.test(data.email)) return { error: "A valid work email is required." };
  if (!ALLOWED_INDUSTRIES.has(data.industry)) return { error: "Unknown service trade." };
  if (!/^https?:\/\//i.test(data.website)) data.website = `https://${data.website}`;

  return { data };
}

async function handleCreate(req, res, apiLogger, body) {
  const clientIp = getClientIp(req);
  const rateKey = `founding_app_${clientIp}`;

  const rateCheck = await checkRateLimit(rateKey, RATE_OPTIONS);
  if (!rateCheck.allowed) {
    res.setHeader("Retry-After", String(rateCheck.retryAfter || 60));
    return res.status(429).json({
      success: false,
      error: "Too many applications from this connection. Please wait a few minutes.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  }

  const { data, error } = validateApplication(body);
  if (error) {
    return res.status(400).json({ success: false, error, code: "INVALID_PAYLOAD" });
  }

  // Count every accepted submission against the per-IP window.
  await recordFailedAttempt(rateKey, RATE_OPTIONS).catch(() => {});

  const updateToken = crypto.randomBytes(24).toString("hex");
  const newRef = push(ref(db, COLLECTION));
  const applicationId = newRef.key;

  const record = sanitizeFirebasePayload({
    type: "founding-25-application",
    ...data,
    step: 1,
    status: "pending_review",
    tenant_id: "default",
    createdAt: new Date().toISOString(),
    updateTokenHash: hashToken(updateToken),
    deviceInfo: {
      userAgent: clean(req.headers["user-agent"] || "unknown", 255),
      screen: clean(body.screen || "unknown", 20),
    },
  });

  try {
    await safeDbSet(newRef, record, 3000);
  } catch (err) {
    apiLogger.error("database", "founding_application_save_failed", {
      error: err,
      context: { application_id: applicationId },
    });
    return res.status(502).json({
      success: false,
      error: "Could not submit your application. Please try again.",
      code: "PERSISTENCE_FAILED",
    });
  }

  apiLogger.info("lead", "founding_application_received", {
    context: { application_id: applicationId, industry: data.industry },
  });

  return res.status(200).json({ success: true, applicationId, updateToken });
}

async function handleSegment(req, res, apiLogger, body) {
  const applicationId = sanitizeFirebaseKey(body.applicationId, "invalid");
  const updateToken = clean(body.updateToken, 128);
  const segmentationGoal = clean(body.segmentationGoal, 1000);

  if (!body.applicationId || !updateToken) {
    return res.status(400).json({ success: false, error: "Application reference missing.", code: "INVALID_PAYLOAD" });
  }

  const appRef = ref(db, `${COLLECTION}/${applicationId}`);

  let snapshot;
  try {
    snapshot = await safeDbGet(appRef, 3000);
  } catch (err) {
    apiLogger.error("database", "founding_application_read_failed", { error: err });
    return res.status(502).json({ success: false, error: "Could not save your answer.", code: "PERSISTENCE_FAILED" });
  }

  const existing = snapshot && snapshot.exists() ? snapshot.val() : null;
  const expected = existing?.updateTokenHash ? Buffer.from(existing.updateTokenHash, "hex") : null;
  const provided = Buffer.from(hashToken(updateToken), "hex");
  if (!expected || expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(403).json({ success: false, error: "Application reference is not valid.", code: "FORBIDDEN" });
  }

  try {
    await safeDbUpdate(
      appRef,
      { segmentationGoal, step: 2, updatedAt: new Date().toISOString() },
      3000
    );
  } catch (err) {
    apiLogger.error("database", "founding_application_update_failed", { error: err });
    return res.status(502).json({ success: false, error: "Could not save your answer.", code: "PERSISTENCE_FAILED" });
  }

  return res.status(200).json({ success: true });
}

async function handler(req, res, apiLogger) {
  if (!validateRequestMethod(req, res, ["POST"])) return;
  if (!validateRequestBodySize(req, res, 8192)) return;

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
  if (!body) {
    return res.status(400).json({ success: false, error: "Request body must be a JSON object.", code: "INVALID_PAYLOAD" });
  }

  if (body.action === "segment") return handleSegment(req, res, apiLogger, body);
  return handleCreate(req, res, apiLogger, body);
}

export default withApiLogger(handler, "FoundingApplication-API");
