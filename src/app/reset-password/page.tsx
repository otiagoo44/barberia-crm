import { AuthForm } from "@/features/auth/auth-form";
export const dynamic = "force-dynamic";
export default function Reset() {
  return (
    <main id="content" className="auth-page">
      <AuthForm reset />
    </main>
  );
}
