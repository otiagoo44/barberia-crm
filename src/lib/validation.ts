import { z } from "zod";
export const uuid = z.uuid();
export const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
export const phone = z.string().regex(/^\+[1-9][0-9]{7,14}$/);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  });
export function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, "");
}
export const customerInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    normalized_phone: phone,
    email: z.union([z.email().max(254), z.literal("")]).optional(),
  })
  .strict();
export const statuses = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_service",
  "completed",
  "no_show",
  "cancelled",
  "rescheduled",
] as const;
export const statusLabels: Record<string, string> = {
  scheduled: "Reservado",
  confirmed: "Confirmado",
  checked_in: "Presente",
  in_service: "En servicio",
  completed: "Completado",
  no_show: "No asistió",
  cancelled: "Cancelado",
  rescheduled: "Reprogramado",
};
export const retentionLabels: Record<string, string> = {
  active: "Activo",
  due_soon: "Por volver",
  due: "Le toca volver",
  overdue: "Atrasado",
  lapsed: "Sin regresar",
};
export const roleLabels: Record<string, string> = {
  platform_admin: "Administración de plataforma",
  organization_owner: "Propietario",
  manager: "Encargado",
  receptionist: "Recepción",
  barber: "Barbero",
  finance: "Finanzas",
};
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
