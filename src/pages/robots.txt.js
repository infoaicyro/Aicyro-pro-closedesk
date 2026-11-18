// /robots.txt, generated so the Sitemap line always matches the deployed domain.
import { SITE_URL } from "../components/Essential/Seo";

const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /lg
Disallow: /logs
Disallow: /embed/
Disallow: /e2e-report

Sitemap: ${SITE_URL}/sitemap.xml
`;

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.write(ROBOTS);
  res.end();
  return { props: {} };
}

export default function Robots() {
  return null;
}
