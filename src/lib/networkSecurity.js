/**
 * Advanced Network Security and VPN Detection
 */

/**
 * Checks if there is a mismatch between the IP's timezone offset and the system's timezone offset.
 * Comparing UTC offsets is much more reliable than comparing raw timezone string names.
 */
function checkTimezoneMismatch(ipTimezone, clientTimezoneStr) {
  if (!ipTimezone || ipTimezone === "Unknown") return null;
  try {
    const now = new Date();
    const ipFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ipTimezone,
      timeZoneName: 'longOffset'
    });
    const ipOffsetPart = ipFormatter.formatToParts(now).find(p => p.type === 'timeZoneName');
    
    const clientFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: clientTimezoneStr || 'UTC',
      timeZoneName: 'longOffset'
    });
    const clientOffsetPart = clientFormatter.formatToParts(now).find(p => p.type === 'timeZoneName');

    if (!ipOffsetPart || !clientOffsetPart) {
      console.warn(`Timezone mismatch: Missing offset part. Client: ${clientTimezoneStr}, IP: ${ipTimezone}`);
      return (clientTimezoneStr || 'UTC') !== ipTimezone;
    }

    const parseOffset = (offsetString) => {
      const match = offsetString.match(/GMT([+-])(\d{1,2}):(\d{2})/);
      if (!match) return null;
      const sign = match[1] === '+' ? -1 : 1;
      return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
    };

    const ipOffset = parseOffset(ipOffsetPart.value);
    const clientOffset = parseOffset(clientOffsetPart.value);

    console.log(`[Timezone Debug] Client TZ: ${clientTimezoneStr} (Offset: ${clientOffset}), IP TZ: ${ipTimezone} (Offset: ${ipOffset})`);

    if (ipOffset !== null && clientOffset !== null) {
      const diff = Math.abs(clientOffset - ipOffset);
      console.log(`[Timezone Debug] Offset Difference: ${diff} minutes`);
      return diff >= 60;
    }
    
    return null;
  } catch (error) {
    console.error(`[Timezone Debug] Math failed for Client: ${clientTimezoneStr} vs IP: ${ipTimezone}`, error);
    return null; // Fail safe to UNVERIFIED instead of CLEAN
  }
}

// In-memory ledger removed because it violates serverless stateless architecture.
// Identity persistence/velocity checks should be implemented directly in the database (e.g., Firebase).

/**
 * Fetches VPN status from a third-party API with a strict timeout and session caching.
 * @param {string} ip - The IPv4 or IPv6 address.
 * @param {string} ipTimezone - The timezone retrieved from IP info.
 * @param {number} timeoutMs - Maximum time to wait for the API response.
 * @param {object} txLogger - The scoped logger instance.
 * @param {string} clientTimezone - The browser's actual timezone.
 * @param {boolean} hasProxyHeaders - True if proxy-related headers were found on the backend request.
 * @param {string|null} webrtcIp - The true STUN IP extracted from the browser.
 * @param {string} ipOrg - The ASN/Org string from ipinfo.io.
 * @param {string|null} visitorId - The FingerprintJS persistent ID.
 */
