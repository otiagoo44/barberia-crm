/** Only explicit domain tokens / named constraints reach the browser. Never raw SQL details. */
export function operationError(
  error: unknown,
): { message: string; field?: string } | undefined {
  if (!error || typeof error !== "object") return;
  const e = error as { message?: string; code?: string; details?: string };
  const known: Record<string, { message: string; field?: string }> = {
    price_change_reason_required: {
      message: "Indicá el motivo del precio diferente al catálogo.",
      field: "reason",
    },
    invalid_income: {
      message: "Elegí un concepto e ingresá un importe mayor que cero.",
    },
    source_already_imported: {
      message: "Este archivo ya fue importado. No se duplicaron movimientos.",
    },
    preview_changed: {
      message:
        "La revisión cambió. Volvé a analizar el archivo antes de confirmar.",
    },
    authorized_adjustment_required: {
      message:
        "Un propietario o Finanzas debe indicar el motivo del ajuste de precio autorizado.",
      field: "reason",
    },
    positive_payment_required: {
      message: "Ingresá un importe de cobro mayor que cero.",
      field: "amount_minor",
    },
    invalid_payment_method: {
      message: "Elegí un medio de pago activo de esta organización.",
      field: "payment_method_id",
    },
    fee_rule_required: {
      message:
        "No existe tarifa vigente para este método. Revisá Métodos de pago y tarifas antes de cobrar.",
      field: "payment_method_id",
    },
    payment_exceeds_balance: {
      message: "El cobro supera el importe pendiente.",
      field: "amount_minor",
    },
    overpayment: {
      message: "El cobro supera el importe pendiente.",
      field: "amount_minor",
    },
    open_cash_session_required: {
      message:
        "La caja está cerrada. Abrí la caja de esta sucursal antes de registrar efectivo.",
    },
    staff_capability_required: {
      message: "Falta habilitar este servicio para el profesional en Luque.",
      field: "staff_id",
    },
    service_price_required: {
      message: "Falta configurar el precio del servicio en esta sucursal.",
    },
    catalog_item_required: {
      message: "Elegí un servicio o concepto habilitado en esta sucursal.",
      field: "service_id",
    },
    completed_appointment_required: {
      message: "Completá la atención antes de preparar el cobro.",
    },
    checkout_already_exists: {
      message: "Esta atención ya tiene un cobro. Abrí el registro existente.",
    },
    draft_checkout_required: {
      message:
        "El cobro ya fue registrado o dejó de ser un borrador. Actualizá la vista.",
    },
    authorized_price_required: {
      message:
        "Un propietario o Finanzas debe autorizar el precio e indicar el motivo.",
      field: "price_minor",
    },
    schedule_conflicts_with_bookings: {
      message:
        "El horario afecta reservas existentes. Reasignalas antes de reducir los turnos.",
    },
    prospective_schedule_required: {
      message:
        "Elegí una fecha a partir de mañana para conservar los horarios históricos.",
      field: "effective_from",
    },
    invalid_weekly_blocks: {
      message:
        "Revisá los días, los intervalos y los descansos; no pueden solaparse.",
    },
    weekly_schedule_upgrade_required: {
      message:
        "El editor semanal requiere una actualización de base pendiente. Podés consultar los horarios guardados.",
    },
    stale_weekly_schedule: {
      message:
        "Otra persona cambió los horarios. Volvé a cargar la semana antes de guardar.",
    },
    payment_exceeds_total: {
      message: "El cobro supera el importe pendiente.",
      field: "amount_minor",
    },
  };
  if (e.message && known[e.message]) return known[e.message];
  if (
    e.code === "23505" &&
    /services_organization_id_slug_key/.test(
      (e.message ?? "") + (e.details ?? ""),
    )
  )
    return {
      message:
        "Ya existe un servicio con ese identificador. Editá el existente o elegí otro.",
      field: "slug",
    };
  if (
    e.code === "23514" &&
    /services_website_category_check/.test(e.message ?? "")
  )
    return {
      message: "Elegí una sección válida del sitio o dejala sin sección.",
      field: "website_category",
    };
  if (e.code === "23514" && /rulos_consultation_required/.test(e.message ?? ""))
    return {
      message: "Rulos requiere consulta previa.",
      field: "consultation_required",
    };
}
