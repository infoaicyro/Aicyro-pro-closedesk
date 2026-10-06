export async function runVpnUnmasking({ clientIp, edgeIp, edgeOrg, edgeCountry, logger }) {
  if (!clientIp || !edgeIp || clientIp === edgeIp) {
    return { verdict: "clean", reason: "no mismatch" };
  }

  const isClientIpv4 = clientIp.includes('.');
  const isEdgeIpv6 = edgeIp.includes(':');

  if (!(isClientIpv4 && isEdgeIpv6)) {
     return { verdict: "clean", reason: "not a mixed-family mismatch" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`https://ipinfo.io/${clientIp}/json`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
       return { verdict: "clean", reason: "fetch failed" };
    }

    const data = await res.json();
    const clientOrg = data.org || "";
    const clientCountry = data.country || "";

    const isClientDatacenter = clientOrg.toLowerCase().includes("hosting") || 
                               clientOrg.toLowerCase().includes("cloud") ||
                               clientOrg.toLowerCase().includes("datacenter") ||
                               clientOrg.toLowerCase().includes("amazon") ||
                               clientOrg.toLowerCase().includes("google") ||
                               clientOrg.toLowerCase().includes("digitalocean");

    if (clientOrg && edgeOrg && clientOrg !== edgeOrg) {
        if (isClientDatacenter) {
            return { verdict: "tunnel", unmasked: true, reason: "asn mismatch with datacenter" };
        }
    }

    if (clientCountry && edgeCountry && clientCountry !== edgeCountry) {
        return { verdict: "tunnel", unmasked: true, reason: "country mismatch" };
    }

    return { verdict: "clean", reason: "mismatch resolved cleanly" };
  } catch (error) {
    if (logger) logger.warn("unmasking", "lookup_timeout_or_error", { error: error.message });
    return { verdict: "clean", reason: "error_fail_open" };
  }
}

export function applyUnmasking(baseResponse, unmaskTrace) {
  if (unmaskTrace && unmaskTrace.unmasked) {
      return {
          ...baseResponse,
          network: {
              ...baseResponse.network,
              isVpn: true,
              isTunnel: true,
              unmasked: true,
              isSuspicious: true,
              vpnType: "Unmasked Tunnel"
          }
      };
  }
  return baseResponse;
}
