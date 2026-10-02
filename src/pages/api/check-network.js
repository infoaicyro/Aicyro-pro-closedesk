import { getDetailedVpnStatus } from "../../lib/networkSecurity";
import { createWebsiteLogger } from "../../lib/loggerPresets";

const logger = createWebsiteLogger("Server-Network-Check");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clientTimezone, webrtcIp, visitorId, deviceTelemetry } = req.body;

    // 1. Backend IP Extraction
    let httpIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || '';
    if (httpIp && httpIp.includes(',')) {
      httpIp = httpIp.split(',')[0].trim();
    }
    if (!httpIp || httpIp === '::1') httpIp = '127.0.0.1';

    const isLocalHttpIp = httpIp === "127.0.0.1" || httpIp === "::1" || httpIp.startsWith("192.168.") || httpIp.startsWith("10.");

    console.log(`[check-network] HTTP IP: ${httpIp} (local: ${isLocalHttpIp}), WebRTC TRUE IP: ${webrtcIp || "null"}`);

    // 2. Localhost Bypass:
    // Browser extensions ignore localhost traffic entirely. The HTTP request never 
    // reaches the VPN tunnel, so the server IP is always 127.0.0.1 regardless of VPN.
    // We cannot detect a browser extension VPN in this environment.
    // Return a specific EXTENSION_BYPASSED status — not CLEAN — to accurately reflect
    // that the check did not run, not that the user is verified clean.
    if (isLocalHttpIp) {
      console.log(`[check-network] Localhost → EXTENSION_BYPASSED. Browser VPN extensions cannot be detected against localhost.`);
      return res.status(200).json({
        network: { isVpn: null, vpnType: "Extension Bypassed", timezoneMismatch: false, isSuspicious: null, apiFailed: false, bypassed: true },
        ipData: { ip: httpIp, city: "Local", region: "Local", country: "Local", timezone: clientTimezone || "UTC", lat: null, lng: null }
      });
    }

    // IMPORTANT: The HTTP IP IS the analysis target (it is the VPN exit node IP).
    // The WebRTC IP is the user's TRUE IP (it bypassed the VPN tunnel).
    // If HTTP IP ≠ WebRTC IP → the HTTP IP is fake. This is caught in networkSecurity.js.
    const ip = httpIp;

    // HTTP proxy header scanning deleted to avoid CGNAT false positives.
    // Relying strictly on WebRTC, Timezone, and Datacenter profiling.
    let hasProxyHeaders = false;

    // 4. Extract Geographic Data (Vercel Native vs Fallback)
    let ipTimezone = "Unknown";
    let ipOrg = "Unknown";
    let ipLocationData = {};

    // Vercel Edge automatically injects these headers for deployed apps
    const vercelTimezone = req.headers['x-vercel-ip-timezone'];
    const vercelCountry = req.headers['x-vercel-ip-country'];
    const vercelCity = req.headers['x-vercel-ip-city'];

    if (vercelTimezone) {
      // Fast path: We are on Vercel. Extract geographic headers immediately.
      ipTimezone = vercelTimezone;
      ipLocationData = {
        country: vercelCountry || "Unknown",
        city: vercelCity || "Unknown",
        region: req.headers['x-vercel-ip-country-region'] || "Unknown",
        lat: req.headers['x-vercel-ip-latitude'] ? parseFloat(req.headers['x-vercel-ip-latitude']) : null,
        lng: req.headers['x-vercel-ip-longitude'] ? parseFloat(req.headers['x-vercel-ip-longitude']) : null,
      };
      console.log(`[check-network] FastPath (Vercel Headers) → timezone: "${ipTimezone}", country: "${ipLocationData.country}"`);
    }

    if (!isLocalHttpIp) {
      // We MUST query ipinfo to extract the ASN/Org data, as Vercel does not provide ASN headers.
      // If Vercel headers were missing, this also serves as our fallback for geography.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const ipinfoRes = await fetch(`https://ipinfo.io/${ip}/json`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (ipinfoRes.ok) {
          const fetchedData = await ipinfoRes.json();
          ipOrg = fetchedData.org || "Unknown";
          
          if (!vercelTimezone) {
            ipLocationData = fetchedData;
            ipTimezone = ipLocationData.timezone || "Unknown";
            console.log(`[check-network] Fallback (ipinfo) Geo populated.`);
          }
          console.log(`[check-network] ASN Org Data: "${ipOrg}"`);
        }
      } catch (e) {
        logger.warn("api", "ipinfo_fetch_failed", { error: e.message });
      }
    }

    // 5. Execute the Deep Security Check
    // Pass webrtcIp as-is. The engine compares it against the HTTP IP.
    // If they differ, the HTTP IP is the VPN exit node and the WebRTC IP is the real IP.
    const vpnData = await getDetailedVpnStatus(ip, ipTimezone, 15000, logger, clientTimezone, hasProxyHeaders, webrtcIp, ipOrg, visitorId, deviceTelemetry);

    return res.status(200).json({
      network: vpnData,
      ipData: {
        ip: ip,
        city: ipLocationData.city || "Unknown",
        region: ipLocationData.region || "Unknown",
        country: ipLocationData.country || "Unknown",
        timezone: ipTimezone,
        lat: ipLocationData.loc ? parseFloat(ipLocationData.loc.split(',')[0]) : null,
        lng: ipLocationData.loc ? parseFloat(ipLocationData.loc.split(',')[1]) : null,
      }
    });
  } catch (error) {
    logger.error("api", "network_check_failed", { error: error.message });
    return res.status(500).json({
      isVpn: false,
      vpnType: "Unknown",
      timezoneMismatch: false,
      isSuspicious: false,
      error: "Internal Server Error"
    });
  }
}
