"use client";
import { useState, type FormEvent } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, useResource } from "@/lib/client";
import { Empty, Field, Loading, Modal, Notice } from "@/components/ui";
import {
  financeUrl,
  money,
  integerInput,
  type FinanceCatalog,
  type FinanceRow,
} from "./client";
type Allocation = {
  id: string;
  name: string;
  amount_minor: number;
  balance_minor: number;
  payments: {
    id: string;
    amount_minor: number;
    direction: number;
    reference: string;
    reverses_id: string | null;
  }[];
};
type Period = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  result_minor: number;
  snapshot_hash: string;
  allocations: Allocation[];
};
type Policy = {
  enabled: boolean;
  periodicity: string;
  approval_role: string;
  withdrawals_mode: string;
  evidence_reference: string;
  losses_reference: string | null;
};
export function PartnerDistributions({
  from,
  to,
  catalog,
}: {
  from: string;
  to: string;
  catalog: FinanceCatalog | null;
}) {
  const w = useWorkspace();
  const r = useResource<{ policy: Policy | null; periods: Period[] }>(
    financeUrl("partners", w.organization.id, w.branchId, from, to),
  );
  const cash = useResource<{ session: FinanceRow | null }>(
    financeUrl("cash", w.organization.id, w.branchId, from, to),
  );
  const [form, setForm] = useState<{
    action: string;
    id?: string;
    allocation?: string;
    payment?: string;
  } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState("");
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  function open(action: string, props: Partial<NonNullable<typeof form>> = {}) {
    setKey(crypto.randomUUID());
    setError("");
    setMethod("");
    setForm({ action, ...props });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    if (form.id) data.id = form.id;
    if (form.allocation) data.allocation = form.allocation;
    if (form.payment) data.payment = form.payment;
    try {
      if (form.action === "configure")
        Object.assign(data, {
          confirmed: true,
          enabled: f.get("enabled") === "on",
          periodicity: f.get("periodicity"),
          approval_role: f.get("approval_role"),
          withdrawals_mode: f.get("withdrawals_mode"),
          evidence_reference: f.get("reference"),
          losses_reference: f.get("losses_reference"),
        });
      if (form.action === "prepare")
        Object.assign(data, { from: f.get("from"), to: f.get("to") });
      if (form.action === "approve")
        Object.assign(data, {
          reconciled: true,
          reference: f.get("reference"),
        });
      if (["pay", "reverse_payment"].includes(form.action))
        Object.assign(data, {
          confirmed: true,
          occurred_at: fromZonedTime(
            String(f.get("occurred_at")),
            tz,
          ).toISOString(),
          reference: f.get("reference"),
          session:
            cash.data?.session?.status === "open" ? cash.data.session.id : null,
        });
      if (form.action === "pay")
        Object.assign(data, {
          method,
          amount_minor: integerInput(String(f.get("amount"))),
        });
      if (form.action === "adjust") {
        const value = String(f.get("amount"));
        if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
          throw new Error("El ajuste debe ser un importe entero.");
        Object.assign(data, {
          amount_minor: Number(value),
          reason: f.get("reference"),
          related_period: f.get("related_period") || null,
        });
      }
      if (form.action === "apply_withdrawal")
        Object.assign(data, {
          advance: f.get("advance"),
          reference: f.get("reference"),
        });
      await api("/api/finance/partners", {
        org: w.organization.id,
        branch: w.branchId,
        action: form.action,
        data,
        key,
      });
      setForm(null);
      r.reload();
      cash.reload();
      setMessage(
        form.action === "pay"
          ? "Pago efectivo registrado."
          : form.action === "approve"
            ? "Asignación aprobada. Todavía no representa un pago."
            : "Registro guardado.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const titles: Record<string, string> = {
    configure: "Reglas de distribución",
    prepare: "Preparar distribución",
    approve: "Aprobar asignaciones",
    pay: "Registrar pago efectivo",
    reverse_payment: "Registrar devolución del pago",
    adjust: "Ajustar asignación",
    apply_withdrawal: "Aplicar retiro identificado",
    close: "Cerrar período conciliado",
  };
  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h2>Distribuciones a socios</h2>
          <p className="muted">
            Asignaciones aprobadas, pagos realizados y saldo pendiente, por
            sucursal.
          </p>
        </div>
        {w.role === "organization_owner" && (
          <button onClick={() => open("configure")}>Confirmar reglas</button>
        )}
      </div>
      {message && <Notice>{message}</Notice>}
      {r.error && <Notice error>{r.error}</Notice>}
      {!r.data?.policy?.enabled && (
        <Notice>
          Registro de distribuciones bloqueado. El propietario debe confirmar
          periodicidad, aprobación, retiros y pérdidas previas con evidencia. La
          estimación 50/50 continúa disponible en Resumen.
        </Notice>
      )}
      {r.data?.policy?.enabled && (
        <div className="row between wrap">
          <p>
            Regla confirmada: {r.data.policy.periodicity} ·{" "}
            {r.data.policy.approval_role === "owner"
              ? "Aprueba propietario"
              : "Aprueba propietario o finanzas"}
          </p>
          <button className="primary" onClick={() => open("prepare")}>
            Preparar período
          </button>
        </div>
      )}
      {r.loading ? (
        <Loading />
      ) : r.data?.periods.length ? (
        r.data.periods.map((p) => (
          <article className="panel stack" key={p.id}>
            <div className="row between wrap">
              <h3>
                {p.period_start} → {p.period_end}
              </h3>
              <span className="badge">
                {p.status === "draft"
                  ? "Propuesta"
                  : p.status === "approved"
                    ? "Aprobado"
                    : "Cerrado"}
              </span>
            </div>
            <p>
              Resultado calculado:{" "}
              {money(p.result_minor, w.organization.currency)}
            </p>
            <details>
              <summary>Identificador de la evidencia</summary>
              <code className="secret-key">{p.snapshot_hash}</code>
            </details>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Asignaciones a socios"
            >
              <table>
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Asignación inicial</th>
                    <th>Saldo actual</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {p.allocations?.map((a) => (
                    <tr key={a.id}>
                      <th scope="row">{a.name} · 50%</th>
                      <td>{money(a.amount_minor, w.organization.currency)}</td>
                      <td>
                        {p.status === "draft"
                          ? "Propuesto"
                          : money(a.balance_minor, w.organization.currency)}
                      </td>
                      <td>
                        {p.status === "approved" && (
                          <div className="row">
                            <button
                              disabled={
                                !r.data?.policy?.enabled ||
                                Number(a.balance_minor) <= 0
                              }
                              onClick={() => open("pay", { allocation: a.id })}
                            >
                              Registrar pago
                            </button>
                            <button
                              disabled={!r.data?.policy?.enabled}
                              onClick={() =>
                                open("adjust", { allocation: a.id })
                              }
                            >
                              Ajustar
                            </button>
                            {r.data?.policy?.withdrawals_mode ===
                              "explicit_advance" && (
                              <button
                                onClick={() =>
                                  open("apply_withdrawal", { allocation: a.id })
                                }
                              >
                                Aplicar retiro
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.status === "draft" && (
              <button
                disabled={!r.data?.policy?.enabled}
                onClick={() => open("approve", { id: p.id })}
              >
                Revisar y aprobar
              </button>
            )}
            {p.status === "approved" && (
              <button
                disabled={!r.data?.policy?.enabled}
                onClick={() => open("close", { id: p.id })}
              >
                Cerrar período
              </button>
            )}
            {p.allocations?.map((a) => (
              <details key={a.id}>
                <summary>Pagos y devoluciones de {a.name}</summary>
                {a.payments.length ? (
                  a.payments.map((pay) => (
                    <div className="list-item row between wrap" key={pay.id}>
                      <span>
                        {pay.direction === 1 ? "Pago efectivo" : "Devolución"} ·{" "}
                        {money(pay.amount_minor, w.organization.currency)} ·{" "}
                        {pay.reference}
                      </span>
                      {p.status === "approved" &&
                        pay.direction === 1 &&
                        !a.payments.some((x) => x.reverses_id === pay.id) && (
                          <button
                            onClick={() =>
                              open("reverse_payment", {
                                allocation: a.id,
                                payment: pay.id,
                              })
                            }
                          >
                            Registrar devolución
                          </button>
                        )}
                    </div>
                  ))
                ) : (
                  <p className="muted">Sin pagos registrados.</p>
                )}
              </details>
            ))}
          </article>
        ))
      ) : (
        <Empty title="Sin períodos de distribución">
          Prepará un período finalizado después de confirmar las reglas. No se
          generan pagos automáticamente.
        </Empty>
      )}
      {form && (
        <Modal
          title={titles[form.action]}
          onClose={() => !busy && setForm(null)}
        >
          <form onSubmit={submit} className="stack">
            {form.action === "configure" && (
              <>
                <Notice>
                  Estas reglas deben corresponder al acuerdo real del dueño.
                  Cambiarlas crea una nueva versión y no reescribe períodos
                  aprobados.
                </Notice>
                <Field label="Periodicidad">
                  <select
                    name="periodicity"
                    defaultValue={r.data?.policy?.periodicity ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Elegir regla acordada
                    </option>
                    <option value="manual">Período manual explícito</option>
                    <option value="weekly">
                      Semana completa: lunes a domingo
                    </option>
                    <option value="monthly">Mes calendario completo</option>
                  </select>
                </Field>
                <Field label="Quién aprueba">
                  <select
                    name="approval_role"
                    defaultValue={r.data?.policy?.approval_role ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Elegir responsable
                    </option>
                    <option value="owner">Solo propietario</option>
                    <option value="owner_or_finance">
                      Propietario o finanzas autorizadas
                    </option>
                  </select>
                </Field>
                <Field label="Tratamiento de retiros">
                  <select
                    name="withdrawals_mode"
                    defaultValue={r.data?.policy?.withdrawals_mode ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Elegir regla acordada
                    </option>
                    <option value="blocked">No aplicar retiros</option>
                    <option value="explicit_advance">
                      Aplicar adelanto no deducible identificado y conciliado
                    </option>
                  </select>
                </Field>
                <Field label="Acuerdo sobre pérdidas previas">
                  <input
                    name="losses_reference"
                    defaultValue={r.data?.policy?.losses_reference ?? ""}
                    minLength={5}
                    maxLength={250}
                    required
                  />
                </Field>
                <p className="muted">
                  Referenciá el acuerdo y su conciliación antes de aprobar. El
                  sistema no calcula arrastres de pérdidas automáticamente.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={r.data?.policy?.enabled ?? false}
                  />{" "}
                  Habilitar nuevos registros de distribución
                </label>
              </>
            )}
            {form.action === "prepare" && (
              <>
                <Field label="Desde">
                  <input type="date" name="from" defaultValue={from} required />
                </Field>
                <Field label="Hasta">
                  <input type="date" name="to" defaultValue={to} required />
                </Field>
                <p>
                  Solo períodos finalizados en PYG, con dos socios y tarifas
                  completas. No estima gastos faltantes ni pérdidas acumuladas.
                </p>
              </>
            )}
            {form.action === "pay" && (
              <>
                <Field label="Medio de pago">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    required
                  >
                    <option value="">Elegir</option>
                    {catalog?.payment_methods
                      .filter((m) => ["cash", "bank"].includes(String(m.type)))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {String(m.name)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Importe efectivo en guaraníes">
                  <input
                    name="amount"
                    inputMode="numeric"
                    pattern="[0-9]+"
                    required
                  />
                </Field>
              </>
            )}
            {["pay", "reverse_payment"].includes(form.action) && (
              <>
                <Field label="Fecha y hora reales">
                  <input
                    type="datetime-local"
                    name="occurred_at"
                    defaultValue={formatInTimeZone(
                      new Date(),
                      tz,
                      "yyyy-MM-dd'T'HH:mm",
                    )}
                    required
                  />
                </Field>
                <Notice>
                  Confirmá una entrega o devolución real. No se ejecuta ninguna
                  transferencia bancaria. Efectivo requiere caja abierta y saldo
                  disponible.
                </Notice>
              </>
            )}
            {form.action === "adjust" && (
              <>
                <Field label="Ajuste en guaraníes (negativo para reducir)">
                  <input
                    name="amount"
                    required
                    inputMode="text"
                    pattern="-?[0-9]+"
                  />
                </Field>
                <Field label="Período relacionado (ID, opcional)">
                  <input name="related_period" />
                </Field>
                <p>
                  Una corrección no registra una entrega de dinero ni cambia el
                  resultado histórico.
                </p>
              </>
            )}
            {form.action === "apply_withdrawal" && (
              <>
                <Field label="ID del adelanto conciliado">
                  <input name="advance" required />
                </Field>
                <p>
                  Solo un adelanto real no deducible del mismo socio y local,
                  sin aplicar antes. No genera un nuevo egreso. Para deshacer
                  una clasificación se requiere un ajuste auditado explícito.
                </p>
              </>
            )}
            {!["prepare", "close"].includes(form.action) && (
              <Field
                label={
                  form.action === "configure"
                    ? "Referencia del acuerdo confirmado"
                    : "Referencia / motivo verificable"
                }
              >
                <input
                  name="reference"
                  required
                  minLength={5}
                  maxLength={250}
                />
              </Field>
            )}
            {form.action === "approve" && (
              <Notice>
                Confirmá gastos pendientes, tarifas, salarios, retiros y
                pérdidas anteriores según el acuerdo. La aprobación congela el
                cálculo y reserva asignaciones; no paga.
              </Notice>
            )}
            <label className="check-label">
              <input type="checkbox" required /> Confirmo los datos y la
              operación real indicada.
            </label>
            {error && <Notice error>{error}</Notice>}
            <div className="form-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Guardando…" : titles[form.action]}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
