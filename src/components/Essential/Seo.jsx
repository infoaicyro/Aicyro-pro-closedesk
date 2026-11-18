import Head from "next/head";
import { useRouter } from "next/router";

// Public origin of the marketing site. Set NEXT_PUBLIC_SITE_URL per environment
// (e.g. a staging domain); production falls back to aicyro.pro.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://aicyro.pro").replace(/\/+$/, "");

const SITE_NAME = "CloseDesk by Aicyro";
const DEFAULT_TITLE = "CloseDesk by Aicyro | 24/7 AI Booking Desk & CRM for Field Service";
const DEFAULT_DESCRIPTION =
  "CloseDesk answers website visitors in under a second, 24/7, qualifies the job and books it. AI chat, voice agent and CRM for HVAC, plumbing, roofing and more.";
const DEFAULT_OG_DESCRIPTION =
  "Turn website visitors into booked jobs, 24/7. Done-for-you AI chat, voice agent and CRM that qualifies every lead and books it, tracked in Pulse.";
const DEFAULT_OG_IMAGE = "/og-image-1200x630.jpg";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const THEME_COLOR = "#8a2be2";

function absoluteUrl(path) {
  if (!path) return `${SITE_URL}/`;
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical path: no query string, no hash, no trailing slash (except the root). */
function canonicalPath(asPath) {
  const clean = String(asPath || "/").split(/[?#]/)[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
}

// Site-wide entities, linked by @id so every page's graph points at the same organization.
const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Aicyro",
  url: `${SITE_URL}/`,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
  description:
    "Aicyro is a global AI product team that builds CloseDesk, an AI-powered CRM, booking desk and business automation platform.",
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  inLanguage: "en-US",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

const SOFTWARE = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#closedesk`,
  name: "CloseDesk",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "CRM",
  operatingSystem: "Web",
  url: `${SITE_URL}/`,
  description:
    "CloseDesk is an AI-powered CRM and booking desk. It answers website visitors in under a second, 24/7, by chat and voice, qualifies each lead, books the job, notifies the team and logs everything in the Pulse dashboard.",
  featureList: [
    "24/7 AI chat and booking desk",
    "Real-time AI voice agent",
    "Lead management and sales pipeline",
    "Pulse analytics and reports",
    "Workflow automation and notifications",
    "Multi-tenant data isolation",
  ],
  provider: { "@id": `${SITE_URL}/#organization` },
  offers: {
    "@type": "Offer",
    name: "Founding 25 founder rate",
    description:
      "Done-for-you build included. Monthly rate between $250 and $350, locked for life; exact rate confirmed on a call.",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      minPrice: 250,
      maxPrice: 350,
      priceCurrency: "USD",
      unitCode: "MON",
    },
    url: `${SITE_URL}/#pricing`,
    seller: { "@id": `${SITE_URL}/#organization` },
  },
};

/**
 * Per-page SEO head.
 * - canonical defaults to the current route (pass `path` to override)
 * - `schema` adds page-specific JSON-LD nodes (FAQPage, WebPage, ...)
 * - `noindex` for pages that must stay out of search results
 */
export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = "CloseDesk by Aicyro, the 24/7 AI booking desk for field service businesses",
  path,
  type = "website",
  noindex = false,
  schema = [],
}) {
  const router = useRouter();
  const pagePath = path ?? canonicalPath(router?.asPath);
  const pageUrl = absoluteUrl(pagePath);
  const imageUrl = absoluteUrl(ogImage);
  const socialDescription = ogDescription || (title === DEFAULT_TITLE ? DEFAULT_OG_DESCRIPTION : description);

  const webPage = {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#closedesk` },
    primaryImageOfPage: { "@type": "ImageObject", url: imageUrl },
  };

  const graph = noindex
    ? null
    : { "@context": "https://schema.org", "@graph": [ORGANIZATION, WEBSITE, SOFTWARE, webPage, ...schema] };

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}
      />
      {!noindex && <link rel="canonical" href={pageUrl} />}

      {/* Icons & app */}
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="icon" href="/icon.png" sizes="32x32" type="image/png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="theme-color" content={THEME_COLOR} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={socialDescription} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={socialDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={ogImageAlt} />

      {graph && (
        <script
          type="application/ld+json"
          // JSON.stringify output is safe here; "<" is escaped so the data can never close the script tag
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
        />
      )}
    </Head>
  );
}
