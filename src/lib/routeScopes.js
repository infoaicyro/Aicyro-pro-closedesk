// src/lib/routeScopes.js
// Single source of truth for which routes belong to the operator/engine side
// (no marketing chrome, no visitor tracking, no public chatbot).
const INTERNAL_PREFIXES = ["/lg", "/logs", "/embed", "/e2e-report"];

export function isInternalPath(path) {
  if (!path || typeof path !== "string") return false;
  const clean = path.split(/[?#]/)[0];
  return INTERNAL_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
}
