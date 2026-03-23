import { createFileRoute } from "@tanstack/react-router";
import { AboutHero } from "@/components/about/AboutHero";
import { MissionVision } from "@/components/about/MissionVision";
import { Values } from "@/components/about/Values";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

const title = `About Us | ${SITE_NAME}`;
const description =
  "Learn about Smart Flow Metering Limited — our mission, vision, and values driving prepaid utility metering innovation in Kenya.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      ...socialMeta({
        title,
        description,
        url: absoluteUrl("/about"),
      }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/about") }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className='pt-16 md:pt-24'>
      <AboutHero />
      <MissionVision />
      <Values />
    </main>
  );
}
