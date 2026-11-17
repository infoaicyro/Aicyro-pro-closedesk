// src/lib/foundingApplicationClient.js
// Browser helpers for the Founding 25 popup forms. All writes go through the
// guarded server endpoint (/api/founding-application); the browser never
// writes to Firebase directly.
import { generateCorrelationId } from "./tracer";

async function post(body) {
  const response = await fetch("/api/founding-application", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-correlation-id": generateCorrelationId(),
    },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

/** Saves step 1 and returns the reference needed to append step 2. */
export async function submitFoundingApplication(formData, source = "desktop_modal") {
  const screen =
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown";
  const data = await post({ action: "create", ...formData, source, screen });
  return { applicationId: data.applicationId, updateToken: data.updateToken };
}

/** Appends the segmentation answer (step 2) to an existing application. */
export async function submitFoundingSegmentation(reference, segmentationGoal) {
  if (!reference) return;
  await post({ action: "segment", ...reference, segmentationGoal });
}
