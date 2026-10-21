"use client";
import Link from "next/link";
import { useState } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl } from "@/lib/client";
import { Notice, Loading } from "@/components/ui";
import type { Page, Staff, DataRow } from "@/lib/types";
import { currencyScale } from "@/features/configuration/record-manager";
import { GoalCard } from "@/features/goals/goals";
import { FinancialDashboard } from "@/features/finance/dashboard";
import { LaunchGuide } from "@/features/organizations/launch-guide";
import { DayOverview } from "./day-overview";
import { DataChart } from "@/components/chart";
import { chartInteger, utilization } from "@/lib/chart-values";
import { ReceptionHome } from "./operation-home";
import { ViewSwitcher, DateRangePicker } from "@/components/workspace-ui";
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
    appointments: number;
    cancelled: number;
    no_shows: number;
    rebookings: number;
  }[];
  by_service: { service_id: string; name: string; completed: number }[];
  goals: DataRow[];
};
export function Dashboard({ report = false }: { report?: boolean }) {
  const w = useWorkspace();
  if (!report && w.role === "receptionist") return <ReceptionHome />;
  if (w.role === "finance")
    return (
      <section className="stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">CONTROL FINANCIERO</span>
            <h1>{report ? "Reportes financieros" : "Revisión financiera"}</h1>
            <p>Cobros, cierres, gastos y operaciones pendientes de revisión.</p>
          </div>
        </div>
        <FinancialDashboard />
      </section>
    );
  return <OperationalDashboard report={report} />;
}
function OperationalDashboard({ report }: { report: boolean }) {
  const w = useWorkspace();
  const [view, setView] = useState("operation");
  const today = formatInTimeZone(
    new Date(),
    w.organization.timezone,
    "yyyy-MM-dd",
  );
  const [preset, setPreset] = useState(report ? "7" : "1");
  const [from, setFrom] = useState(
    report
      ? format(subDays(new Date(today + "T12:00:00"), 6), "yyyy-MM-dd")
      : today,
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
                : w.role === "barber"
                  ? "Tu jornada y rendimiento"
                  : "Cómo va tu barbería"}
          </h1>
          <p>
            {report
              ? "Actividad, capacidad y seguimiento con datos del período."
              : "Agenda, atención y resultados para organizar el día."}
          </p>
        </div>
        <Link className="primary" href={`/${w.organization.slug}/agenda`}>
          Ver agenda →
        </Link>
      </div>
      {!report && <DayOverview />}
      {!report && w.role === "organization_owner" && <LaunchGuide />}
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
          <DateRangePicker
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
            max={today}
          />
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
      {w.role !== "barber" && w.role !== "receptionist" && !staff && (
        <FinancialDashboard
          compact
          periodFrom={from}
          periodTo={to}
          branchId={branch || w.branchId}
        />
      )}
      {r.error && <Notice error>{r.error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {report && (
        <ViewSwitcher
          value={view}
          onChange={setView}
          label="Área del reporte"
          options={[
            ["operation", "Operación"],
            ["retention", "Clientes y retorno"],
            ["team", "Equipo y servicios"],
          ]}
        />
      )}
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
            ]
              .filter(
                ([label]) =>
                  report ||
                  [
                    "Reservas",
                    "Pendientes",
                    "Visitas completadas",
                    "Utilización",
                  ].includes(String(label)),
              )
              .map(([label, value, note], index) => (
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
            <DataChart
              title="Reservas y atención"
              description={`${from} a ${to} · cantidad por día`}
              data={r.data!.by_day.map((d) => ({
                label: d.local_date.slice(5),
                reservas: chartInteger(d.appointments),
                atendidas: chartInteger(d.completed),
              }))}
              series={[
                { key: "reservas", label: "Reservas" },
                { key: "atendidas", label: "Completadas" },
              ]}
            />
            <DataChart
              title="Ocupación por profesional"
              description="Minutos reservados / capacidad conocida"
              kind="bar"
              percent
              data={r.data!.by_staff.map((d) => ({
                label: d.name,
                value: utilization(d.booked_minutes, d.available_minutes),
              }))}
              series={[{ key: "value", label: "Ocupación" }]}
            />
            {report && view === "retention" && (
              <>
                <DataChart
                  title="Cancelaciones y ausencias"
                  description="Cantidad por día"
                  data={r.data!.by_day.map((d) => ({
                    label: d.local_date.slice(5),
                    cancelled: chartInteger(d.cancelled),
                    no_shows: chartInteger(d.no_shows),
                  }))}
                  series={[
                    { key: "cancelled", label: "Canceladas" },
                    { key: "no_shows", label: "No se presentó" },
                  ]}
                />
                <DataChart
                  title="Próxima visita"
                  description="Rebooking registrado por día"
                  kind="bar"
                  data={r.data!.by_day.map((d) => ({
                    label: d.local_date.slice(5),
                    value: chartInteger(d.rebookings),
                  }))}
                  series={[{ key: "value", label: "Rebooking" }]}
                />
                <DataChart
                  title="Clientes del período"
                  description="Altas y clientes que regresaron; métricas independientes"
                  kind="bar"
                  data={[
                    { label: "Nuevos", value: chartInteger(t.new_customers) },
                    {
                      label: "Recurrentes",
                      value: chartInteger(t.recurring_customers),
                    },
                  ]}
                  series={[{ key: "value", label: "Clientes" }]}
                />
              </>
            )}
            {!report &&
              r
                .data!.goals.filter((g) => g.active)
                .map((g) => <GoalCard key={g.id} goal={g} />)}
            {report && view === "team" && (
              <>
                <DataChart
                  title="Ocupación por sucursal"
                  description="Solo capacidad conocida · porcentaje"
                  kind="bar"
                  percent
                  data={r.data!.by_branch.map((d) => ({
                    label: d.name,
                    value: utilization(d.booked_minutes, d.available_minutes),
                  }))}
                  series={[{ key: "value", label: "Ocupación" }]}
                />
                <DataChart
                  title="Servicios más realizados"
                  description="Servicios completados del período · cantidad"
                  kind="bar"
                  horizontal
                  data={r.data!.by_service.slice(0, 20).map((d) => ({
                    label: d.name,
                    value: chartInteger(d.completed),
                  }))}
                  series={[{ key: "value", label: "Servicios" }]}
                />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
