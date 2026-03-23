import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "@/components/register/RegisterForm";
import { SITE_NAME, absoluteUrl, socialMeta } from "@/lib/seo";

const title = `Register Your Property | ${SITE_NAME}`;
const description =
  "Register your property for prepaid metering with Smart Flow Metering. Get sub meters installed for electricity, water, or gas and let tenants buy tokens via M-Pesa.";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      ...socialMeta({
        title,
        description,
        url: absoluteUrl("/register"),
      }),
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/register") }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <RegisterForm />
    </main>
  );
}
