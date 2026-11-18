// /sitemap.xml: every public, indexable page of the marketing site.
// Add a page here when you add a public route.
import { SITE_URL } from "../components/Essential/Seo";

const PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/free-website-audit", changefreq: "monthly", priority: "0.8" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/termofuse", changefreq: "yearly", priority: "0.3" },
  { path: "/cookie", changefreq: "yearly", priority: "0.3" },
];

// Bump when page content changes meaningfully
const LAST_MODIFIED = "2026-11-18";

function buildSitemap() {
  const urls = PAGES.map(
    (p) => `  <url>
    <loc>${SITE_URL}${p.path === "/" ? "/" : p.path}</loc>
    <lastmod>${LAST_MODIFIED}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.write(buildSitemap());
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
