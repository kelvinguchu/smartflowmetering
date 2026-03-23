/**
 * Shared SEO configuration and helpers for Smart Flow Metering public website.
 * Update SITE_URL once the production domain is live.
 */

export const SITE_URL = "https://www.smartmetering.africa";
export const SITE_NAME = "Smart Flow Metering Limited";
export const SITE_TAGLINE = "Smart Utility Management";
export const DEFAULT_DESCRIPTION =
  "Prepaid electricity, water, and gas metering solutions for landlords and property managers in Kenya. Buy tokens via M-Pesa.";
export const OG_IMAGE_PATH = "/opengraph_image.png";
export const BUSINESS_EMAIL = "inquiries@smartmetering.africa";
export const BUSINESS_PHONE = "+254 725 101001";
export const BUSINESS_COUNTRY = "KE";

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : "/" + path;
  return `${SITE_URL}${normalized}`;
}

/** Builds the standard set of OG + Twitter meta tags for a page */
export function socialMeta(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
}) {
  const image = opts.image ?? absoluteUrl(OG_IMAGE_PATH);
  return [
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: opts.url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_KE" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    { name: "twitter:image", content: image },
  ];
}

/** Organization JSON-LD for the whole site */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/logo-assets/PNG/logo-black.png"),
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    areaServed: { "@type": "Country", name: "Kenya" },
    description: DEFAULT_DESCRIPTION,
  };
}

/** WebSite JSON-LD (enables sitelinks search in Google) */
export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}
