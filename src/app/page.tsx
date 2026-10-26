import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { CreateOrganization } from "@/features/organizations/create-organization";
import { SignOut } from "@/features/auth/auth-form";
export const dynamic = "force-dynamic";
export default async function Organizations() {
  let context;
  try {
    context = await requireUser();
  } catch (error) {
    if (error instanceof HttpError && error.code === "password_change_required")
      redirect("/reset-password");
    if (error instanceof HttpError && error.code === "mfa_required")
      redirect("/mfa");
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    return (
      <main id="content" className="org-page">
        <h1>No pudimos abrir tu cuenta</h1>
        <p>Verificá con el administrador que tu acceso esté activo.</p>
        <SignOut />
      </main>
    );
  }
  const { db, profile } = context;
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name,slug")
    .eq("active", true)
    .order("name")
    .limit(100);
  const { data: session } = await db.rpc("session_context");
  return (
    <main id="content" className="org-page">
      <div className="row between">
        <span className="eyebrow">BARBERÍA OS</span>
        <SignOut />
      </div>
      <h1>Hola, {profile.full_name || "bienvenido"}.</h1>
      <p className="muted">Elegí la organización en la que vas a trabajar.</p>
      <div className="organization-grid">
        {organizations?.map((o) => (
          <Link
            className="organization-card"
            href={`/${o.slug}/inicio`}
            key={o.id}
          >
            <span aria-hidden="true">⌂</span>
            <h2>{o.name}</h2>
            <span>Abrir barbería →</span>
          </Link>
        ))}
      </div>
      {!organizations?.length && (
        <div className="panel">
          <h2>Tu cuenta está lista</h2>
          <p>El propietario puede darte acceso usando tu correo registrado.</p>
        </div>
      )}
      {session?.platform_admin && <CreateOrganization />}
    </main>
  );
}
