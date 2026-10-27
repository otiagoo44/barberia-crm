"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { useResource } from "@/lib/client";
import { Modal, Field, Notice, Loading, Empty } from "@/components/ui";
import {
  financeCommand,
  financeUrl,
  money,
  integerInput,
  amountLabel,
  type FinanceCatalog,
  type FinanceRow,
} from "./client";
import { FinanceForm } from "./forms";
import { PaymentMethodSelector } from "./payment-method-selector";

type Book = { totals: FinanceRow; methods: FinanceRow[]; items: FinanceRow[] };
export function Daybook({
  from,
  to,
  catalog,
  onSaved,
}: {
  from: string;
  to: string;
  catalog: FinanceCatalog | null;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<"income" | "expense" | null>(null);
  const book = useResource<Book>(
    financeUrl("daybook", w.organization.id, w.branchId, from, to, {
      q: query,
      offset: String(offset),
    }),
  );
  const cash = useResource<{ session: FinanceRow | null }>(
    form ? financeUrl("cash", w.organization.id, w.branchId, from) : null,
  );
  const session =
    cash.data?.session?.status === "open" ? cash.data.session.id : undefined;
  const currency = w.organization.currency;
  const totals = book.data?.totals;
  function saved() {
    book.reload();
    cash.reload();
    onSaved();
    setForm(null);
  }
  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h2>Registro diario</h2>
          <p className="muted">
            Ingresos y egresos del período, como en tu planilla.
          </p>
        </div>
        <div className="row wrap">
          <button
            className="primary"
            disabled={!catalog}
            onClick={() => setForm("income")}
          >
            Registrar ingreso
          </button>
          <button disabled={!catalog} onClick={() => setForm("expense")}>
            Registrar gasto
          </button>
        </div>
      </div>
      {book.loading ? (
        <Loading />
      ) : book.error ? (
        <Notice error>{book.error}</Notice>
      ) : (
        <>
          {totals && (
            <>
              <div className="kpi-grid">
                {[
                  ["Ingresos", totals.income_minor],
                  ["Egresos y devoluciones", totals.expense_minor],
                  ["Saldo antes de POS", totals.balance_before_fees_minor],
                  ["Saldo después de POS", totals.net_minor],
                ].map(([label, value]) => (
                  <div className="kpi" key={String(label)}>
                    <span>{String(label)}</span>
                    <strong>
                      {value === null
                        ? "Costo POS pendiente"
                        : money(value, currency)}
                    </strong>
                  </div>
                ))}
              </div>
              {Number(totals.unknown_fees) > 0 && (
                <Notice>
                  {String(totals.unknown_fees)} cobro(s) con costo POS
                  pendiente. Los ingresos ya están registrados; el saldo después
                  de POS se completará al confirmar sus costos.
                </Notice>
              )}
            </>
          )}
          <small className="muted">
            Saldo del período = ingresos − egresos − devoluciones. No incluye
            saldo inicial ni equivale a ganancia a repartir; las comisiones del
            equipo se consultan en Resumen.
          </small>
          {!!book.data?.methods?.length && (
            <div
              className="table-wrap"
              role="region"
              aria-label="Saldo por medio de pago"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Medio de pago</th>
                    <th>Ingresó</th>
                    <th>Egresó</th>
                    <th>Saldo antes de POS</th>
                    <th>Saldo después de POS</th>
                  </tr>
                </thead>
                <tbody>
                  {book.data.methods.map((row, index) => (
                    <tr key={String(row.payment_method_id) + index}>
                      <td>{String(row.payment_method)}</td>
                      <td>{money(row.income_minor, currency)}</td>
                      <td>{money(row.expense_minor, currency)}</td>
                      <td>{money(row.balance_before_fees_minor, currency)}</td>
                      <td>
                        {row.net_minor === null
                          ? "Pendiente"
                          : money(row.net_minor, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Field label="Buscar en el registro">
            <input
              value={query}
              maxLength={80}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </Field>
          {book.data?.items.length ? (
            <div
              className="table-wrap"
              role="region"
              aria-label="Registro diario de movimientos"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {[
                      "Fecha",
                      "Barbero",
                      "Cliente / proveedor",
                      "Concepto",
                      "Tipo",
                      "Ingresos",
                      "Egresos",
                      "Medio de pago",
                      "Costo POS",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {book.data.items.map((row, index) => (
                    <tr key={String(row.id) + String(row.kind) + index}>
                      <td>{String(row.local_date)}</td>
                      <td>{String(row.staff_name ?? "—")}</td>
                      <td>{String(row.person || "—")}</td>
                      <td>{String(row.concept)}</td>
                      <td>{String(row.kind)}</td>
                      <td>{money(row.income_minor, currency)}</td>
                      <td>{money(row.expense_minor, currency)}</td>
                      <td>{String(row.payment_method)}</td>
                      <td>
                        {row.fee_status === "unknown"
                          ? "Pendiente"
                          : money(row.fee_minor, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Todavía no hay movimientos en este período" />
          )}
          <div className="row between">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((n) => Math.max(0, n - 50))}
            >
              Anterior
            </button>
            <span>
              {book.data?.items.length
                ? `${offset + 1}–${offset + book.data.items.length}`
                : "0 movimientos"}
            </span>
            <button
              disabled={(book.data?.items.length ?? 0) < 50}
              onClick={() => setOffset((n) => n + 50)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      {form &&
        catalog &&
        (cash.loading ? (
          <Loading />
        ) : cash.error ? (
          <Modal title="Registrar movimiento" onClose={() => setForm(null)}>
            <Notice error>{cash.error}</Notice>
          </Modal>
        ) : form === "expense" ? (
          <FinanceForm
            action="create_expense"
            catalog={catalog}
            cashSessionId={session}
            onClose={() => setForm(null)}
            onSaved={saved}
          />
        ) : (
          <IncomeForm
            catalog={catalog}
            cashSessionId={session}
            onClose={() => setForm(null)}
            onSaved={saved}
          />
        ))}
    </div>
  );
}

function IncomeForm({
  catalog,
  cashSessionId,
  onClose,
  onSaved,
}: {
  catalog: FinanceCatalog;
  cashSessionId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(catalog.payment_methods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const service = item.startsWith("service:");
  const selected = (service ? catalog.services : catalog.items).find(
    (r) => r.id === item.split(":")[1],
  );
  const changed =
    selected?.price_minor !== null &&
    selected?.price_minor !== undefined &&
    amount !== "" &&
    String(selected.price_minor) !== amount;
  const needsCash =
    catalog.payment_methods.find((m) => m.id === method)?.type === "cash" &&
    !cashSessionId;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = new FormData(event.currentTarget);
      await financeCommand(
        w.organization.id,
        w.branchId,
        "record_income",
        {
          [service ? "service_id" : "item_id"]: selected?.id,
          staff_id: String(fields.get("staff_id") || "") || null,
          person_label: String(fields.get("person_label") || ""),
          amount_minor: integerInput(amount),
          payment_method_id: method,
          cash_session_id: cashSessionId ?? null,
          reason: String(fields.get("reason") || ""),
        },
        key,
      );
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el ingreso.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Registrar ingreso" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <p>
          Para un ingreso ya cobrado fuera de la agenda. Los cobros de una cita
          se registran desde esa atención.
        </p>
        {error && <Notice error>{error}</Notice>}
        <Field label="Concepto">
          <select
            required
            disabled={busy}
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              const [kind, id] = e.target.value.split(":");
              const row = (
                kind === "service" ? catalog.services : catalog.items
              ).find((r) => r.id === id);
              setAmount(
                row?.price_minor == null ? "" : String(row.price_minor),
              );
            }}
          >
            <option value="">Elegir servicio o concepto</option>
            {catalog.services.map((r) => (
              <option key={r.id} value={"service:" + r.id}>
                {String(r.name)}
              </option>
            ))}
            {catalog.items.map((r) => (
              <option key={r.id} value={"item:" + r.id}>
                {String(r.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Barbero">
          <select name="staff_id" required={service} disabled={busy}>
            <option value="">
              {service ? "Elegir barbero" : "Sin asignar"}
            </option>
            {catalog.staff.map((r) => (
              <option key={r.id} value={r.id}>
                {String(r.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cliente (opcional)">
          <input name="person_label" maxLength={120} disabled={busy} />
        </Field>
        <Field label={amountLabel(w.organization.currency)}>
          <input
            required
            inputMode="numeric"
            pattern="[0-9]+"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        {changed && (
          <Field label="Motivo del precio diferente">
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              disabled={busy}
            />
          </Field>
        )}
        <PaymentMethodSelector
          methods={catalog.payment_methods}
          value={method}
          onChange={setMethod}
          disabled={busy}
        />
        {catalog.payment_methods.find((m) => m.id === method)?.type ===
          "card" && (
          <p className="muted">
            Podés registrar el cobro aunque el costo POS esté pendiente. No se
            cobra un recargo al cliente.
          </p>
        )}
        {needsCash && (
          <Notice>
            Abrí la caja antes de registrar efectivo.{" "}
            <a href={`/${w.organization.slug}/caja`}>Ir a Caja</a>
          </Notice>
        )}
        <button
          className="primary"
          aria-busy={busy}
          disabled={busy || needsCash || !selected}
        >
          {busy ? "Guardando…" : "Guardar ingreso cobrado"}
        </button>
      </form>
    </Modal>
  );
}
