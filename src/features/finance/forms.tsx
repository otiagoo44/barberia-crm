"use client";
import { useState, type FormEvent } from "react";
import { fromZonedTime } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { Modal, Field, Notice } from "@/components/ui";
import {
  financeCommand,
  integerInput,
  amountLabel,
  type FinanceCatalog,
  type FinanceRow,
} from "./client";
const labels: Record<string, string> = {
  create_expense: "Registrar gasto",
  record_staff_advance: "Registrar adelanto",
  record_salary_payment: "Registrar pago salarial",
  create_staff_settlement: "Preparar liquidación",
  review_staff_settlement: "Revisar liquidación",
  pay_staff_settlement: "Pagar comisión",
  close_staff_settlement: "Cerrar liquidación",
  reverse_financial_transaction: "Revertir operación",
  record_financial_adjustment: "Ajuste de comisión",
  record_cash_movement: "Movimiento de caja",
  configure: "Configuración financiera",
};
export function FinanceForm({
  action,
  catalog,
  cashSessionId,
  initial = {},
  onClose,
  onSaved,
}: {
  action: string;
  catalog: FinanceCatalog;
  cashSessionId?: string;
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [entity, setEntity] = useState("payment_methods");
  const [key] = useState(() => crypto.randomUUID());
  const kind =
    action === "record_staff_advance"
      ? "advance"
      : action === "record_salary_payment"
        ? "salary"
        : action === "pay_staff_settlement"
          ? "commission_payment"
          : "operating";
  const payout = [
    "create_expense",
    "record_staff_advance",
    "record_salary_payment",
    "pay_staff_settlement",
  ].includes(action);
  const staff =
    [
      "record_staff_advance",
      "record_salary_payment",
      "create_staff_settlement",
      "record_financial_adjustment",
    ].includes(action) ||
    (action === "configure" && entity === "commission_rules");
  function selection(name: string, label: string, options: FinanceRow[]) {
    return (
      <Field label={label}>
        <select name={name} required defaultValue={String(initial[name] ?? "")}>
          <option value="">Elegir</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {String(o.name)}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = new FormData(event.currentTarget);
      const data: Record<string, unknown> = { ...initial };
      for (const [k, v] of fields) data[k] = String(v);
      for (const k of ["amount_minor", "fixed_amount_minor", "price_minor"])
        if (k in data && data[k] !== "")
          data[k] = integerInput(String(data[k]));
      if (
        action === "record_financial_adjustment" ||
        action === "record_cash_movement"
      ) {
        const value = String(fields.get("signed_amount_minor"));
        if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
          throw new Error("Ingresá un importe entero con signo.");
        data.amount_minor = Number(value);
        delete data.signed_amount_minor;
      }
      if (action === "configure") {
        if (!data.evidence_reference) delete data.evidence_reference;
        data.entity = entity;
        if (entity === "finance_items" && data.price_minor === "")
          data.price_minor = null;
        if (
          entity === "payment_method_fee_rules" ||
          entity === "commission_rules"
        ) {
          const percent = String(data.percentage ?? "");
          if (!/^\d{1,3}(\.\d{1,2})?$/.test(percent))
            throw new Error("Porcentaje inválido. Usá hasta dos decimales.");
          const [whole, decimal = ""] = percent.split(".");
          const bps = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
          if (bps > 10000) throw new Error("El porcentaje máximo es 100%.");
          data[entity === "commission_rules" ? "rate_bps" : "percentage_bps"] =
            bps;
          delete data.percentage;
          if (data.effective_from)
            data.effective_from = fromZonedTime(
              String(data.effective_from),
              w.branches.find((b) => b.id === w.branchId)?.timezone ??
                w.organization.timezone,
            ).toISOString();
          else delete data.effective_from;
        }
      }
      if (payout || action === "record_cash_movement")
        data.cash_session_id = cashSessionId ?? null;
      if (data.cash_session_id === "") data.cash_session_id = null;
      if (action === "record_staff_advance")
        data.deductible = fields.get("deductible") === "on";
      await financeCommand(w.organization.id, w.branchId, action, data, key);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={labels[action] ?? "Operación financiera"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <Notice error>{error}</Notice>}
        {action === "configure" && (
          <Field label="Qué configurar">
            <select value={entity} onChange={(e) => setEntity(e.target.value)}>
              {[
                ["payment_methods", "Medio de pago"],
                ["payment_method_fee_rules", "Tarifa POS"],
                ["commission_rules", "Comisión por barbero y servicio"],
                ["expense_categories", "Categoría de gasto"],
                ["finance_items", "Producto, curso u otro ingreso"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {staff && selection("staff_id", "Barbero", catalog.staff)}
        {payout && (
          <>
            {selection(
              "category_id",
              "Categoría",
              catalog.categories.filter((c) => c.kind === kind),
            )}
            {selection(
              "payment_method_id",
              "Medio de pago",
              catalog.payment_methods,
            )}
            {action !== "pay_staff_settlement" && (
              <Field label={amountLabel(w.organization.currency)}>
                <input
                  name="amount_minor"
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                />
              </Field>
            )}
            <Field label="Descripción">
              <input
                name="description"
                maxLength={500}
                required={action !== "pay_staff_settlement"}
                defaultValue={String(initial.description ?? "")}
              />
            </Field>
            {action === "create_expense" && (
              <Field label="Proveedor (opcional)">
                <input name="vendor" maxLength={120} />
              </Field>
            )}
            <Field label="Referencia / comprobante (opcional)">
              <input name="receipt_reference" maxLength={250} />
            </Field>
          </>
        )}
        {action === "record_staff_advance" && (
          <label>
            <input
              type="checkbox"
              name="deductible"
              defaultChecked={Boolean(catalog.settings?.advances_deductible)}
            />{" "}
            Descontar de futuras comisiones
          </label>
        )}
        {action === "create_staff_settlement" && (
          <>
            <Field label="Desde">
              <input type="date" name="period_start" required />
            </Field>
            <Field label="Hasta">
              <input type="date" name="period_end" required />
            </Field>
            <Notice>
              Se reservan las comisiones y los adelantos disponibles. Los pagos
              salariales se mantienen separados.
            </Notice>
          </>
        )}
        {[
          "reverse_financial_transaction",
          "record_financial_adjustment",
          "record_cash_movement",
        ].includes(action) && (
          <>
            {action !== "reverse_financial_transaction" && (
              <Field
                label={`${amountLabel(w.organization.currency)} (negativo para descontar)`}
              >
                <input
                  name="signed_amount_minor"
                  inputMode="text"
                  required
                  pattern="-?[0-9]+"
                />
              </Field>
            )}
            <Field label="Motivo">
              <textarea name="reason" required minLength={3} maxLength={500} />
            </Field>
            {action === "reverse_financial_transaction" && (
              <>
                <input
                  type="hidden"
                  name="cash_session_id"
                  value={cashSessionId ?? ""}
                />
                <Notice>
                  Se conserva el original y se registra la reversión. Las
                  tarifas de tarjeta originales se mantienen salvo ajuste
                  confirmado del proveedor.
                </Notice>
              </>
            )}
          </>
        )}
        {action === "configure" && (
          <>
            {[
              "payment_methods",
              "expense_categories",
              "finance_items",
            ].includes(entity) && (
              <Field label="Nombre">
                <input name="name" required maxLength={120} />
              </Field>
            )}
            {["payment_methods", "expense_categories"].includes(entity) && (
              <Field label="Código estable">
                <input
                  name="code"
                  required
                  pattern="[a-z0-9][a-z0-9_-]{1,62}"
                />
              </Field>
            )}
            {entity === "payment_methods" && (
              <Field label="Tipo">
                <select name="type">
                  <option value="cash">Efectivo</option>
                  <option value="bank">Transferencia bancaria</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </Field>
            )}
            {entity === "expense_categories" && (
              <Field label="Clase">
                <select name="kind">
                  <option value="operating">Gasto operativo</option>
                  <option value="advance">Adelanto</option>
                  <option value="salary">Salario</option>
                  <option value="commission_payment">Pago de comisión</option>
                </select>
              </Field>
            )}
            {entity === "finance_items" && (
              <>
                <Field label="Clase">
                  <select name="kind">
                    <option value="product">Producto</option>
                    <option value="course">Curso</option>
                    <option value="other">Otro ingreso</option>
                  </select>
                </Field>
                <Field
                  label={`Precio · ${amountLabel(w.organization.currency)} (opcional)`}
                >
                  <input
                    name="price_minor"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </Field>
              </>
            )}
            {entity === "payment_method_fee_rules" &&
              selection(
                "payment_method_id",
                "Medio de pago",
                catalog.payment_methods,
              )}
            {entity === "commission_rules" &&
              selection("service_id", "Servicio", catalog.services)}
            {["payment_method_fee_rules", "commission_rules"].includes(
              entity,
            ) && (
              <>
                <Field label="Porcentaje">
                  <input
                    name="percentage"
                    required
                    inputMode="decimal"
                    defaultValue="0"
                  />
                </Field>
                {entity === "payment_method_fee_rules" && (
                  <Field
                    label={`Cargo fijo · ${amountLabel(w.organization.currency)}`}
                  >
                    <input
                      name="fixed_amount_minor"
                      required
                      inputMode="numeric"
                      defaultValue="0"
                    />
                  </Field>
                )}
                <Field
                  label={`Vigencia desde · ${w.branches.find((b) => b.id === w.branchId)?.timezone ?? w.organization.timezone} (vacío: ahora)`}
                >
                  <input name="effective_from" type="datetime-local" />
                </Field>
                <Field label="Referencia de evidencia (obligatoria para fechas históricas)">
                  <input name="evidence_reference" maxLength={250} />
                </Field>
                <Notice>
                  Esta configuración crea una nueva versión. Las operaciones
                  anteriores conservan sus importes y porcentajes.
                </Notice>
              </>
            )}
          </>
        )}
        {["review_staff_settlement", "close_staff_settlement"].includes(
          action,
        ) && (
          <Notice>
            Confirmá la liquidación seleccionada. Una liquidación cerrada solo
            admite correcciones mediante ajustes auditados.
          </Notice>
        )}
        <button className="primary" disabled={busy} type="submit">
          {busy ? "Registrando…" : "Confirmar"}
        </button>
      </form>
    </Modal>
  );
}
