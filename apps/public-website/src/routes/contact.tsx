import { createFileRoute } from "@tanstack/react-router";
import { ContactInfo } from "@/components/contact/ContactInfo";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

const title = `Contact Us | ${SITE_NAME}`;
const description =
  "Get in touch with Smart Flow Metering Limited for prepaid meter inquiries, installations, token support, and partnership opportunities in Kenya.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      ...socialMeta({
        title,
        description,
        url: absoluteUrl("/contact"),
      }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/contact") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: title,
          url: absoluteUrl("/contact"),
          mainEntity: {
            "@type": "Organization",
            name: SITE_NAME,
            telephone: "+254 725 101001",
            email: "inquiries@smartmetering.africa",
          },
        }),
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <ContactInfo />
    </main>
  );
}
