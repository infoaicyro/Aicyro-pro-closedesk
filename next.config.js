/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in every response
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      { source: "/terms", destination: "/termofuse", permanent: true },
      { source: "/audit", destination: "/free-website-audit", permanent: true },
    ];
  },
  async headers() {
    return [
      // Baseline security headers on every route (they also count toward page-experience audits)
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      // Everything except the embeddable chatbot may not be framed by other sites,
      // and only gets the browser features it actually uses (voice agent mic, cookie-banner location)
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()" },
        ],
      },
      // Operator, API, embed and QA routes stay out of search results even if linked from elsewhere
      ...["/lg", "/lg/:path*", "/logs", "/logs/:path*", "/embed/:path*", "/e2e-report", "/e2e-report.html", "/api/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      // Long cache for static brand images and icons
      {
        source: "/:file(og-image-1200x630.jpg|favicon.svg|icon.png|icon-192.png|icon-512.png|apple-touch-icon.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-id, x-correlation-id, x-session-id",
          },
        ],
      },
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
