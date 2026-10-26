"use client";
import { useState } from "react";
import { DateRangePicker } from "@/components/workspace-ui";
import { DataChart } from "@/components/chart";
import { chartInteger } from "@/lib/chart-values";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource } from "@/lib/client";
import { hasCapability } from "@/lib/capabilities";
import { Field, Notice, Loading, Empty, Modal } from "@/components/ui";
import {
  financeUrl,
  money,
  type FinanceRow,
  type FinanceCatalog,
} from "./client";
import { FinanceForm } from "./forms";
import { FinanceImport } from "./import-ui";
import { FinancialCharts } from "./financial-charts";
import { StaffFinancialCharts } from "./staff-charts";
import { PartnerDistributions } from "./partner-distributions";
import {
  ProfitSharing,
  RemunerationSettings,
  type ProfitSharingSummary,
} from "./profit-sharing";
type Summary = {
  profit_sharing?: ProfitSharingSummary | null;
  totals?: Record<string, number | string | null>;
  staff: FinanceRow[];
  methods?: FinanceRow[];
  service_mix?: FinanceRow[];
  staff_only?: boolean;
};
const tabs = [
  ["summary", "Resumen"],
  ["movements", "Movimientos"],
  ["expenses", "Gastos"],
  ["settlements", "Barberos / Liquidaciones"],
  ["closures", "Cierres"],
  ["partners", "Distribuciones a socios"],
  ["catalog", "Configuración financiera"],
] as const;
export function FinancialDashboard({
  compact = false,
  periodFrom,
  periodTo,
  branchId,
}: {
  compact?: boolean;
  periodFrom?: string;
  periodTo?: string;
  branchId?: string;
}) {
  const w = useWorkspace();
  const org = w.organization.id;
  const branch = branchId || w.branchId;
  const today = formatInTimeZone(
    new Date(),
    w.branches.find((b) => b.id === branch)?.timezone ??
      w.organization.timezone,
    "yyyy-MM-dd",
  );
  const [tab, setTab] = useState<string>("summary");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<{
    action: string;
    initial?: Record<string, unknown>;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [staff, setStaff] = useState("");
  const privileged = hasCapability(w.role, "finance.configure");
  const r = useResource<Summary & { items?: FinanceRow[] }>(
    branch && tab !== "partners"
      ? financeUrl(tab, org, branch, periodFrom ?? from, periodTo ?? to, {
          q: query,
          offset: String(offset),
        })
      : null,
  );
  const catalog = useResource<FinanceCatalog>(
    !compact && branch ? financeUrl("catalog", org, branch, today) : null,
  );
  const cash = useResource<{ session: FinanceRow | null }>(
    !compact && branch && form ? financeUrl("cash", org, branch, today) : null,
  );
  const own = useResource<Record<string, unknown>>(
    branch && (w.role === "barber" ? w.staffId : staff)
      ? financeUrl("staff", org, branch, from, to, {
          id: w.role === "barber" ? w.staffId! : staff,
        })
      : null,
  );
  function range(value: string) {
    if (value === "custom") return;
    setOffset(0);
    setTo(today);
    if (value === "today") setFrom(today);
    else if (value === "month") setFrom(today.slice(0, 8) + "01");
    else if (value === "7" || value === "30") {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - Number(value) + 1);
      setFrom(d.toISOString().slice(0, 10));
    } else {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      setFrom(d.toISOString().slice(0, 10));
    }
  }
  const totals = r.data?.totals;
  const byMethod = new Map<string, { label: string; amount: bigint | null }>();
  for (const row of r.data?.methods ?? []) {
    const id = String(row.payment_method_id ?? row.name);
    const previous = byMethod.get(id) ?? {
      label: String(row.name),
      amount: 0n,
    };
    previous.amount =
      previous.amount === null ||
      !/^-?\d+$/.test(String(row.gross_received_minor))
        ? null
        : previous.amount + BigInt(String(row.gross_received_minor));
    byMethod.set(id, previous);
  }
  const rows = r.data?.items ?? [];
  const session =
    cash.data?.session?.status === "open" ? cash.data.session.id : undefined;
  function reload() {
    r.reload();
    catalog.reload();
    cash.reload();
    own.reload();
  }
  const metrics = [
    ["gross_revenue_minor", "Ventas registradas (netas)"],
    ["collected_minor", "Ingresos cobrados"],
    ["pending_minor", "Pendiente de cobrar (actual)"],
    ["payment_processing_fees_minor", "Comisiones POS"],
    ["operating_expenses_minor", "Gastos operativos"],
    ["barber_commissions_minor", "Comisiones de barberos"],
    ["net_revenue_minor", "Ingresos después de POS"],
    ["operating_result_minor", "Resultado operativo"],
  ] as const;
  return (
    <section className="stack">
      {compact && (
        <h2>
          Finanzas · {w.branches.find((b) => b.id === branch)?.name} ·{" "}
          {periodFrom ?? from} a {periodTo ?? to}
        </h2>
      )}
      {!compact && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">FINANZAS OPERATIVAS</span>
              <h1>{w.role === "barber" ? "Mis números" : "Finanzas"}</h1>
              <p className="muted">
                Ventas, cobros, gastos y ganancias del negocio.
              </p>
            </div>
            {privileged && (
              <button onClick={() => setImporting(true)}>
                Importar histórico
              </button>
            )}
          </div>
          <details className="compact-filters">
            <summary>
              Filtros financieros · {from} a {to}
            </summary>
            <div className="row wrap">
              <Field label="Período">
                <select
                  onChange={(e) => range(e.target.value)}
                  defaultValue="today"
                >
                  <option value="today">Hoy</option>
                  <option value="7">7 días</option>
                  <option value="30">30 días</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="custom">Rango personalizado</option>
                </select>
              </Field>
              <DateRangePicker
                from={from}
                to={to}
                onFrom={(value) => {
                  setFrom(value);
                  setOffset(0);
                }}
                onTo={(value) => {
                  setTo(value);
                  setOffset(0);
                }}
              />
            </div>
          </details>
          {(from !== today || to !== today) && (
            <button
              className="badge clear-period-filter"
              onClick={() => {
                range("today");
              }}
            >
              Período {from} a {to} · Limpiar filtros
            </button>
          )}
          {w.role !== "barber" && (
            <div
              className="tabs"
              role="group"
              aria-label="Secciones de finanzas"
            >
              {tabs
                .filter(
                  ([v]) => !["catalog", "partners"].includes(v) || privileged,
                )
                .map(([value, label]) => (
                  <button
                    key={value}
                    className={tab === value ? "active" : ""}
                    aria-pressed={tab === value}
                    onClick={() => {
                      setTab(value);
                      setOffset(0);
                      setQuery("");
                    }}
                  >
                    {label}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Notice error>{r.error}</Notice>
      ) : tab === "partners" ? (
        <PartnerDistributions from={from} to={to} catalog={catalog.data} />
      ) : tab === "summary" ? (
        <>
          {totals && (
            <>
              <div className="kpi-grid">
                {metrics
                  .filter(
                    ([key]) =>
                      !compact ||
                      [
                        "gross_revenue_minor",
                        "collected_minor",
                        "operating_result_minor",
                        "pending_minor",
                      ].includes(key),
                  )
                  .map(([key, label]) => (
                    <div className="kpi" key={key}>
                      <span>{label}</span>
                      <strong>
                        {money(totals[key], w.organization.currency)}
                      </strong>
                    </div>
                  ))}
              </div>
              {r.data?.profit_sharing && (
                <ProfitSharing summary={r.data.profit_sharing} />
              )}
              {!compact && (
                <FinancialCharts
                  org={org}
                  branch={branch}
                  from={from}
                  to={to}
                  currency={w.organization.currency}
                />
              )}
              {!compact && (
                <>
                  <p>
                    Visitas completadas: {totals.completed_visits} · Checkouts
                    pagados: {totals.paid_checkouts} · Clientes identificados
                    únicos: {totals.unique_customers} · Ticket promedio real:{" "}
                    {money(
                      totals.average_ticket_minor,
                      w.organization.currency,
                    )}
                  </p>
                  <p className="muted">
                    Producción de servicios completados:{" "}
                    {money(totals.production_minor, w.organization.currency)}.
                    Completar un servicio no registra un cobro.
                  </p>
                </>
              )}
              {Number(totals.unknown_fees) +
                Number(totals.unknown_commissions) >
                0 && (
                <Notice>
                  Hay importes históricos sin tarifa o comisión demostrable. El
                  resultado operativo completo no está disponible para este
                  período.
                </Notice>
              )}
            </>
          )}
          {!compact && r.data?.staff_only && (
            <FinanceTable
              rows={r.data.staff}
              columns={[
                "local_date",
                "gross_production_minor",
                "commission_accrued_minor",
                "advances_minor",
                "commission_paid_minor",
                "salary_payments_minor",
              ]}
              currency={w.organization.currency}
            />
          )}
          {!compact && r.data?.methods && (
            <>
              <DataChart
                title="Cobros por medio de pago"
                description="Importes recibidos por los medios reales del catálogo; reversiones en la tabla inferior"
                kind="bar"
                horizontal
                currency={w.organization.currency}
                data={[...byMethod.values()].map((m) => ({
                  label: m.label,
                  amount:
                    m.amount === null
                      ? null
                      : chartInteger(m.amount.toString()),
                }))}
                series={[{ key: "amount", label: "Cobrado bruto" }]}
              />
              <h2>Medios de pago</h2>
              <FinanceTable
                rows={r.data.methods}
                columns={[
                  "local_date",
                  "name",
                  "gross_received_minor",
                  "refunds_minor",
                  "expenses_minor",
                  "fee_minor",
                ]}
                currency={w.organization.currency}
              />
            </>
          )}
          {!compact && r.data?.service_mix && (
            <>
              <h2>Servicios vendidos</h2>
              <FinanceTable
                rows={r.data.service_mix}
                columns={["name_snapshot", "quantity", "gross_minor"]}
                currency={w.organization.currency}
              />
            </>
          )}
          {!compact && totals && r.data?.staff && (
            <StaffFinancialCharts
              rows={r.data.staff}
              currency={w.organization.currency}
            />
          )}
        </>
      ) : tab === "catalog" && catalog.data ? (
        <>
          <RemunerationSettings
            key={String(catalog.data.settings?.updated_at ?? "initial")}
            catalog={catalog.data}
            onSaved={reload}
          />
          <button
            className="primary"
            onClick={() => setForm({ action: "configure" })}
          >
            Agregar configuración
          </button>
          <h2>Medios de pago</h2>
          <FinanceTable
            rows={catalog.data.payment_methods}
            columns={["name", "code", "type"]}
            currency={w.organization.currency}
          />
          <h2>Tarifas POS</h2>
          <FinanceTable
            rows={catalog.data.fee_rules.map((row) => ({
              ...row,
              name: catalog.data?.payment_methods.find(
                (m) => m.id === row.payment_method_id,
              )?.name,
              percentage: String(Number(row.percentage_bps) / 100) + "%",
            }))}
            columns={[
              "name",
              "percentage",
              "fixed_amount_minor",
              "effective_from",
              "effective_to",
            ]}
            currency={w.organization.currency}
          />
          <h2>Comisiones</h2>
          <FinanceTable
            rows={catalog.data.commission_rules.map((row) => ({
              ...row,
              name: catalog.data?.staff.find((m) => m.id === row.staff_id)
                ?.name,
              service: catalog.data?.services.find(
                (m) => m.id === row.service_id,
              )?.name,
              percentage: String(Number(row.rate_bps) / 100) + "%",
            }))}
            columns={[
              "name",
              "service",
              "percentage",
              "effective_from",
              "effective_to",
            ]}
            currency={w.organization.currency}
          />
        </>
      ) : (
        <>
          <div className="row wrap">
            {["movements", "expenses"].includes(tab) && (
              <Field label="Buscar concepto, cliente o proveedor">
                <input
                  value={query}
                  maxLength={80}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOffset(0);
                  }}
                />
              </Field>
            )}
            {tab === "expenses" && (
              <>
                <button onClick={() => setForm({ action: "create_expense" })}>
                  Gasto
                </button>
                <button
                  onClick={() => setForm({ action: "record_staff_advance" })}
                >
                  Adelanto
                </button>
                <button
                  onClick={() => setForm({ action: "record_salary_payment" })}
                >
                  Salario
                </button>
              </>
            )}
            {tab === "settlements" && (
              <>
                <button
                  onClick={() => setForm({ action: "create_staff_settlement" })}
                >
                  Preparar liquidación
                </button>
                <button
                  onClick={() =>
                    setForm({ action: "record_financial_adjustment" })
                  }
                >
                  Ajustar comisión
                </button>
              </>
            )}
            {privileged && (
              <a
                className="button"
                href={financeUrl("export", org, branch, from, to, {
                  view: tab,
                })}
              >
                Exportar CSV
              </a>
            )}
          </div>
          {rows.length ? (
            <FinanceTable
              rows={rows}
              columns={
                tab === "movements"
                  ? [
                      "occurred_at",
                      "kind",
                      "person",
                      "concept",
                      "gross_minor",
                      "payment_method",
                      "commission_minor",
                      "fee_minor",
                      "status",
                    ]
                  : tab === "expenses"
                    ? [
                        "occurred_at",
                        "category_kind_snapshot",
                        "vendor",
                        "description",
                        "amount_minor",
                        "method_name_snapshot",
                        "status",
                      ]
                    : tab === "settlements"
                      ? [
                          "staff_name",
                          "period_start",
                          "period_end",
                          "commission_accrued_minor",
                          "advances_applied_minor",
                          "commission_paid_minor",
                          "remaining_balance_minor",
                          "status",
                        ]
                      : ["local_date", "revision", "snapshot"]
              }
              currency={w.organization.currency}
              action={(row) =>
                tab === "settlements" && row.status !== "closed" ? (
                  <button
                    onClick={() =>
                      setForm({
                        action:
                          row.status === "draft"
                            ? "review_staff_settlement"
                            : row.status === "reviewed"
                              ? "pay_staff_settlement"
                              : "close_staff_settlement",
                        initial: { id: row.id },
                      })
                    }
                  >
                    {row.status === "draft"
                      ? "Revisar"
                      : row.status === "reviewed"
                        ? "Pagar"
                        : "Cerrar"}
                  </button>
                ) : ["expenses", "movements"].includes(tab) &&
                  row.status === "posted" ? (
                  <button
                    onClick={() =>
                      setForm({
                        action: "reverse_financial_transaction",
                        initial: {
                          id: row.id,
                          entity_type:
                            tab === "expenses" || row.kind !== "sale"
                              ? "expense"
                              : "checkout",
                        },
                      })
                    }
                  >
                    Revertir
                  </button>
                ) : null
              }
            />
          ) : (
            <Empty title="Sin movimientos en este período" />
          )}
          <div className="row between">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((v) => Math.max(0, v - 50))}
            >
              Anterior
            </button>
            <span>
              {offset + 1}–{offset + rows.length}
            </span>
            <button
              disabled={rows.length < 50}
              onClick={() => setOffset((v) => v + 50)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      {!compact && catalog.data && (
        <>
          <h2>{w.role === "barber" ? "Mi comisión" : "Números por barbero"}</h2>
          {w.role !== "barber" && (
            <Field label="Barbero">
              <select value={staff} onChange={(e) => setStaff(e.target.value)}>
                <option value="">Elegir barbero</option>
                {catalog.data.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {String(s.name)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {own.data && (
            <>
              <p className="muted">
                Acumulado histórico de esta sucursal. El saldo pendiente incluye
                movimientos de todos los períodos; no cambia con el filtro de
                fechas.
              </p>
              <div className="kpi-grid">
                {[
                  ["commission_minor", "Comisión generada"],
                  ["advances_minor", "Adelantos"],
                  ["paid_commission_minor", "Comisión liquidada"],
                  ["salary_minor", "Pagos salariales independientes"],
                  ["adjustments_minor", "Ajustes"],
                ].map(([key, label]) => (
                  <div className="kpi" key={key}>
                    <span>{label}</span>
                    <strong>
                      {money(own.data?.[key], w.organization.currency)}
                    </strong>
                  </div>
                ))}
              </div>
              <p>
                Saldo de comisión:{" "}
                {money(
                  Number(own.data.unknown_commissions) > 0
                    ? null
                    : own.data.pending_commission_minor,
                  w.organization.currency,
                )}
              </p>
            </>
          )}
        </>
      )}
      {!compact && w.role === "barber" && (
        <OwnPartnerBalances
          org={org}
          branch={branch}
          from={from}
          to={to}
          currency={w.organization.currency}
        />
      )}
      {form &&
        (catalog.loading || cash.loading || catalog.error || cash.error) && (
          <Modal title="Preparando operación" onClose={() => setForm(null)}>
            {catalog.error || cash.error ? (
              <Notice error>
                {catalog.error || cash.error}{" "}
                <button
                  onClick={() => {
                    catalog.reload();
                    cash.reload();
                  }}
                >
                  Reintentar
                </button>
              </Notice>
            ) : (
              <Loading />
            )}
          </Modal>
        )}
      {form &&
        catalog.data &&
        !catalog.loading &&
        !cash.loading &&
        !catalog.error &&
        !cash.error && (
          <FinanceForm
            action={form.action}
            initial={form.initial}
            catalog={catalog.data}
            cashSessionId={session}
            onClose={() => setForm(null)}
            onSaved={() => {
              setForm(null);
              reload();
            }}
          />
        )}
      {importing && catalog.data && (
        <FinanceImport
          catalog={catalog.data}
          onClose={() => setImporting(false)}
          onImported={reload}
        />
      )}
    </section>
  );
}
function OwnPartnerBalances({
  org,
  branch,
  from,
  to,
  currency,
}: {
  org: string;
  branch: string;
  from: string;
  to: string;
  currency: string;
}) {
  const r = useResource<{
    items: {
      period_start: string;
      period_end: string;
      currency: string;
      status: string;
      assigned_minor: string;
      balance_minor: string;
    }[];
  }>(branch ? financeUrl("partner_own", org, branch, from, to) : null);
  if (r.error) return <Notice error>{r.error}</Notice>;
  if (!r.data?.items.length) return null;
  return (
    <section className="panel stack">
      <h2>Mis asignaciones como socio</h2>
      <p className="muted">
        Períodos aprobados. El saldo descuenta pagos y retiros aplicados; una
        asignación no equivale a un pago.
      </p>
      {r.data.items.map((p) => (
        <div className="list-item" key={p.period_start}>
          <strong>
            {p.period_start} → {p.period_end}
          </strong>
          <p>
            Asignado: {money(p.assigned_minor, currency)} · Pendiente:{" "}
            {money(p.balance_minor, currency)}
          </p>
        </div>
      ))}
    </section>
  );
}
const columnLabels: Record<string, string> = {
  occurred_at: "Fecha",
  local_date: "Fecha",
  kind: "Tipo",
  person: "Cliente / proveedor",
  concept: "Concepto",
  gross_minor: "Bruto",
  payment_method: "Pago",
  commission_minor: "Comisión",
  fee_minor: "Fee POS",
  status: "Estado",
  category_kind_snapshot: "Clase",
  vendor: "Proveedor",
  description: "Descripción",
  amount_minor: "Importe",
  method_name_snapshot: "Pago",
  staff_name: "Barbero",
  period_start: "Desde",
  period_end: "Hasta",
  commission_accrued_minor: "Comisión generada",
  advances_applied_minor: "Adelantos aplicados",
  commission_paid_minor: "Liquidado",
  remaining_balance_minor: "Saldo",
  name: "Nombre",
  code: "Código",
  type: "Tipo",
  percentage: "Porcentaje",
  fixed_amount_minor: "Cargo fijo",
  effective_from: "Vigente desde",
  effective_to: "Hasta",
  service: "Servicio",
  name_snapshot: "Servicio",
  quantity: "Cantidad",
  gross_received_minor: "Recibido",
  refunds_minor: "Devoluciones",
  expenses_minor: "Egresos",
  gross_production_minor: "Producción",
  advances_minor: "Adelantos",
  salary_payments_minor: "Salario",
  snapshot: "Cierre",
  revision: "Versión",
};
export function FinanceTable({
  rows,
  columns,
  currency,
  action,
}: {
  rows: FinanceRow[];
  columns: string[];
  currency: string;
  action?: (row: FinanceRow) => React.ReactNode;
}) {
  return (
    <div
      className="table-wrap"
      role="region"
      aria-label="Detalle financiero. Tabla desplazable con teclado."
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{columnLabels[c] ?? c}</th>
            ))}
            {action && <th>Acción</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((c) => (
                <td key={c}>
                  {c.endsWith("_minor") ? (
                    money(row[c], currency)
                  ) : c === "snapshot" ? (
                    <details>
                      <summary>Ver cierre</summary>
                      <ClosureDetails snapshot={row[c]} currency={currency} />
                    </details>
                  ) : (
                    String(row[c] ?? "—")
                  )}
                </td>
              ))}
              {action && <td>{action(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ClosureDetails({
  snapshot,
  currency,
}: {
  snapshot: unknown;
  currency: string;
}) {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const financial = (s.financial ?? {}) as Record<string, unknown>;
  return (
    <dl>
      {[
        ["expected_cash_minor", "Efectivo esperado"],
        ["actual_cash_minor", "Efectivo contado"],
        ["difference_minor", "Diferencia"],
      ].map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{money(s[key], currency)}</dd>
        </div>
      ))}
      {[
        ["gross_revenue_minor", "Ingresos por ventas"],
        ["expenses_minor", "Egresos"],
        ["payment_processing_fees_minor", "Comisiones POS"],
        ["barber_commissions_minor", "Comisiones de barberos"],
      ].map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{money(financial[key], currency)}</dd>
        </div>
      ))}
    </dl>
  );
}
