import { getDetailedVpnStatus } from "../../lib/networkSecurity";
import { createWebsiteLogger } from "../../lib/loggerPresets";

const logger = createWebsiteLogger("Server-Network-Check");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clientTimezone, webrtcIp, visitorId, deviceTelemetry, clientIp } = req.body;

    // 1. Backend IP Extraction (Netlify Edge Priority)
    // Extract the strict edge connection IP first. This is the server actually connecting to Netlify (i.e. the VPN node)
    let edgeIp = req.headers['x-nf-client-connection-ip'] || req.headers['x-real-ip'] || req.connection?.remoteAddress || '';
    if (edgeIp && edgeIp.includes(',')) {
      edgeIp = edgeIp.split(',')[0].trim();
    }
    if (!edgeIp || edgeIp === '::1') edgeIp = '127.0.0.1';

    const isLocalHttpIp = edgeIp === "127.0.0.1" || edgeIp === "::1" || edgeIp.startsWith("192.168.") || edgeIp.startsWith("10.");

    // 2. Weaponize Transparent Proxy Leaks & Browser Extension Mismatches
    let hasProxyHeaders = false;
    let trueLeakedIp = null;
    let extensionMismatchType = null;
    
    // Heuristic A: x-forwarded-for mismatch
    let xForwardedFor = req.headers['x-forwarded-for'] || '';
    if (xForwardedFor) {
      const firstForwardedIp = xForwardedFor.split(',')[0].trim();
      if (firstForwardedIp !== edgeIp && firstForwardedIp !== '127.0.0.1' && firstForwardedIp !== '::1') {
        hasProxyHeaders = true;
        trueLeakedIp = firstForwardedIp;
        extensionMismatchType = "Transparent Proxy Leak";
        console.log(`[check-network] TRANSPARENT PROXY LEAK DETECTED! VPN Edge IP: ${edgeIp}, Leaked True IP: ${trueLeakedIp}`);
      }
    }

    // Heuristic B: Browser vs Server Mismatch (The ultimate extension catcher)
    // If the browser fetched a public IP (clientIp) that DOES NOT match our server's edgeIp,
    // it mathematically proves an extension is proxying external domains but bypassing our domain!
    if (clientIp && clientIp !== edgeIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && edgeIp !== '127.0.0.1') {
      hasProxyHeaders = true;
      extensionMismatchType = "Browser VPN Extension";
      console.log(`[check-network] EXTENSION MISMATCH DETECTED! Browser sees: ${clientIp}, Server sees: ${edgeIp}`);
    }

    console.log(`[check-network] Edge IP: ${edgeIp} (local: ${isLocalHttpIp}), WebRTC TRUE IP: ${webrtcIp || "null"}, Client IP: ${clientIp || "null"}`);

    // 3. Localhost Bypass:
    if (isLocalHttpIp) {
      console.log(`[check-network] Localhost → EXTENSION_BYPASSED. Browser VPN extensions cannot be detected against localhost.`);
      return res.status(200).json({
        network: { isVpn: null, vpnType: "Extension Bypassed", timezoneMismatch: false, isSuspicious: null, apiFailed: false, bypassed: true },
        ipData: { ip: edgeIp, city: "Local", region: "Local", country: "Local", timezone: clientTimezone || "UTC", lat: null, lng: null }
      });
    }

    // 4. Analysis Target
    // IMPORTANT: The primary analysis target MUST be the server's edge IP. Never overwrite with clientIp!
    const ip = edgeIp;

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

    if (extensionMismatchType && vpnData.isVpn) {
      vpnData.vpnType = extensionMismatchType;
    }

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
