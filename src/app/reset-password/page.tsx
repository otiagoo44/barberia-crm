import { AuthForm } from "@/features/auth/auth-form";
import { requireIdentity } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Reset() {
  let identity;
  try {
    identity = await requireIdentity();
  } catch {
    redirect("/login?link=expired");
  }
  if (identity.security.required && identity.security.level !== "aal2")
    redirect("/mfa?next=reset-password");
  return (
    <main id="content" className="auth-page">
      <AuthForm
        reset
        temporary={!!identity.security.password_change_required}
      />
    </main>
  );
}
