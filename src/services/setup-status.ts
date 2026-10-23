import "server-only";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
export type SetupCheck = {
  key: string;
  label: string;
  status: "ready" | "pending" | "manual";
  detail: string;
  module: string;
};
export type SetupStatus = {
  checked_at: string;
  day: string;
  checks: SetupCheck[];
};

/** Read-only owner projection. Every query uses the live session and RLS. */
export async function setupStatus(
  org: string,
  branch: string | null,
  day: string,
): Promise<SetupStatus> {
  const { db, user, security } = await requireUser();
  const membership = await db
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", org)
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership.error) throw membership.error;
  if (membership.data?.role !== "organization_owner")
    throw new HttpError(403, "owner_required");
  const checks: SetupCheck[] = [
    {
      key: "account",
      label: "Cuenta",
      status: user.email_confirmed_at ? "ready" : "pending",
      detail: user.email_confirmed_at
        ? "Tu correo está confirmado y tu sesión está activa."
        : "Confirmá tu correo antes de operar.",
      module: "",
    },
    {
      key: "permissions",
      label: "Permisos",
      status: "ready",
      detail:
        "Tu membresía de propietario está activa. Cada persona necesita su propia cuenta y permiso.",
      module: "configuracion",
    },
  ];
  if (!branch) {
    for (const [key, label, module] of [
      ["branch", "Sucursal", "sucursales"],
      ["services", "Servicios", "servicios"],
      ["professionals", "Profesionales", "equipo"],
      ["schedule", "Horarios del día", "equipo"],
      ["payments", "Métodos de pago", "finanzas"],
      ["booking", "Reservas públicas", "sucursales"],
    ])
      checks.push({
        key,
        label,
        module,
        status: "pending",
        detail: "Configurá y elegí una sucursal para comprobar este paso.",
      });
  } else {
    const local = await db
      .from("branches")
      .select("id,active")
      .eq("organization_id", org)
      .eq("id", branch)
      .maybeSingle();
    if (local.error) throw local.error;
    if (!local.data) throw new HttpError(404, "branch_not_found");
    const [
      services,
      prices,
      people,
      assignments,
      daily,
      methods,
      preferences,
      branchPreferences,
      members,
      factors,
    ] = await Promise.all([
      db
        .from("services")
        .select("id,default_duration_minutes,consultation_required,active")
        .eq("organization_id", org)
        .eq("active", true)
        .limit(501),
      db
        .from("branch_services")
        .select("service_id,duration_minutes,price_minor")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .eq("active", true)
        .limit(501),
      db
        .from("staff")
        .select("id,profile_id")
        .eq("organization_id", org)
        .eq("active", true)
        .limit(501),
      db
        .from("staff_branch_assignments")
        .select("staff_id")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .eq("active", true)
        .limit(501),
      db
        .from("staff_availability_exceptions")
        .select("staff_id,available")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .eq("local_date", day)
        .eq("available", true)
        .limit(501),
      db
        .from("payment_methods")
        .select("id,type")
        .eq("organization_id", org)
        .eq("active", true)
        .limit(501),
      db
        .from("organization_settings")
        .select("booking_enabled")
        .eq("organization_id", org)
        .maybeSingle(),
      db
        .from("branch_settings")
        .select("booking_enabled")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .maybeSingle(),
      db
        .from("organization_memberships")
        .select("profile_id")
        .eq("organization_id", org)
        .eq("active", true)
        .limit(501),
      db.auth.mfa.listFactors(),
    ]);
    for (const result of [
      services,
      prices,
      people,
      assignments,
      daily,
      methods,
      preferences,
      branchPreferences,
      members,
      factors,
    ])
      if (result.error) throw result.error;
    const bounded = [
      services,
      prices,
      people,
      assignments,
      daily,
      methods,
      members,
    ].some((r) => (r.data?.length ?? 0) > 500);
    const assigned =
      people.data?.filter((s) =>
        assignments.data?.some((a) => a.staff_id === s.id),
      ) ?? [];
    const linked = assigned.filter(
      (s) =>
        s.profile_id &&
        members.data?.some((m) => m.profile_id === s.profile_id),
    );
    const enabledServices =
      prices.data?.filter((p) =>
        services.data?.some((s) => s.id === p.service_id),
      ) ?? [];
    const configured = enabledServices.filter(
      (p) =>
        p.price_minor !== null &&
        Number(
          p.duration_minutes ??
            services.data?.find((s) => s.id === p.service_id)
              ?.default_duration_minutes,
        ) > 0,
    );
    const scheduled = assigned.filter((s) =>
      daily.data?.some((d) => d.staff_id === s.id),
    );
    const booking = Boolean(
      preferences.data?.booking_enabled &&
      branchPreferences.data?.booking_enabled,
    );
    checks.push(
      {
        key: "branch",
        label: "Sucursal",
        status: local.data.active ? "ready" : "pending",
        detail: local.data.active
          ? "La sucursal seleccionada está activa."
          : "La sucursal está inactiva.",
        module: "sucursales",
      },
      {
        key: "services",
        label: "Servicios",
        status:
          configured.length > 0 && configured.length === enabledServices.length
            ? "ready"
            : "pending",
        detail: `${configured.length} de ${enabledServices.length} servicios activos tienen precio y duración. La consulta previa de rulos se conserva.`,
        module: "servicios",
      },
      {
        key: "professionals",
        label: "Profesionales",
        status:
          assigned.length > 0 && linked.length === assigned.length
            ? "ready"
            : "pending",
        detail: `${linked.length} de ${assigned.length} profesionales activos están vinculados a cuentas con membresía activa. Revisá sus servicios y acceso personal.`,
        module: "equipo",
      },
      {
        key: "schedule",
        label: "Horarios del día",
        status: scheduled.length > 0 ? "ready" : "pending",
        detail: `${scheduled.length} profesionales con bloques disponibles el ${day}. Revisá descansos y ausencias en Equipo; no se inventan turnos semanales.`,
        module: "equipo",
      },
      {
        key: "payments",
        label: "Métodos de pago",
        status: (methods.data?.length ?? 0) > 0 ? "ready" : "pending",
        detail: `${methods.data?.length ?? 0} métodos activos. Confirmá tarifas POS y efectivo inicial antes de cobrar.`,
        module: "finanzas",
      },
      {
        key: "booking",
        label: "Reservas públicas",
        status: booking ? "ready" : "manual",
        detail: booking
          ? "Los flags del negocio y del local están habilitados. Aún hace falta probar el enlace con catálogo y horarios reales."
          : "Deshabilitadas por configuración. Es válido operar sin reservas online; habilitalas solo por decisión del propietario.",
        module: "sucursales",
      },
    );
    if (bounded)
      for (const check of checks)
        if (!["account", "permissions", "branch"].includes(check.key)) {
          check.status = "manual";
          check.detail =
            "El diagnóstico excede 500 registros. Revisá la configuración completa en su módulo.";
        }
    const verified =
      factors.data?.all.filter((f) => f.status === "verified").length ?? 0;
    checks.push({
      key: "security",
      label: "Seguridad",
      status: security.allowed && verified >= 2 ? "ready" : "pending",
      detail:
        verified >= 2
          ? "Tu sesión superó MFA y tenés al menos dos factores verificados. Correo, recuperación, backups y alertas requieren verificación manual."
          : "Agregá un autenticador de respaldo independiente. Correo, recuperación, backups y alertas requieren verificación manual.",
      module: "/mfa",
    });
  }
  if (!checks.some((c) => c.key === "security"))
    checks.push({
      key: "security",
      label: "Seguridad",
      status: "manual",
      detail:
        "Revisá MFA y respaldo en Seguridad de la cuenta; SMTP, backup y alertas requieren evidencia externa.",
      module: "/mfa",
    });
  return { checked_at: new Date().toISOString(), day, checks };
}
