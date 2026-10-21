"use client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { statusLabels } from "@/lib/validation";
import type { Appointment, Staff, DataRow } from "@/lib/types";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl } from "@/lib/client";
import { useClock } from "@/hooks/use-clock";
import { Notice } from "@/components/ui";
/** A clock scale represents booked intervals, never inferred availability. */
export function TimeCalendar({
  day,
  tz,
  staff,
  appointments,
  onChoose,
}: {
  day: string;
  tz: string;
  staff: Staff[];
  appointments: Appointment[];
  onChoose: (a: Appointment) => void;
}) {
  const w = useWorkspace();
  const now = useClock();
  const blocks = useResource<{ items: DataRow[] }>(
    resourceUrl("daily_availability", {
      org: w.organization.id,
      branch: w.branchId,
      date: day,
    }),
  );
  const origin = fromZonedTime(day + "T00:00:00", tz).getTime();
  const elapsed = (time: string) => (new Date(time).getTime() - origin) / 60000;
  const localMinute = (time: string) =>
    elapsed(fromZonedTime(day + "T" + time, tz).toISOString());
  const visibleBlocks =
    blocks.data?.items.filter((b) => staff.some((s) => s.id === b.staff_id)) ??
    [];
  const rows = appointments.filter(
    (a) => formatInTimeZone(a.starts_at, tz, "yyyy-MM-dd") === day,
  );
  const minute = elapsed;
  const first = Math.min(
    Math.floor(localMinute("08:00:00") / 60),
    ...rows.map((a) => Math.floor(minute(a.starts_at) / 60)),
    ...visibleBlocks.map((b) =>
      Math.floor(localMinute(String(b.starts_at)) / 60),
    ),
  );
  const last = Math.min(
    26,
    Math.max(
      Math.ceil(localMinute("20:00:00") / 60),
      ...rows.map((a) =>
        Math.ceil((minute(a.starts_at) + a.duration_minutes) / 60),
      ),
      ...visibleBlocks.map((b) =>
        Math.ceil(localMinute(String(b.ends_at)) / 60),
      ),
    ),
  );
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  return (
    <>
      {blocks.error && <Notice error>Horarios del día: {blocks.error}</Notice>}
      <div
        className="time-calendar"
        tabIndex={0}
        role="region"
        aria-label={`Calendario horario del ${day}. Desplazable con teclado.`}
      >
        <div
          className="time-calendar-grid"
          style={{
            gridTemplateColumns: `56px repeat(${staff.length}, minmax(220px, 1fr))`,
          }}
        >
          <div className="time-calendar-header time-axis-head">Hora</div>
          {staff.map((s) => (
            <header className="time-calendar-header" key={s.id}>
              <strong>{s.name}</strong>
              <small>
                {rows.filter((a) => a.staff_id === s.id).length} citas ·{" "}
                {visibleBlocks.some((b) => b.staff_id === s.id)
                  ? "Franjas confirmadas"
                  : "Disponibilidad sin confirmar"}
              </small>
            </header>
          ))}
          <div className="time-axis" style={{ height: (last - first) * 120 }}>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - first) * 120 }}>
                {formatInTimeZone(origin + h * 3600000, tz, "HH:mm")}
              </span>
            ))}
          </div>
          {staff.map((s) => (
            <div
              className="time-lane"
              key={s.id}
              style={{ height: (last - first) * 120 }}
            >
              {visibleBlocks
                .filter((b) => b.staff_id === s.id)
                .map((b) => (
                  <div
                    key={b.id}
                    className={`calendar-availability ${b.available ? "available" : "unavailable"}`}
                    style={{
                      top: (localMinute(String(b.starts_at)) - first * 60) * 2,
                      height:
                        (localMinute(String(b.ends_at)) -
                          localMinute(String(b.starts_at))) *
                        2,
                    }}
                  >
                    <span>
                      {b.available
                        ? "Disponible"
                        : String(b.reason || "Descanso / ausencia")}
                    </span>
                  </div>
                ))}
              {hours.map((h) => (
                <div
                  aria-hidden="true"
                  className="time-line"
                  key={h}
                  style={{ top: (h - first) * 120 }}
                />
              ))}
              {rows
                .filter(
                  (a) =>
                    a.staff_id === s.id &&
                    !["cancelled", "no_show"].includes(a.status),
                )
                .map((a) => (
                  <button
                    key={a.id}
                    className={`appointment-card calendar-event ${a.status}`}
                    style={{
                      top: (minute(a.starts_at) - first * 60) * 2,
                      height: (minute(a.ends_at) - minute(a.starts_at)) * 2,
                    }}
                    onClick={() => onChoose(a)}
                    aria-label={`${formatInTimeZone(a.starts_at, tz, "HH:mm")} a ${formatInTimeZone(a.ends_at, tz, "HH:mm")} · ${a.customer_name} · ${a.services.map((s) => s.name).join(", ")} · ${statusLabels[a.status]}`}
                  >
                    <span className="appointment-time">
                      {formatInTimeZone(a.starts_at, tz, "HH:mm")}–
                      {formatInTimeZone(a.ends_at, tz, "HH:mm")}
                    </span>
                    <strong className="appointment-name">
                      {a.customer_name}
                    </strong>
                    <span className="calendar-status">
                      {statusLabels[a.status]}
                    </span>
                  </button>
                ))}
              {formatInTimeZone(now, tz, "yyyy-MM-dd") === day &&
                (now - origin) / 60000 >= first * 60 &&
                (now - origin) / 60000 < last * 60 && (
                  <div
                    className="calendar-now"
                    style={{ top: ((now - origin) / 60000 - first * 60) * 2 }}
                    aria-label={`Hora actual ${formatInTimeZone(now, tz, "HH:mm")}`}
                  />
                )}
            </div>
          ))}
        </div>
      </div>
      {rows.some((a) => ["cancelled", "no_show"].includes(a.status)) && (
        <div className="calendar-inactive">
          <strong>Cancelaciones y ausencias</strong>
          {rows
            .filter((a) => ["cancelled", "no_show"].includes(a.status))
            .map((a) => (
              <button key={a.id} onClick={() => onChoose(a)}>
                {formatInTimeZone(a.starts_at, tz, "HH:mm")} · {a.customer_name}{" "}
                · {statusLabels[a.status]}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
