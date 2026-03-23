import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "../components/home/Hero";
import { TargetAudience } from "@/components/home/TargetAudience";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FAQ } from "@/components/home/FAQ";
import {
  SITE_NAME,
  SITE_URL,
  DEFAULT_DESCRIPTION,
  absoluteUrl,
  socialMeta,
  webSiteJsonLd,
} from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${SITE_NAME} | Prepaid Electricity, Water & Gas Meters Kenya`,
      },
      { name: "description", content: DEFAULT_DESCRIPTION },
      {
        name: "keywords",
        content:
          "prepaid meter Kenya, sub meter, electricity token, water meter, gas meter, M-Pesa token, landlord metering, smart meter Kenya",
      },
      ...socialMeta({
        title: `${SITE_NAME} — Prepaid Utility Meters for Kenyan Landlords`,
        description: DEFAULT_DESCRIPTION,
        url: SITE_URL,
      }),
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(webSiteJsonLd()),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: SITE_NAME,
          url: SITE_URL,
          image: absoluteUrl("/logo-assets/PNG/logo-black.png"),
          telephone: "+254 725 101001",
          email: "inquiries@smartmetering.africa",
          address: {
            "@type": "PostalAddress",
            addressCountry: "KE",
          },
          priceRange: "KES 4,500 – KES 18,500",
          description: DEFAULT_DESCRIPTION,
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <ProductShowcase />
      <TargetAudience />
      <HowItWorks />
      <FAQ />
    </>
  );
}
