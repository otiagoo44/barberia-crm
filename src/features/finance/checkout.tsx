"use client";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource } from "@/lib/client";
import { Modal, Notice, Loading, Field } from "@/components/ui";
import { PaymentMethodSelector } from "./payment-method-selector";
import {
  financeUrl,
  financeCommand,
  money,
  integerInput,
  amountLabel,
  type FinanceCatalog,
  type FinanceRow,
} from "./client";
type Checkout = FinanceRow & {
  status: string;
  total_minor: number;
  paid_minor: number;
  lines: FinanceRow[];
  payments: FinanceRow[];
};
export function CheckoutDialog({
  appointmentId,
  checkoutId,
  branchId,
  onClose,
  onPaid,
}: {
  appointmentId?: string;
  checkoutId?: string;
  branchId: string;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const w = useWorkspace();
  const org = w.organization.id;
  const today = formatInTimeZone(
    new Date(),
    w.branches.find((b) => b.id === branchId)?.timezone ??
      w.organization.timezone,
    "yyyy-MM-dd",
  );
  const catalog = useResource<FinanceCatalog>(
    financeUrl("catalog", org, branchId, today),
  );
  const existing = useResource<Checkout | null>(
    appointmentId || checkoutId
      ? financeUrl("checkout", org, branchId, today, today, {
          id: appointmentId ?? checkoutId!,
        })
      : null,
  );
  const cash = useResource<{ session: FinanceRow | null }>(
    financeUrl("cash", org, branchId, today),
  );
  const [created, setCreated] = useState<string | null>(null);
  const fresh = useResource<Checkout>(
    created
      ? financeUrl("checkout", org, branchId, today, today, { id: created })
      : null,
  );
  const checkout = fresh.data ?? existing.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [payments, setPayments] = useState<
    { method: string; amount: string }[]
  >([{ method: "", amount: "" }]);
  const [item, setItem] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [staff, setStaff] = useState("");
  const [keys] = useState(() => ({
    create: crypto.randomUUID(),
    post: crypto.randomUUID(),
  }));
  async function create() {
    setBusy(true);
    setError("");
    try {
      const selected = catalog.data?.items.find((i) => i.id === item);
      if (!appointmentId && !selected)
        throw new Error(
          "Elegí un producto, curso u otro ingreso del catálogo.",
        );
      const result = await financeCommand(
        org,
        branchId,
        "create_checkout",
        appointmentId
          ? { appointment_id: appointmentId }
          : {
              lines: [
                {
                  item_id: item,
                  staff_id: staff || null,
                  quantity: 1,
                  ...(selected?.price_minor === null
                    ? {
                        price_minor: integerInput(manualPrice),
                        reason: "Precio autorizado de venta manual",
                      }
                    : {}),
                },
              ],
            },
        keys.create,
      );
      setCreated(result.id);
      existing.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function post() {
    if (!checkout) return;
    setBusy(true);
    setError("");
    try {
      const rows = payments
        .map((p) =>
          payments.length === 1 && !p.amount
            ? { ...p, amount: String(remaining) }
            : p,
        )
        .filter((p) => p.amount)
        .map((p) => ({
          payment_method_id: p.method || catalog.data?.payment_methods[0]?.id,
          amount_minor: integerInput(p.amount),
          cash_session_id:
            cash.data?.session?.status === "open" ? cash.data.session.id : null,
        }));
      await financeCommand(
        org,
        branchId,
        "post_checkout",
        { id: checkout.id, payments: rows },
        keys.post,
      );
      setDone(true);
      existing.reload();
      fresh.reload();
      onPaid?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  const remaining = checkout
    ? Number(checkout.total_minor) - Number(checkout.paid_minor)
    : 0;
  return (
    <Modal title="Cobrar" onClose={onClose}>
      <div className="stack">
        {error && <Notice error>{error}</Notice>}
        {catalog.loading || existing.loading || fresh.loading ? (
          <Loading />
        ) : done || checkout?.status === "posted" ? (
          <>
            <Notice success>Venta cobrada y registrada.</Notice>
            <button className="primary" onClick={onClose}>
              Volver y ofrecer próximo turno
            </button>
          </>
        ) : checkout ? (
          <>
            <div>
              {checkout.lines.map((l) => (
                <div key={l.id} className="row between">
                  <span>
                    {String(l.name_snapshot)}{" "}
                    <small>{String(l.staff_name_snapshot ?? "")}</small>
                  </span>
                  <strong>
                    {money(l.amount_minor, w.organization.currency)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="row between">
              <h3>Total</h3>
              <h3>{money(checkout.total_minor, w.organization.currency)}</h3>
            </div>
            <p>
              Cobrado: {money(checkout.paid_minor, w.organization.currency)} ·
              Pendiente: {money(remaining, w.organization.currency)}
            </p>
            {payments.map((p, index) => (
              <div key={index} className="row wrap">
                <PaymentMethodSelector
                  methods={catalog.data?.payment_methods ?? []}
                  disabled={busy}
                  value={p.method || catalog.data?.payment_methods[0]?.id || ""}
                  onChange={(value) =>
                    setPayments((rows) =>
                      rows.map((row, i) =>
                        i === index ? { ...row, method: value } : row,
                      ),
                    )
                  }
                />
                <Field label={amountLabel(w.organization.currency)}>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={p.amount}
                    placeholder={index === 0 ? String(remaining) : "0"}
                    onChange={(e) =>
                      setPayments((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, amount: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                {payments.length > 1 && (
                  <button
                    onClick={() =>
                      setPayments((rows) => rows.filter((_, i) => i !== index))
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            <button
              aria-busy={!!busy}
              onClick={() =>
                setPayments((rows) => [...rows, { method: "", amount: "" }])
              }
              disabled={busy || payments.length >= 20}
            >
              Dividir pago
            </button>
            <button
              aria-busy={!!busy}
              className="primary"
              onClick={post}
              disabled={busy || !catalog.data?.payment_methods.length}
            >
              Cobrar y registrar
            </button>
            {!cash.data?.session || cash.data.session.status !== "open" ? (
              <Notice>
                Para recibir efectivo, abrí la caja de esta sucursal.
              </Notice>
            ) : null}
          </>
        ) : (
          <>
            {appointmentId ? (
              <p>
                Preparar el cobro de los servicios completados con sus precios
                guardados.
              </p>
            ) : (
              <>
                <Field label="Producto, curso u otro ingreso">
                  <select
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                  >
                    <option value="">Elegir concepto</option>
                    {catalog.data?.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {String(i.name)}
                      </option>
                    ))}
                  </select>
                </Field>
                {catalog.data?.items.find((i) => i.id === item)?.price_minor ===
                  null && (
                  <Field
                    label={`Precio autorizado · ${amountLabel(w.organization.currency)}`}
                  >
                    <input
                      inputMode="numeric"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Barbero (opcional)">
                  <select
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                  >
                    <option value="">Sin barbero</option>
                    {catalog.data?.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {String(s.name)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <button
              aria-busy={!!busy}
              className="primary"
              disabled={busy}
              onClick={create}
            >
              Preparar cobro
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
