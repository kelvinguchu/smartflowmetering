import { createFileRoute } from "@tanstack/react-router";
import { TermsOfService } from "@/components/legal/TermsOfService";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <TermsOfService />
    </main>
  );
}
