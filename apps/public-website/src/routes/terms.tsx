import { createFileRoute } from "@tanstack/react-router";
import { TermsOfService } from "@/components/legal/TermsOfService";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

const title = `Terms of Service | ${SITE_NAME}`;

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: `Terms of Service for ${SITE_NAME}.` },
      { name: "robots", content: "noindex, follow" },
      ...socialMeta({
        title,
        description: `Terms of Service for ${SITE_NAME}.`,
        url: absoluteUrl("/terms"),
      }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/terms") }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <TermsOfService />
    </main>
  );
}
