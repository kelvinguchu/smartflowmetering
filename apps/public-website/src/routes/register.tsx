import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "@/components/register/RegisterForm";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className='pt-16 md:pt-24 pb-12'>
      <RegisterForm />
    </main>
  );
}
