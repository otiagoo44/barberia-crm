import { notFound } from "next/navigation";
import { Agenda } from "@/features/appointments/agenda";
import { Dashboard } from "@/features/analytics/dashboard";
import { Customers } from "@/features/customers/customers";
import { WalkIns } from "@/features/walk-ins/queue";
import { Goals } from "@/features/goals/goals";
import { Configuration } from "@/features/configuration/configuration";
import { requireUser } from "@/lib/auth";
import { Cash } from "@/features/finance/cash";
import { FinancialDashboard } from "@/features/finance/dashboard";
export const dynamic = "force-dynamic";
export default async function Module({
  params,
}: {
  params: Promise<{ organization: string; module: string }>;
}) {
  const p = await params;
  const { db, user } = await requireUser();
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
  const { data: context } = await db.rpc("session_context");
  const role = context?.platform_admin ? "platform_admin" : member?.role;
  if (!role) notFound();
  if(role==='finance'&&!['inicio','caja','finanzas','reportes'].includes(p.module))notFound();
  const admin = ["organization_owner", "platform_admin", "manager"].includes(
    role,
  );
  switch (p.module) {
    case "inicio":
      if(role==='finance')return <FinancialDashboard/>;
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
      if(role==='finance'||role==='barber')return <FinancialDashboard/>;
      if (!admin && role !== "barber") notFound();
      return <Dashboard report />;
    case "caja":
      if(role==='barber')notFound();
      return <Cash/>;
    case "finanzas":
      if(!admin&&role!=='finance')notFound();
      return <FinancialDashboard/>;
    case "equipo":
      if (role === "receptionist") notFound();
      return <Configuration key={p.module} module="equipo" />;
    case "servicios":
    case "sucursales":
      if (!admin) notFound();
      return <Configuration key={p.module} module={p.module} />;
    case "configuracion":
      if (!["organization_owner", "platform_admin"].includes(role)) notFound();
      return <Configuration key={p.module} module="configuracion" />;
    default:
      notFound();
  }
}
