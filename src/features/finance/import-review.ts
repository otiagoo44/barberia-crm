import type { PreviewRow } from "./import-parser";

export const importColumns = [
  "Fecha",
  "Barbero",
  "Cliente / proveedor",
  "Concepto",
  "Tipo",
  "Ingresos",
  "Egresos",
  "Medio de pago",
];
export const importIssues: Record<string, string> = {
  SOURCE_FORMULA_OR_ERROR: "Hay una fórmula o un error en un dato original.",
  UNKNOWN_MOVEMENT_TYPE: "Elegí Ingreso o Egreso.",
  INVALID_DATE: "Revisá la fecha.",
  INVALID_INTEGER_AMOUNT: "Ingresá importes enteros y positivos.",
  EXPENSE_WITH_INCOME_AMOUNT: "Dice Egreso, pero tiene un importe en Ingresos.",
  INCOME_WITH_EXPENSE_AMOUNT: "Dice Ingreso, pero tiene un importe en Egresos.",
  MISSING_POSITIVE_AMOUNT: "Falta el importe del movimiento.",
  PAYMENT_METHOD_NEEDS_MAPPING: "Falta vincular el medio de pago.",
  STAFF_NEEDS_MAPPING: "Falta vincular el barbero.",
  CONCEPT_NEEDS_MAPPING: "Falta vincular el servicio o concepto de ingreso.",
  CATEGORY_NEEDS_MAPPING: "Falta vincular la categoría del gasto.",
  STAFF_REQUIRED_FOR_PAYOUT: "Elegí el barbero que recibió el adelanto o pago.",
  REVIEW_REASON_REQUIRED: "Escribí el motivo de la corrección.",
};
export function importTotals(rows: PreviewRow[]) {
  let income = 0n,
    expense = 0n;
  for (const row of rows) {
    if (row.review_status !== "READY") continue;
    const amount = String(row.normalized.amount_minor);
    if (!/^\d+$/.test(amount)) continue;
    if (row.normalized.type === "income") income += BigInt(amount);
    if (row.normalized.type === "expense") expense += BigInt(amount);
  }
  return {
    income: income.toString(),
    expense: expense.toString(),
    balance: (income - expense).toString(),
  };
}
export function importFingerprint(rows: PreviewRow[]) {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, value]) => [k, stable(value)]),
          )
        : v;
  return JSON.stringify(
    stable(
      rows
        .map(
          ({
            source_sheet,
            source_row,
            raw_values,
            normalized,
            anomalies,
            review_status,
          }) => ({
            source_sheet,
            source_row,
            raw_values,
            normalized,
            anomalies,
            review_status,
          }),
        )
        .sort((a, b) => a.source_row - b.source_row),
    ),
  );
}