export async function getDetailedVpnStatus(
  ip, 
  ipTimezone, 
  timeoutMs = 2000, 
  txLogger = console, 
  clientTimezone = 'UTC',
  hasProxyHeaders = false,
  webrtcIp = null,
  ipOrg = "Unknown",
  visitorId = null,
  deviceTelemetry = null
) {
  const result = {
    isVpn: hasProxyHeaders, 
    vpnType: hasProxyHeaders ? "Proxy/VPN Header Detected" : "Unknown",
    timezoneMismatch: checkTimezoneMismatch(ipTimezone, clientTimezone),
    isSuspicious: hasProxyHeaders, // Inherit if headers are flagged
    apiFailed: false, // Track if we actually finished the check
    asnOrg: ipOrg, // Initial fallback from ipinfo.io
  };

  // 1. WebRTC Leak Detection (Correct Direction)
  // The HTTP IP (`ip`) is what the VPN server sent. The WebRTC IP is what the browser
  // leaked via raw UDP (bypassing the VPN tunnel) - the user's TRUE ISP IP.
  // If they don't match, the HTTP IP is a VPN exit node. Flag it.
  if (webrtcIp && webrtcIp !== ip) {
    // Exception: Do not flag if the HTTP IP is IPv6 and the STUN leaked IP is IPv4.
    // This is a common dual-stack ISP configuration, not a VPN leak.
    const isIpV6 = ip.includes(':');
    const isWebrtcIpV4 = webrtcIp.includes('.');

    if (!(isIpV6 && isWebrtcIpV4)) {
      result.isVpn = true;
      result.vpnType = "WebRTC UDP Leak Detected";
      result.trueIp = webrtcIp; // The real IP behind the VPN
      result.isSuspicious = true;
      console.log(`[networkSecurity] WebRTC Leak! VPN IP: ${ip}, True IP: ${webrtcIp}`);
    } else {
      console.log(`[networkSecurity] WebRTC Dual-Stack Exception. IPv6 HTTP: ${ip}, IPv4 WebRTC: ${webrtcIp}`);
    }
  } else if (webrtcIp === null) {
    // Aggressive Fallback: WebRTC was completely blocked by the browser.
    result.isVpn = true;
    result.vpnType = "Privacy Shield / VPN Extension";
    result.isSuspicious = true;
    console.log(`[networkSecurity] WebRTC Blocked! Flagging as VPN.`);
  }

  // 2. Datacenter / ASN Profiling
  const vpnHosts = ['m247', 'choopa', 'cdn77', 'leaseweb', 'datacamp', 'quadranet', 'cogent', 'datapacket'];
  const cloudProviders = ['amazon', 'aws', 'digitalocean', 'ovh', 'hetzner', 'linode', 'microsoft', 'azure', 'google cloud', 'hosting', 'datacenter', 'server', 'colocation', 'vps'];
  
  const orgLower = ipOrg.toLowerCase();
  
  if (vpnHosts.some(dc => orgLower.includes(dc))) {
    result.isVpn = true;
    result.isTunnel = false;
    result.vpnType = "Commercial VPN Node";
    result.isSuspicious = true;
  } else if (cloudProviders.some(dc => orgLower.includes(dc))) {
    result.isVpn = false;
    result.isTunnel = true;
    result.vpnType = "Datacenter Tunnel";
    result.isSuspicious = true;
  }

  // 3. Hardware Emulation Profiling (WebGL Telemetry)
  if (deviceTelemetry && deviceTelemetry.gpuRenderer) {
    const renderer = deviceTelemetry.gpuRenderer.toLowerCase();
    const emulatedRenderers = ["swiftshader", "llvmpipe", "google swiftshader"];
    if (emulatedRenderers.some(r => renderer.includes(r))) {
      result.isVpn = true;
      result.vpnType = "Virtualized Environment / Bot";
      result.isSuspicious = true;
    }
  }

  // 3. Identity Persistence & Velocity Check (Impossible Travel)
  // Temporarily disabled until wired into Firebase/Postgres.
  // In a serverless Vercel function, in-memory Maps wipe instantly.
  if (visitorId && visitorId !== "unknown") {
    // TODO: Wire to database for persistent IP rotation tracking across stateless functions
  }

  // 4. Timezone Mismatch
  // If timezones mismatch, we already consider it suspicious
  if (result.timezoneMismatch) {
    result.isSuspicious = true;
  }

  if (!ip || ip === "unknown") return result;

  // Caching mechanism removed because `sessionStorage` is a DOM API and does not exist in Node.js serverless functions.
  // TODO: Implement server-side Redis cache (e.g., Vercel KV) if rate-limiting becomes an issue.

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // We add &cors=1 to instruct the proxycheck API to echo the Origin header if no API key is used.
    const response = await fetch(`https://proxycheck.io/v2/${ip}?vpn=1&asn=1&cors=1`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      result.apiFailed = true;
    } else {
      const data = await response.json();
      if (data.status === "ok" && data[ip]) {
        if (data[ip].provider && result.asnOrg === "Unknown") {
          result.asnOrg = data[ip].provider;
        }
        
        // If ProxyCheck flags it as a Proxy/VPN
        if (data[ip].proxy === "yes") {
          const providerLower = (data[ip].provider || result.asnOrg).toLowerCase();
          const isCloud = cloudProviders.some(dc => providerLower.includes(dc));
          
          if (isCloud && !vpnHosts.some(vh => providerLower.includes(vh))) {
            // It's a pure Datacenter (like AWS). Classify as Tunnel, not VPN.
            result.isVpn = false;
            result.isTunnel = true;
            result.vpnType = data[ip].type || "Datacenter Tunnel";
          } else {
            // It's a Commercial VPN (like M247/TouchVPN) or Residential VPN
            result.isVpn = true;
            result.isTunnel = false;
            result.vpnType = data[ip].type || "VPN";
          }
          result.isSuspicious = true;
        }
      } else if (data.status === "warning" || data.status === "error") {
        result.apiFailed = true;
        if (txLogger && typeof txLogger.warn === 'function') {
          txLogger.warn("network_request", "vpn_api_warning", { message: data.message });
        }
      }
    }

    // Secondary Aggressive Fallback: IPInfo Blackbox (Free VPN detection endpoint)
    // We only run this if the primary heuristics/ProxyCheck didn't already catch it.
    if (!result.isVpn && !result.isTunnel) {
      try {
        const blackboxRes = await fetch(`https://blackbox.ipinfo.app/lookup/${ip}`, { signal: controller.signal });
        if (blackboxRes.ok) {
          const blackboxText = await blackboxRes.text();
          if (blackboxText.trim() === 'Y') {
            result.isVpn = true;
            result.vpnType = "VPN (Blackbox IPInfo)";
            result.isSuspicious = true;
          }
        }
      } catch (bbError) {
        // Ignore secondary API failure
      }
    }
  } catch (error) {
    result.apiFailed = true;
    if (error.name === "AbortError") {
      if (txLogger && typeof txLogger.warn === 'function') {
        txLogger.warn("network_request", "vpn_fetch_timeout", { timeoutMs });
      }
    } else {
      if (txLogger && typeof txLogger.error === 'function') {
        txLogger.error("network_request", "vpn_fetch_failed", { error: error.message });
      }
    }
  }

  // We previously failed-closed to UNVERIFIED here on API timeout, but this caused
  // false positives on the dashboard for legitimate users when the API rate limits us.
  // We now fail-open: if heuristics didn't catch them, and API fails, they are CLEAN.

  // sessionStorage setItem removed (DOM API missing in Node.js).

  return result;
}
