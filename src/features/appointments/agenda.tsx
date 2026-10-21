"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl, api } from "@/lib/client";
import { statusLabels, statuses, date as validDate } from "@/lib/validation";
import { useLive } from "@/hooks/use-live";
import { Badge, Empty, Loading, Notice } from "@/components/ui";
import type { Appointment, Page, Staff, Service, DataRow } from "@/lib/types";
import { BookingForm } from "./booking-form";
import { AppointmentDialog } from "./appointment-dialog";
import { TimeCalendar } from "./time-calendar";
export function Agenda({ compact = false }: { compact?: boolean }) {
  const w = useWorkspace();
  const q = useSearchParams();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const [requestedDate, setDate] = useState(
    q.get("date") ?? formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
  );
  const selectedDate = validDate.safeParse(requestedDate).success
    ? requestedDate
    : formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const [mode, setMode] = useState("day");
  const [layout, setLayout] = useState("time");
  const [staff, setStaff] = useState(
    w.role === "barber" ? (w.staffId ?? "") : (q.get("staff") ?? ""),
  );
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [booking, setBooking] = useState(false);
  const [chosen, setChosen] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const local = new Date(selectedDate + "T12:00:00");
  const begin =
    mode === "week"
      ? format(startOfWeek(local, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : selectedDate;
  const end = format(
    addDays(new Date(begin + "T12:00:00"), mode === "week" ? 7 : 1),
    "yyyy-MM-dd",
  );
  const from = fromZonedTime(begin + "T00:00:00", tz).toISOString(),
    to = fromZonedTime(end + "T00:00:00", tz).toISOString();
  const r = useResource<Page<Appointment>>(
    w.branchId
      ? resourceUrl("agenda", {
          org: w.organization.id,
          branch: w.branchId,
          staff: staff || null,
          service: service || null,
          status: status || null,
          from,
          to,
        })
      : null,
  );
  const people = useResource<Page<Staff>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  const assignment = useResource<Page<DataRow>>(
    w.branchId
      ? resourceUrl("staff_branch_assignments", {
          org: w.organization.id,
          branch: w.branchId,
        })
      : null,
  );
  const catalog = useResource<Page<Service>>(
    resourceUrl("services", { org: w.organization.id }),
  );
  const live = useLive(w.organization.id, w.branchId, (change) => {
    if (change.type === "reconnected" || change.type === "visible") {
      r.reload();
      return;
    }
    if (change.table !== "appointments" || !change.id) return;
    if (change.type === "remove") {
      r.setData((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((a) => a.id !== change.id),
            }
          : current,
      );
      return;
    }
    void api<Appointment>(
      resourceUrl("appointment", { org: w.organization.id, id: change.id }),
    )
      .then((a) => {
        r.setData((current) => {
          if (!current) return current;
          const keep =
            new Date(a.starts_at) < new Date(to) &&
            new Date(a.ends_at) > new Date(from) &&
            a.branch_id === w.branchId &&
            (!staff || a.staff_id === staff) &&
            (!status || a.status === status) &&
            (!service || a.services.some((s) => s.id === service));
          return {
            ...current,
            items: [
              ...current.items.filter((x) => x.id !== a.id),
              ...(keep ? [a] : []),
            ].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
          };
        });
      })
      .catch(() =>
        setError(
          "No pudimos sincronizar el último cambio. Actualizá la agenda.",
        ),
      );
  });
  const columns = (people.data?.items ?? []).filter(
    (s) =>
      (!staff || s.id === staff) &&
      assignment.data?.items.some((a) => a.staff_id === s.id && a.active),
  );
  const days = Array.from({ length: mode === "week" ? 7 : 1 }, (_, i) =>
    format(addDays(new Date(begin + "T12:00:00"), i), "yyyy-MM-dd"),
  );
  if (!w.branchId)
    return (
      <Empty title="Tu organización todavía no tiene sucursales">
        Configurá un local para empezar a trabajar.
      </Empty>
    );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERACIÓN DIARIA</span>
          <h1>{compact ? "Tu día en la barbería" : "Agenda"}</h1>
          <p>
            Organizá el trabajo de cada barbero, sin perder de vista al cliente.
          </p>
        </div>
        {w.role !== "barber" && (
          <button className="primary" onClick={() => setBooking(true)}>
            + Nueva reserva
          </button>
        )}
      </div>
      <div className="toolbar">
        <div className="segmented">
          <button
            className={
              selectedDate === formatInTimeZone(new Date(), tz, "yyyy-MM-dd") &&
              mode === "day"
                ? "selected"
                : ""
            }
            onClick={() => {
              setDate(formatInTimeZone(new Date(), tz, "yyyy-MM-dd"));
              setMode("day");
            }}
          >
            Hoy
          </button>
          <button
            className={mode === "day" ? "selected" : ""}
            onClick={() => setMode("day")}
          >
            Día
          </button>
          <button
            className={mode === "week" ? "selected" : ""}
            onClick={() => setMode("week")}
          >
            Semana
          </button>
        </div>
        <button
          aria-label="Período anterior"
          onClick={() =>
            setDate(
              format(addDays(local, mode === "week" ? -7 : -1), "yyyy-MM-dd"),
            )
          }
        >
          ←
        </button>
        <input
          aria-label="Fecha de agenda"
          type="date"
          value={selectedDate}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          aria-label="Período siguiente"
          onClick={() =>
            setDate(
              format(addDays(local, mode === "week" ? 7 : 1), "yyyy-MM-dd"),
            )
          }
        >
          →
        </button>
        {w.role !== "barber" && (
          <select
            aria-label="Filtrar por barbero"
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">Todos los barberos</option>
            {people.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filtrar por servicio"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="">Todos los servicios</option>
          {catalog.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button onClick={r.reload}>Actualizar</button>
        <div className="segmented" aria-label="Presentación de agenda">
          <button
            aria-pressed={layout === "time"}
            className={layout === "time" ? "selected" : ""}
            onClick={() => setLayout("time")}
          >
            Calendario
          </button>
          <button
            aria-pressed={layout === "list"}
            className={layout === "list" ? "selected" : ""}
            onClick={() => setLayout("list")}
          >
            Lista
          </button>
        </div>
        <span className="realtime-state">{live}</span>
      </div>
      {(r.error || error) && <Notice error>{r.error || error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {r.data?.has_more && (
        <Notice>
          Este rango contiene más de 2.000 reservas. Reducí el rango o filtrá
          por barbero.
        </Notice>
      )}
      {!columns.length && !people.loading && (
        <Empty title="No hay barberos asignados a este local">
          Asigná el equipo y sus horarios para habilitar la agenda.
        </Empty>
      )}
      <p className="result-note">
        La escala muestra citas registradas. Los espacios vacíos no indican
        disponibilidad; consultá los horarios reales al reservar.
      </p>
      {days.map((day) => (
        <section key={day} className="day-section">
          {mode === "week" && (
            <h2>
              {new Date(day + "T12:00:00").toLocaleDateString("es", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </h2>
          )}
          {layout === "time" && r.data ? (
            <TimeCalendar
              day={day}
              tz={tz}
              staff={columns}
              appointments={r.data.items}
              onChoose={setChosen}
            />
          ) : (
            <div className="calendar-grid">
              {columns.map((s) => {
                const rows =
                  r.data?.items.filter(
                    (a) =>
                      a.staff_id === s.id &&
                      formatInTimeZone(a.starts_at, tz, "yyyy-MM-dd") === day,
                  ) ?? [];
                return (
                  <section className="staff-column" key={s.id}>
                    <header>
                      <strong>
                        <span
                          className="staff-dot"
                          style={{ background: s.color }}
                        />
                        {s.name}
                      </strong>
                      <small>{rows.length} citas</small>
                    </header>
                    {rows.map((a) => (
                      <button
                        className={`appointment-card ${a.status}`}
                        key={a.id}
                        onClick={() => setChosen(a)}
                      >
                        <span className="appointment-time">
                          {formatInTimeZone(a.starts_at, tz, "HH:mm")}–
                          {formatInTimeZone(a.ends_at, tz, "HH:mm")} ·{" "}
                          {a.duration_minutes} min
                        </span>
                        <span className="appointment-name">
                          {a.customer_name}
                        </span>
                        <span className="appointment-services">
                          {a.services.map((s) => s.name).join(" + ")}
                        </span>
                        <Badge
                          status={a.status}
                          label={statusLabels[a.status]}
                        />
                      </button>
                    ))}
                    {!rows.length && (
                      <p className="muted">Sin reservas en este rango.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      ))}
      {booking && (
        <BookingForm
          onClose={() => setBooking(false)}
          onSaved={() => {
            setBooking(false);
            r.reload();
          }}
        />
      )}
      {chosen && (
        <AppointmentDialog
          appointment={chosen}
          onClose={() => setChosen(null)}
          onChanged={(a) =>
            r.setData((current) =>
              current
                ? {
                    ...current,
                    items: current.items.map((x) => (x.id === a.id ? a : x)),
                  }
                : current,
            )
          }
        />
      )}
    </section>
  );
}
