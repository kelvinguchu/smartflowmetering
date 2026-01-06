import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "../components/home/Hero";
import { TargetAudience } from "@/components/home/TargetAudience";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FAQ } from "@/components/home/FAQ";

export const Route = createFileRoute("/")({
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
