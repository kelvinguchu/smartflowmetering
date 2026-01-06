import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <PrivacyPolicy />
    </main>
  );
}
