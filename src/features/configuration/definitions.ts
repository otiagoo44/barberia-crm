export type FieldDefinition = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "money"
    | "checkbox"
    | "time"
    | "date"
    | "datetime"
    | "color"
    | "select"
    | "reference";
  required?: boolean;
  options?: [string, string][];
  reference?: string;
  default?: string | number | boolean;
};
export type Definition = {
  title: string;
  singular: string;
  branch?: boolean;
  fields: FieldDefinition[];
};
const staff: FieldDefinition = {
  key: "staff_id",
  label: "Barbero",
  type: "reference",
  reference: "staff",
  required: true,
};
const service: FieldDefinition = {
  key: "service_id",
  label: "Servicio",
  type: "reference",
  reference: "services",
  required: true,
};
const weekday: FieldDefinition = {
  key: "weekday",
  label: "Día",
  type: "select",
  required: true,
  options: [
    ["0", "Domingo"],
    ["1", "Lunes"],
    ["2", "Martes"],
    ["3", "Miércoles"],
    ["4", "Jueves"],
    ["5", "Viernes"],
    ["6", "Sábado"],
  ],
};
const active: FieldDefinition = {
  key: "active",
  label: "Activo",
  type: "checkbox",
  default: true,
};
export const definitions: Record<string, Definition> = {
  branches: {
    title: "Sucursales",
    singular: "sucursal",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "slug", label: "Identificador de la URL", required: true },
      { key: "address", label: "Dirección" },
      { key: "phone", label: "Teléfono" },
      { key: "timezone", label: "Zona horaria", required: true },
      active,
    ],
  },
  staff: {
    title: "Barberos",
    singular: "barbero",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "slug", label: "Identificador público", required: true },
      { key: "color", label: "Color", type: "color", default: "#6fe2ff" },
      {
        key: "profile_id",
        label: "Cuenta del barbero (opcional)",
        type: "reference",
        reference: "organization_memberships",
      },
      active,
    ],
  },
  services: {
    title: "Servicios",
    singular: "servicio",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "slug", label: "Identificador público", required: true },
      { key: "description", label: "Descripción" },
      {
        key: "default_duration_minutes",
        label: "Duración (minutos)",
        type: "number",
        required: true,
      },
      {
        key: "composition_mode",
        label: "Cómo se combina",
        type: "select",
        default: "standalone",
        options: [
          ["standalone", "Servicio principal"],
          ["additive", "Adicional: suma duración"],
          ["included", "Incluido: conserva duración"],
          ["override", "Reemplaza duración del principal"],
        ],
      },
      {
        key: "base_service_id",
        label: "Servicio principal asociado",
        type: "reference",
        reference: "services",
      },
      {
        key: "suggested_return_days",
        label: "Volver en (días, opcional)",
        type: "number",
      },
      {
        key: "requires_maintenance",
        label: "Seguimiento de mantenimiento por servicio",
        type: "checkbox",
      },
      { key: "category", label: "Categoría" },
      { key: "color", label: "Color", type: "color", default: "#d8d3ff" },
      active,
    ],
  },
  branch_services: {
    title: "Servicios y precios del local",
    singular: "servicio del local",
    branch: true,
    fields: [
      service,
      {
        key: "duration_minutes",
        label: "Duración específica (opcional)",
        type: "number",
      },
      { key: "price_minor", label: "Precio (opcional)", type: "money" },
      active,
    ],
  },
  staff_branch_assignments: {
    title: "Barberos del local",
    singular: "asignación",
    branch: true,
    fields: [staff, active],
  },
  staff_service_capabilities: {
    title: "Servicios por barbero",
    singular: "capacidad de servicio",
    fields: [staff, service],
  },
  branch_business_hours: {
    title: "Horario de apertura",
    singular: "horario",
    branch: true,
    fields: [
      weekday,
      { key: "opens_at", label: "Abre", type: "time", required: true },
      { key: "closes_at", label: "Cierra", type: "time", required: true },
    ],
  },
  branch_closures: {
    title: "Cierres y aperturas especiales",
    singular: "excepción del local",
    branch: true,
    fields: [
      { key: "starts_at", label: "Desde", type: "datetime", required: true },
      { key: "ends_at", label: "Hasta", type: "datetime", required: true },
      {
        key: "kind",
        label: "Tipo",
        type: "select",
        default: "closed",
        options: [
          ["closed", "Cierre"],
          ["open", "Apertura extraordinaria"],
        ],
      },
      { key: "reason", label: "Motivo" },
    ],
  },
  staff_availability_rules: {
    title: "Disponibilidad semanal",
    singular: "horario del barbero",
    branch: true,
    fields: [
      staff,
      weekday,
      { key: "starts_at", label: "Desde", type: "time", required: true },
      { key: "ends_at", label: "Hasta", type: "time", required: true },
      { key: "valid_from", label: "Vigente desde (opcional)", type: "date" },
      { key: "valid_until", label: "Vigente hasta (opcional)", type: "date" },
    ],
  },
  staff_availability_exceptions: {
    title: "Horarios extraordinarios",
    singular: "excepción del barbero",
    branch: true,
    fields: [
      staff,
      { key: "local_date", label: "Fecha", type: "date", required: true },
      { key: "starts_at", label: "Desde", type: "time", required: true },
      { key: "ends_at", label: "Hasta", type: "time", required: true },
      {
        key: "available",
        label: "Disponible durante este intervalo",
        type: "checkbox",
        default: true,
      },
      { key: "reason", label: "Motivo" },
    ],
  },
  staff_time_off: {
    title: "Descansos y ausencias",
    singular: "ausencia",
    branch: true,
    fields: [
      staff,
      { key: "starts_at", label: "Desde", type: "datetime", required: true },
      { key: "ends_at", label: "Hasta", type: "datetime", required: true },
      { key: "reason", label: "Motivo" },
    ],
  },
  organization_settings: {
    title: "Preferencias del negocio",
    singular: "preferencia",
    fields: [
      {
        key: "booking_enabled",
        label: "Permitir reservas públicas",
        type: "checkbox",
      },
      {
        key: "booking_horizon_days",
        label: "Reservar hasta (días)",
        type: "number",
        required: true,
      },
      {
        key: "booking_lead_minutes",
        label: "Anticipación mínima (minutos)",
        type: "number",
        required: true,
      },
      {
        key: "slot_step_minutes",
        label: "Separación entre opciones de horario (minutos)",
        type: "number",
        required: true,
      },
      {
        key: "default_return_days",
        label: "Frecuencia de regreso por defecto (días, opcional)",
        type: "number",
      },
      {
        key: "retention_due_soon_days",
        label: "Avisar regreso próximo con (días)",
        type: "number",
        required: true,
      },
      {
        key: "retention_lapsed_days",
        label: "Considerar sin regreso después de (días)",
        type: "number",
        required: true,
      },
      {
        key: "barber_can_edit_availability",
        label: "Barberos pueden editar su disponibilidad",
        type: "checkbox",
      },
    ],
  },
  branch_settings: {
    title: "Reservas del local",
    singular: "configuración de reservas",
    branch: true,
    fields: [
      {
        key: "booking_enabled",
        label: "Permitir reservas públicas en este local",
        type: "checkbox",
      },
    ],
  },
  goals: {
    title: "Metas",
    singular: "meta",
    branch: true,
    fields: [
      { key: "name", label: "Nombre", required: true },
      {
        key: "staff_id",
        label: "Barbero (opcional)",
        type: "reference",
        reference: "staff",
      },
      {
        key: "metric",
        label: "Métrica",
        type: "select",
        required: true,
        default: "appointments_completed",
        options: [
          ["appointments_completed", "Visitas completadas"],
          ["services_completed", "Servicios completados"],
          ["rebookings", "Próximas visitas agendadas"],
          ["utilization", "Utilización (%)"],
          ["production_value", "Valor estimado de producción"],
        ],
      },
      {
        key: "target_value",
        label: "Objetivo",
        type: "number",
        required: true,
      },
      {
        key: "period",
        label: "Período",
        type: "select",
        default: "month",
        options: [
          ["day", "Día"],
          ["week", "Semana"],
          ["month", "Mes"],
          ["custom", "Personalizado"],
        ],
      },
      {
        key: "starts_at",
        label: "Desde (d?a completo)",
        type: "date",
        required: true,
      },
      {
        key: "ends_at",
        label: "Hasta (d?a completo)",
        type: "date",
        required: true,
      },
      active,
    ],
  },
};
