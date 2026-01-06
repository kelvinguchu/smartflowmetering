import { createFileRoute } from "@tanstack/react-router";
import { ContactInfo } from "@/components/contact/ContactInfo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <ContactInfo />
    </main>
  );
}
