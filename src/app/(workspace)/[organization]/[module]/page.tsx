import { notFound, redirect } from "next/navigation";
import { Agenda } from "@/features/appointments/agenda";
import { Dashboard } from "@/features/analytics/dashboard";
import { Customers } from "@/features/customers/customers";
import { WalkIns } from "@/features/walk-ins/queue";
import { Goals } from "@/features/goals/goals";
import { Configuration } from "@/features/configuration/configuration";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { Cash } from "@/features/finance/cash";
import { FinancialDashboard } from "@/features/finance/dashboard";
import { hasCapability } from "@/lib/capabilities";
export const dynamic = "force-dynamic";
export default async function Module({
  params,
}: {
  params: Promise<{ organization: string; module: string }>;
}) {
  const p = await params;
  // Pages render in parallel with layouts: resolve their auth redirects here
  // too, before any workspace read, instead of leaking an expected gate error.
  let context;
  try {
    context = await requireUser();
  } catch (error) {
    if (error instanceof HttpError && error.code === "mfa_required")
      redirect("/mfa");
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    redirect("/");
  }
  const { db, user } = context;
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", p.organization)
    .maybeSingle();
  if (!org) notFound();
  const { data: member } = await db
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", org.id)
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();
  const role = member?.role;
  if (!role) notFound();
  if (
    role === "finance" &&
    !["inicio", "caja", "finanzas", "reportes"].includes(p.module)
  )
    notFound();
  const admin = hasCapability(role, "operations.manage");
  switch (p.module) {
    case "inicio":
      if (role === "finance") return <FinancialDashboard />;
      return role === "receptionist" ? (
        <>
          <Agenda compact />
          <div style={{ marginTop: 32 }}>
            <WalkIns />
          </div>
        </>
      ) : role === "barber" ? (
        <>
          <Agenda compact />
          <div style={{ marginTop: 32 }}>
            <Dashboard />
          </div>
        </>
      ) : (
        <Dashboard />
      );
    case "agenda":
      return <Agenda />;
    case "clientes":
      return <Customers />;
    case "walk-ins":
      if (role === "barber") notFound();
      return <WalkIns />;
    case "retencion":
      if (role === "barber") notFound();
      return <Customers retention />;
    case "metas":
      if (!admin && role !== "barber") notFound();
      return <Goals />;
    case "reportes":
      if (role === "finance" || role === "barber")
        return <FinancialDashboard />;
      if (!admin && role !== "barber") notFound();
      return <Dashboard report />;
    case "caja":
      if (role === "barber") notFound();
      return <Cash />;
    case "finanzas":
      if (!admin && role !== "finance") notFound();
      return <FinancialDashboard />;
    case "equipo":
      if (role === "receptionist") notFound();
      return <Configuration key={p.module} module="equipo" />;
    case "servicios":
    case "sucursales":
      if (!admin) notFound();
      return <Configuration key={p.module} module={p.module} />;
    case "configuracion":
      if (!hasCapability(role, "organization.configure")) notFound();
      return <Configuration key={p.module} module="configuracion" />;
    default:
      notFound();
  }
}
