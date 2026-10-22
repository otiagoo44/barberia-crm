import { AuthForm } from "@/features/auth/auth-form";
import { Notice } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="content" className="auth-page">
      <div className="stack" style={{ width: "min(440px, 100%)" }}>
        {q.link === "expired" && (
          <Notice error>
            El enlace venció o ya se utilizó. Solicitá nuevas instrucciones de
            recuperación.
          </Notice>
        )}
        <AuthForm />
      </div>
    </main>
  );
}
