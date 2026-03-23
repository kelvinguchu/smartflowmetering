import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

const title = `Privacy Policy | ${SITE_NAME}`;

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: `Privacy Policy for ${SITE_NAME}.` },
      { name: "robots", content: "noindex, follow" },
      ...socialMeta({
        title,
        description: `Privacy Policy for ${SITE_NAME}.`,
        url: absoluteUrl("/privacy"),
      }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/privacy") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <PrivacyPolicy />
    </main>
  );
}
