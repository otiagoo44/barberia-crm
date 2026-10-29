import "server-only";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { observePublicBooking, professionalConfigured, professionalAccessReady, type SetupTeamPerson } from "@/lib/setup-readiness";
export type SetupCheck = {
  key: string;
  label: string;
  status: "ready" | "pending" | "manual";
  detail: string;
  module: string;
  steps?: {
    label: string;
    status: "ready" | "pending" | "manual";
    detail: string;
  }[];
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
      .select("id,active,slug")
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
      schedule,
      methods,
      fees,
      preferences,
      branchPreferences,
      members,
      factors,
      team,
      settlements,
      receipts,
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
      db.rpc("setup_availability", {
        p_org: org,
        p_branch: branch,
        p_day: day,
      }),
      db
        .from("payment_methods")
        .select("id,type")
        .eq("organization_id", org)
        .eq("active", true)
        .limit(501),
      db
        .from("payment_method_fee_rules")
        .select(
          "id,payment_method_id,effective_from,effective_to,evidence_reference",
        )
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
      db.rpc("setup_team", { p_org: org, p_branch: branch }),
      db
        .from("payment_reconciliations")
        .select("payment_id,settled_at,evidence_reference")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .limit(501),
      db
        .from("payments")
        .select("id,payment_method_id,fee_rule_id,direction")
        .eq("organization_id", org)
        .eq("branch_id", branch)
        .limit(501),
    ]);
    for (const result of [
      services,
      prices,
      people,
      assignments,
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
    const scheduleCheck = describeSchedule(
      schedule.data,
      Boolean(schedule.error),
      day,
    );
    const now = new Date().toISOString();
    const cards = methods.data?.filter((m) => m.type === "card") ?? [];
    const configuredFees = cards.filter((m) =>
      fees.data?.some(
        (f) =>
          f.payment_method_id === m.id &&
          f.effective_from <= now &&
          (!f.effective_to || f.effective_to > now) &&
          f.evidence_reference,
      ),
    );
    const booking = Boolean(
      preferences.data?.booking_enabled &&
      branchPreferences.data?.booking_enabled,
    );
    const teamPeople: SetupTeamPerson[] = team.data?.people ?? [];
    const enabledPeople = teamPeople.filter((p) => p.assigned);
    const teamReady =
      !team.error &&
      enabledPeople.length > 0 &&
      enabledPeople.every(professionalConfigured);
    const [organization, publicAppointments] = await Promise.all([
      db.from("organizations").select("slug").eq("id", org).maybeSingle(),
      db.from("appointments").select("id").eq("organization_id", org).eq("branch_id", branch).eq("source", "public").limit(1),
    ]);
    const publicObservation = booking && organization.data && process.env.APP_URL
      ? await observePublicBooking(process.env.APP_URL, organization.data.slug, local.data.slug, day)
      : { catalog: false, availability: false, failed: Boolean(booking) };
    const publicEvidence = !publicAppointments.error && Boolean(publicAppointments.data?.length);
    const settlementBounded =
      (settlements.data?.length ?? 0) > 500 ||
      (receipts.data?.length ?? 0) > 500;
    const reconciledCards = cards.filter((m) =>
      receipts.data?.some(
        (p) =>
          p.payment_method_id === m.id &&
          p.direction === 1 &&
          fees.data?.some(
            (f) =>
              f.id === p.fee_rule_id &&
              f.effective_from <= now &&
              (!f.effective_to || f.effective_to > now),
          ) &&
          settlements.data?.some(
            (s) =>
              s.payment_id === p.id &&
              s.settled_at <= now &&
              s.evidence_reference,
          ),
      ),
    );
    const posReady =
      !fees.error &&
      !settlements.error &&
      !receipts.error &&
      !settlementBounded &&
      cards.length > 0 &&
      configuredFees.length === cards.length &&
      reconciledCards.length === cards.length;
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
        status: team.error ? "manual" : teamReady ? "ready" : "pending",
        detail: `${enabledPeople.filter(professionalConfigured).length} de ${assigned.length} profesionales activos están asignados y tienen servicios habilitados. ${linked.length} cuentas vinculadas. El acceso personal se comprueba por separado.`,
        steps: team.error
          ? [
              {
                label: "Acceso personal",
                status: "manual",
                detail:
                  "No se pudo comprobar la cuenta y MFA de cada profesional. Puede faltar la migración del diagnóstico.",
              },
            ]
          : enabledPeople.map((p) => ({
              label: p.name,
              status:
                professionalConfigured(p)
                  ? "ready"
                  : "pending",
              detail: `Asignado a esta sucursal · ${p.capabilities} servicios habilitados.`,
            })),
        module: "equipo",
      },
      {
        key: "team_access", label: "Acceso personal del equipo", module: "equipo",
        status: team.error ? "manual" : enabledPeople.length > 0 && enabledPeople.every(professionalAccessReady) ? "ready" : "pending",
        detail: "Cada profesional confirma su correo, cambia la contraseña inicial y verifica MFA desde su propia cuenta.",
        steps: enabledPeople.map(p => ({ label: p.name, status: professionalAccessReady(p) ? "ready" : "pending",
          detail: `Cuenta ${p.linked ? "vinculada" : "pendiente"} · membresía ${p.membership ? "activa" : "pendiente"} · correo ${p.email_confirmed ? "confirmado" : "pendiente"} · contraseña inicial ${p.password_change_required === false ? "sustituida" : "por comprobar"} · ${p.mfa_required === false ? "MFA opcional para su rol" : `${p.verified_factors} factor(es) MFA verificado(s)`}.` })),
      },
      {
        key: "schedule",
        label: "Horarios del día",
        ...scheduleCheck,
        steps:
          (!schedule.error &&
            schedule.data?.people?.map(
              (p: { staff_id: string; state?: string }) => ({
                label:
                  team.data?.people?.find(
                    (s: { staff_id: string }) => s.staff_id === p.staff_id,
                  )?.name ?? "Profesional",
                status: p.state === "not_configured" ? "pending" : "ready",
                detail:
                  (
                    {
                      not_configured: "No configurado",
                      available: "Disponibilidad efectiva",
                      outside_shift: "Fuera de turno",
                      break: "Descanso obligatorio",
                      exhausted: "Agotado por reservas",
                      closed: "Cerrado",
                      blocked: "Bloqueado por ausencia, cierre o excepción",
                    } as Record<string, string>
                  )[p.state ?? ""] ??
                  "Horarios configurados; actualizar el diagnóstico para ver el estado detallado.",
              }),
            )) ||
          undefined,
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
        key: "pos",
        label: "Tarifas y conciliación POS",
        status:
          fees.error || settlements.error || receipts.error || settlementBounded
            ? "manual"
            : posReady
              ? "ready"
              : "pending",
        detail: fees.error
          ? "Error al consultar las tarifas. No se verificó su vigencia ni conciliación."
          : `${configuredFees.length} de ${cards.length} métodos de tarjeta tienen una regla vigente con referencia. Las liquidaciones, IVA, retenciones y cargos requieren evidencia de conciliación; crear un método no completa finanzas.`,
        steps: [
          {
            label: "Métodos de tarjeta",
            status: cards.length ? "ready" : "pending",
            detail: `${cards.length} métodos activos.`,
          },
          {
            label: "Tarifas y evidencia",
            status: fees.error
              ? "manual"
              : cards.length > 0 && configuredFees.length === cards.length
                ? "ready"
                : "pending",
            detail: `${configuredFees.length}/${cards.length} con tarifa vigente y referencia; no prueba una liquidación.`,
          },
          {
            label: "Liquidación real conciliada",
            status:
              settlements.error || receipts.error || settlementBounded
                ? "manual"
                : posReady
                  ? "ready"
                  : "pending",
            detail: `${reconciledCards.length}/${cards.length} métodos con acreditación conciliada para la versión vigente. No se generaron cobros de prueba.`,
          },
          {
            label: "Validación contable externa",
            status: "manual",
            detail:
              "La contadora debe comprobar condiciones, IVA y retenciones. Este diagnóstico no certifica ese control externo.",
          },
        ],
        module: "finanzas",
      },
      {
        key: "booking",
        label: "Reservas públicas",
        status: !booking ? "pending" : publicObservation.failed || publicAppointments.error ? "manual" : publicObservation.catalog && publicObservation.availability && publicEvidence ? "ready" : "pending",
        detail: booking
          ? publicObservation.catalog && publicObservation.availability && publicEvidence ? "Reservas habilitadas, catálogo y disponibilidad públicos comprobados. Ya existe una reserva pública registrada en esta sucursal." : "Reservas habilitadas. Revisá el resultado actual de cada comprobación del enlace público."
          : "Deshabilitadas por configuración. Es válido operar sin reservas online; habilitalas solo por decisión del propietario.",
        steps: [
          {
            label: "Flags de reservas",
            status: booking ? "ready" : "pending",
            detail: booking
              ? "Ambos flags habilitados."
              : "Reservas cerradas; conservar durante el piloto.",
          },
          {
            label: "Catálogo y disponibilidad",
            status:
              publicObservation.failed ? "manual" : publicObservation.catalog && publicObservation.availability
                ? "ready"
                : "pending",
            detail:
              "Lectura actual del contrato JSON y la disponibilidad pública. Un día cerrado o sin cupos puede devolver una lista vacía válida.",
          },
          {
            label: "Reserva pública registrada",
            status: publicAppointments.error ? "manual" : publicEvidence ? "ready" : "pending",
            detail:
              publicEvidence ? "Hay una cita creada por el booking público y vinculada a su cliente en esta sucursal." : "Todavía no se encontró una cita pública. Comprobar con una visita real autorizada; no crear datos ficticios en producción.",
          },
        ],
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
      status: security.allowed && verified >= 1 ? "ready" : "pending",
      detail:
        security.allowed && verified >= 1 ? "Tu sesión superó el control de seguridad y tenés MFA verificado. El respaldo y los controles externos se comprueban por separado." : "Tu cuenta todavía necesita verificar MFA.",
      module: "/mfa",
      steps: [
        {
          label: "Sesión actual",
          status: security.allowed && verified >= 1 ? "ready" : "pending",
          detail: `Sesión verificada y ${verified} factor(es) MFA registrado(s).`,
        },
        {
          label: "Autenticador de respaldo", status: verified >= 2 ? "ready" : "manual",
          detail: verified >= 2 ? "Hay un segundo factor verificado. Conservá su respaldo recuperable fuera del dispositivo habitual." : "No hay un segundo factor verificado. Comprobá tu recuperación independiente; este diagnóstico no la presume.",
        },
        {
          label: "Controles externos",
          status: "manual",
          detail:
            "Entrega SMTP, recuperación independiente, respaldo recuperable y recepción de alertas requieren evidencia externa.",
        },
      ],
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

type ScheduleObservation = {
  people: {
    configured: boolean;
    scheduled_today: boolean;
    effective: boolean;
    remaining: boolean;
    state?: string;
  }[];
};
export function describeSchedule(
  data: ScheduleObservation | null,
  failed: boolean,
  day: string,
): Pick<SetupCheck, "status" | "detail"> {
  if (failed)
    return {
      status: "manual",
      detail:
        "Error de lectura de disponibilidad. No se pudo verificar el horario efectivo.",
    };
  if (!data)
    return { status: "manual", detail: "Disponibilidad aún no consultada." };
  const configured = data.people.filter((p) => p.configured).length;
  const effective = data.people.filter((p) => p.effective).length;
  const remaining = data.people.filter((p) => p.remaining).length;
  if (!configured)
    return {
      status: "pending",
      detail:
        "No hay horarios semanales ni excepciones disponibles configurados para los profesionales activos.",
    };
  if (!effective)
    return {
      status: "ready",
      detail: data.people.some((p) => p.scheduled_today)
        ? `Horarios configurados; el ${day} está bloqueado por cierres, descansos o ausencias.`
        : `Horarios configurados; el ${day} es un día sin turno. No se abren turnos automáticamente.`,
    };
  return {
    status: "ready",
    detail: remaining
      ? `${configured} profesionales con horarios configurados; ${remaining} conservan disponibilidad efectiva el ${day}.`
      : `Horarios configurados; la disponibilidad del ${day} está agotada por reservas.`,
  };
}
