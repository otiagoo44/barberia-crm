import { formatInTimeZone } from "date-fns-tz";
import { normalizePhone, phone } from "./validation";

// Only called after the booking API has returned a successful confirmation.
// The branch phone comes from the public catalog; no tenant-specific fallback.
export function bookingWhatsAppUrl(input: {
  phone?: string | null;
  organization: string;
  branch: string;
  timezone: string;
  reference: string;
  startsAt: string;
  durationMinutes: number;
  services: string[];
  requestedStaff?: string;
}): string | null {
  const number = normalizePhone(input.phone ?? "");
  if (!phone.safeParse(number).success) return null;
  const message = [
    `Hola, registré un turno en ${input.organization} · ${input.branch}.`,
    `Servicio: ${input.services.join(" + ")}`,
    ...(input.requestedStaff ? [`Profesional solicitado: ${input.requestedStaff}`] : []),
    `Fecha y hora: ${formatInTimeZone(input.startsAt, input.timezone, "dd/MM/yyyy · HH:mm")} (hora del local)`,
    `Duración: ${input.durationMinutes} min`,
    `Referencia: ${input.reference}`,
  ].join("\n");
  return `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(message)}`;
}
