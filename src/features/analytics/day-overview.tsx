"use client";
import Link from "next/link";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { resourceUrl, useResource } from "@/lib/client";
import type { Appointment, Page } from "@/lib/types";
import { Notice } from "@/components/ui";
import { useClock } from "@/hooks/use-clock";
export function DayOverview() {
  const w = useWorkspace();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const now = useClock();
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const start = fromZonedTime(today + "T00:00:00", tz);
  const nextDay = new Date(today + "T12:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const r = useResource<Page<Appointment>>(
    w.branchId
      ? resourceUrl("agenda", {
          org: w.organization.id,
          branch: w.branchId,
          staff: w.role === "barber" ? w.staffId : null,
          from: start.toISOString(),
          to: fromZonedTime(
            nextDay.toISOString().slice(0, 10) + "T00:00:00",
            tz,
          ).toISOString(),
        })
      : null,
  );
  const next = r.data?.items.find(
    (a) =>
      ["scheduled", "confirmed", "checked_in", "in_service"].includes(
        a.status,
      ) && new Date(a.ends_at).getTime() > now,
  );
  return (
    <>
      <div className="day-control">
        <div>
          <h2>Tu jornada</h2>
          <small>
            {formatInTimeZone(now, tz, "dd/MM/yyyy")} ·{" "}
            {w.branches.find((b) => b.id === w.branchId)?.name}
          </small>
        </div>
        <div style={{ flex: 1 }}>
          <strong>
            {r.loading
              ? "Consultando agenda…"
              : next
                ? `${formatInTimeZone(next.starts_at, tz, "HH:mm")} · ${next.customer_name}`
                : "Sin próximas citas hoy"}
          </strong>
          <p className="muted">
            {next
              ? next.services.map((s) => s.name).join(" + ")
              : "La disponibilidad se carga con los horarios reales del equipo."}
          </p>
        </div>
        <Link href={`/${w.organization.slug}/agenda`}>Abrir agenda →</Link>
        {w.role !== "barber" && (
          <Link href={`/${w.organization.slug}/walk-ins`}>
            Recibir sin cita →
          </Link>
        )}
      </div>
      {r.error && <Notice error>{r.error}</Notice>}
    </>
  );
}
