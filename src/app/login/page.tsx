import { AuthForm } from "@/features/auth/auth-form";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main id="content" className="auth-page">
      <AuthForm />
    </main>
  );
}
