import { createFileRoute } from "@tanstack/react-router";
import { AboutHero } from "@/components/about/AboutHero";
import { MissionVision } from "@/components/about/MissionVision";
import { Values } from "@/components/about/Values";

export const Route = createFileRoute("/about")({
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
