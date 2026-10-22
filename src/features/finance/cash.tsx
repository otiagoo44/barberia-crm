"use client";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource } from "@/lib/client";
import { Field, Notice, Loading, Modal } from "@/components/ui";
import {
  financeUrl,
  financeCommand,
  money,
  integerInput,
  amountLabel,
  type FinanceRow,
  type FinanceCatalog,
} from "./client";
import { CheckoutDialog } from "./checkout";
import { FinanceForm } from "./forms";
type CashData = {
  session: FinanceRow | null;
  methods: FinanceRow[];
  expenses_minor: number;
  pending: FinanceRow[];
};
export function Cash() {
  const w = useWorkspace();
  const org = w.organization.id;
  const branch = w.branchId;
  const tz =
    w.branches.find((b) => b.id === branch)?.timezone ??
    w.organization.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const r = useResource<CashData>(
    branch ? financeUrl("cash", org, branch, today) : null,
  );
  const catalog = useResource<FinanceCatalog>(
    branch ? financeUrl("catalog", org, branch, today) : null,
  );
  const [action, setAction] = useState<"open" | "close" | "expense" | null>(
    null,
  );
  const [checkout, setCheckout] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const s = r.data?.session;
  const open = s?.status === "open";
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const data =
        action === "close"
          ? {
              id: s?.id,
              actual_cash_minor: integerInput(amount),
              reason: reason || null,
            }
          : { opening_amount_minor: integerInput(amount) };
      await financeCommand(
        org,
        branch,
        action === "close" ? "close_cash_session" : "open_cash_session",
        data,
        key,
      );
      setAction(null);
      setAmount("");
      setReason("");
      setKey(crypto.randomUUID());
      r.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  const counted = /^\d+$/.test(amount) ? Number(amount) : null;
  const difference =
    counted === null || !s ? null : counted - Number(s.expected_cash_minor);
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERACIÓN DE HOY · {today}</span>
          <h1>Caja</h1>
          <p className="muted">Cobros, egresos y efectivo de esta sucursal.</p>
        </div>
        <button className="primary" onClick={() => setManual(true)}>
          Venta sin cita
        </button>
      </div>
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Notice error>{r.error}</Notice>
      ) : (
        <>
          <div className="panel stack">
            <div className="row between">
              <h2>{open ? "Caja abierta" : "Caja cerrada"}</h2>
              <button
                onClick={() => {
                  setAction(open ? "close" : "open");
                  setKey(crypto.randomUUID());
                }}
              >
                {open ? "Cerrar caja" : "Abrir caja"}
              </button>
            </div>
            {s && (
              <>
                <p>
                  Abierta por {String(s.opened_by ?? "Usuario")} ·{" "}
                  {formatInTimeZone(String(s.opened_at), tz, "dd/MM HH:mm")}
                </p>
                <div className="row wrap">
                  <div>
                    <span className="muted">Efectivo inicial</span>
                    <h3>
                      {money(s.opening_amount_minor, w.organization.currency)}
                    </h3>
                  </div>
                  <div>
                    <span className="muted">
                      {open ? "Efectivo esperado" : "Efectivo al cierre"}
                    </span>
                    <h2>
                      {money(s.expected_cash_minor, w.organization.currency)}
                    </h2>
                  </div>
                  {!open && (
                    <div>
                      <span className="muted">Diferencia</span>
                      <h3>
                        {money(s.difference_minor, w.organization.currency)}
                      </h3>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div
            className="table-wrap"
            role="region"
            aria-label="Cobros por medio de pago. Tabla desplazable con teclado."
            tabIndex={0}
          >
            <table>
              <caption>Cobros de hoy por medio de pago</caption>
              <thead>
                <tr>
                  <th>Medio</th>
                  <th>Cobrado</th>
                  <th>Comisión POS</th>
                </tr>
              </thead>
              <tbody>
                {r.data?.methods.map((m) => (
                  <tr key={m.id}>
                    <td>{String(m.name)}</td>
                    <td>{money(m.gross_minor, w.organization.currency)}</td>
                    <td>{money(m.fee_minor, w.organization.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row between">
            <p>
              Egresos de hoy:{" "}
              <strong>
                {money(r.data?.expenses_minor, w.organization.currency)}
              </strong>
            </p>
            <button onClick={() => setAction("expense")}>
              Registrar gasto
            </button>
          </div>
          <div className="panel stack">
            <h2>Pendientes de cobrar</h2>
            {r.data?.pending.length ? (
              r.data.pending.map((c) => (
                <div key={c.id} className="row between">
                  <span>
                    {String(c.customer_name ?? c.description ?? "Venta")} ·{" "}
                    {money(c.total_minor, w.organization.currency)}
                  </span>
                  <button onClick={() => setCheckout(c.id)}>Cobrar</button>
                </div>
              ))
            ) : (
              <p className="muted">
                No hay checkouts pendientes. Podés preparar el cobro desde una
                cita completada.
              </p>
            )}
          </div>
        </>
      )}
      {(checkout || manual) && (
        <CheckoutDialog
          key={checkout ?? "manual"}
          branchId={branch}
          checkoutId={checkout ?? undefined}
          onClose={() => {
            setCheckout(null);
            setManual(false);
            r.reload();
          }}
          onPaid={r.reload}
        />
      )}
      {action === "expense" && catalog.data && (
        <FinanceForm
          action="create_expense"
          catalog={catalog.data}
          cashSessionId={open ? s?.id : undefined}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            r.reload();
          }}
        />
      )}
      {(action === "open" || action === "close") && (
        <Modal
          title={action === "open" ? "Abrir caja" : "Cerrar caja"}
          onClose={() => setAction(null)}
        >
          <div className="stack">
            {error && <Notice error>{error}</Notice>}
            {action === "close" && (
              <p>
                Efectivo esperado:{" "}
                <strong>
                  {money(s?.expected_cash_minor, w.organization.currency)}
                </strong>
              </p>
            )}
            <Field
              label={
                action === "open"
                  ? `Efectivo inicial · ${amountLabel(w.organization.currency)}`
                  : `Efectivo contado · ${amountLabel(w.organization.currency)}`
              }
            >
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            {action === "close" && difference !== null && (
              <Notice>
                Diferencia: {money(difference, w.organization.currency)}
              </Notice>
            )}
            {action === "close" && (
              <Field label="Motivo de diferencia (obligatorio si hay diferencia)">
                <textarea
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                !amount ||
                (action === "close" &&
                  difference !== 0 &&
                  reason.trim().length < 3)
              }
              onClick={submit}
            >
              {action === "open" ? "Confirmar apertura" : "Confirmar cierre"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
