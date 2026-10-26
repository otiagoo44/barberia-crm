import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth";
import { MfaForm } from "@/features/auth/mfa-form";
export const dynamic = "force-dynamic";
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const q = await searchParams;
  let identity;
  try {
    identity = await requireIdentity();
  } catch {
    redirect("/login");
  }
  const { data, error } = await identity.db.auth.mfa.listFactors();
  return (
    <main id="content" className="auth-page">
      <MfaForm
        next={
          q.next === "reset-password" ||
          identity.security.password_change_required
            ? "/reset-password"
            : "/"
        }
        level={identity.security.level}
        factors={
          error
            ? []
            : data.totp.map((f) => ({
                id: f.id,
                name: f.friendly_name ?? "Autenticador",
                status: f.status,
              }))
        }
        failed={!!error}
      />
    </main>
  );
}
