"use client";
import Link from "next/link";
import { useState } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl } from "@/lib/client";
import { Notice, Loading, Empty } from "@/components/ui";
import type { Page, Staff, DataRow } from "@/lib/types";
import { currencyScale } from "@/features/configuration/record-manager";
import { GoalCard } from "@/features/goals/goals";
type DashboardData = {
  totals: Record<string, number | null>;
  by_staff: {
    staff_id: string;
    name: string;
    completed: number;
    booked_minutes: number;
    available_minutes: number | null;
  }[];
  by_branch: {
    branch_id: string;
    name: string;
    completed: number;
    booked_minutes: number;
    available_minutes: number | null;
  }[];
  by_day: {
    local_date: string;
    completed: number;
    booked_minutes: number;
    available_minutes: number | null;
  }[];
  by_service: { service_id: string; name: string; completed: number }[];
  goals: DataRow[];
};
export function Dashboard({ report = false }: { report?: boolean }) {
  const w = useWorkspace();
  const today = formatInTimeZone(
    new Date(),
    w.organization.timezone,
    "yyyy-MM-dd",
  );
  const [preset, setPreset] = useState("7");
  const [from, setFrom] = useState(
    format(subDays(new Date(today + "T12:00:00"), 6), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(today);
  const [branch, setBranch] = useState(w.role === "manager" ? w.branchId : "");
  const [staff, setStaff] = useState(
    w.role === "barber" ? (w.staffId ?? "") : "",
  );
  const r = useResource<DashboardData>(
    resourceUrl("dashboard", {
      org: w.organization.id,
      branch: branch || null,
      staff: staff || null,
      from,
      to,
    }),
  );
  const people = useResource<Page<Staff>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  const t = r.data?.totals;
  const money = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "—"
      : new Intl.NumberFormat("es", {
          style: "currency",
          currency: w.organization.currency,
          maximumFractionDigits: 0,
        }).format(value / currencyScale(w.organization.currency));
  function period(value: string) {
    setPreset(value);
    if (value === "custom") return;
    setTo(today);
    setFrom(
      value === "month"
        ? format(startOfMonth(new Date(today + "T12:00:00")), "yyyy-MM-dd")
        : format(
            subDays(new Date(today + "T12:00:00"), Number(value) - 1),
            "yyyy-MM-dd",
          ),
    );
  }
  if (!w.branches.length)
    return (
      <section>
        <h1>Empecemos con tu barbería</h1>
        <p className="muted" style={{ marginTop: 16 }}>
          Configurá el negocio con datos reales. La agenda se habilita cuando
          cada local tiene equipo, servicios y horarios.
        </p>
        <div className="setup-steps">
          {[
            ["sucursales", "1", "Creá el primer local"],
            ["equipo", "2", "Agregá barberos y horarios"],
            ["servicios", "3", "Configurá servicios y precios"],
          ].map(([key, num, label]) => (
            <Link key={key} href={`/${w.organization.slug}/${key}`}>
              <span className="eyebrow">PASO {num}</span>
              <strong>{label}</strong>
              <span>Configurar →</span>
            </Link>
          ))}
        </div>
      </section>
    );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {w.role === "barber" ? "TU RENDIMIENTO" : "VISIÓN DEL NEGOCIO"}
          </span>
          <h1>
            {report
              ? "Reportes"
              : w.role === "manager"
                ? "Cómo va tu local"
                : "Cómo va tu barbería"}
          </h1>
          <p>Actividad, capacidad y metas del período que querés entender.</p>
        </div>
        <Link className="primary" href={`/${w.organization.slug}/agenda`}>
          Ver agenda →
        </Link>
      </div>
      <div className="toolbar">
        <select
          aria-label="Período"
          value={preset}
          onChange={(e) => period(e.target.value)}
        >
          <option value="1">Hoy</option>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
          <option value="month">Este mes</option>
          <option value="custom">Personalizado</option>
        </select>
        {preset === "custom" && (
          <>
            <input
              aria-label="Desde"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="Hasta"
              type="date"
              max={today}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        {w.branches.length > 1 && (
          <select
            aria-label="Filtrar sucursal"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">Sucursales permitidas</option>
            {w.branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        {w.role !== "barber" && (
          <select
            aria-label="Filtrar barbero"
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">Todo el equipo</option>
            {people.data?.items.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={r.reload}>Actualizar</button>
        <small>
          {from} → {to}
        </small>
      </div>
      {r.error && <Notice error>{r.error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {t && (
        <>
          <div className="kpi-grid">
            {[
              ["Servicios realizados", t.services_completed, null],
              ["Visitas completadas", t.completed, null],
              ["Reservas", t.appointments, null],
              [
                "Pendientes",
                Number(t.appointments ?? 0) -
                  Number(t.completed ?? 0) -
                  Number(t.cancelled ?? 0) -
                  Number(t.no_shows ?? 0),
                null,
              ],
              ["Clientes nuevos", t.new_customers, "Altas en el período"],
              [
                "Clientes recurrentes",
                t.recurring_customers,
                "Visitaron antes y regresaron",
              ],
              [
                "Utilización",
                t.utilization === null ? "—" : `${t.utilization}%`,
                t.unknown_capacity_days
                  ? "Hay días sin snapshot de capacidad"
                  : `${t.booked_minutes} / ${t.available_minutes ?? "—"} minutos`,
              ],
              ["Cancelaciones", t.cancelled, null],
              ["No-shows", t.no_shows, null],
              [
                "Rebooking",
                t.rebooking_rate === null ? "—" : `${t.rebooking_rate}%`,
                `${t.rebookings} próximas visitas`,
              ],
              [
                "Valor estimado",
                money(t.priced_completed ? t.production_value_minor : null),
                "Servicios con precio conocido; no representa cobros",
              ],
            ].map(([label, value, note], index) => (
              <article
                className={index === 0 ? "kpi highlight" : "kpi"}
                key={String(label)}
              >
                <span>{label}</span>
                <strong>{value ?? "—"}</strong>
                {note && <small>{note}</small>}
              </article>
            ))}
          </div>
          <p className="muted" style={{ marginBottom: 22 }}>
            Ticket promedio de visitas con precio:{" "}
            {money(t.average_priced_ticket_minor)} · {t.priced_completed} de{" "}
            {t.completed} visitas con precio conocido.
          </p>
          <div className="dashboard-grid">
            {!report &&
              r
                .data!.goals.filter((g) => g.active)
                .map((g) => <GoalCard key={g.id} goal={g} />)}
            <div className="panel">
              <h2>Producción por barbero</h2>
              {r.data!.by_staff.map((s) => (
                <div className="bar-row" key={s.staff_id}>
                  <span>{s.name}</span>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${Math.max(...r.data!.by_staff.map((s) => s.completed), 1) ? (s.completed / Math.max(...r.data!.by_staff.map((s) => s.completed), 1)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <strong>{s.completed}</strong>
                </div>
              ))}
              {!r.data!.by_staff.length && (
                <Empty title="Sin actividad registrada" />
              )}
            </div>
            <div className="panel">
              <h2>Capacidad por local</h2>
              {r.data!.by_branch.map((b) => (
                <div className="list-item" key={b.branch_id}>
                  <div className="row between">
                    <strong>{b.name}</strong>
                    <span>
                      {b.available_minutes
                        ? Math.round(
                            (b.booked_minutes / b.available_minutes) * 100,
                          ) + "%"
                        : "—"}
                    </span>
                  </div>
                  <small>
                    {b.booked_minutes} min reservados ·{" "}
                    {b.available_minutes ?? "—"} min disponibles
                  </small>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Servicios completados</h2>
              {r.data!.by_service.map((s) => (
                <div className="list-item row between" key={s.service_id}>
                  <span>{s.name}</span>
                  <strong>{s.completed}</strong>
                </div>
              ))}
              {!r.data!.by_service.length && (
                <p className="muted" style={{ marginTop: 16 }}>
                  Sin servicios agregados para este período.
                </p>
              )}
            </div>
            <div className="panel">
              <h2>Ocupación por día</h2>
              {r.data!.by_day.map((d) => (
                <div className="list-item row between" key={d.local_date}>
                  <span>{d.local_date}</span>
                  <span>
                    {d.available_minutes
                      ? Math.round(
                          (d.booked_minutes / d.available_minutes) * 100,
                        ) + "%"
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
