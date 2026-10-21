import { api } from "@/lib/client";
export type FinanceRow = { id: string; [key: string]: unknown };
export type FinanceCatalog = {
  payment_methods: FinanceRow[];
  items: FinanceRow[];
  services: FinanceRow[];
  staff: FinanceRow[];
  categories: FinanceRow[];
  fee_rules: FinanceRow[];
  commission_rules: FinanceRow[];
  settings: FinanceRow | null;
};
export function financeUrl(
  view: string,
  org: string,
  branch: string,
  from: string,
  to = from,
  extra: Record<string, string> = {},
) {
  return (
    `/api/finance/${view}?` +
    new URLSearchParams({ org, branch, from, to, ...extra })
  );
}
export function financeCommand(
  org: string,
  branch: string,
  action: string,
  data: Record<string, unknown>,
  key = crypto.randomUUID(),
) {
  return api<FinanceRow>("/api/finance/command", {
    org,
    branch,
    action,
    data,
    key,
  });
}
export function money(value: unknown, currency: string) {
  if (
    currency === "PYG" &&
    ((typeof value === "string" && /^-?\d+$/.test(value)) ||
      typeof value === "bigint")
  )
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(BigInt(value as string | bigint));
  if (typeof value === "number" && !Number.isSafeInteger(value))
    return "No disponible";
  return value === null || value === undefined
    ? "No disponible"
    : new Intl.NumberFormat("es-PY", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "PYG" ? 0 : 2,
      }).format(Number(value) / (currency === "PYG" ? 1 : 100));
}
export function integerInput(value: string) {
  if (!/^\d+$/.test(value))
    throw new Error("Ingresá un importe entero en unidad mínima.");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > 9000000000000)
    throw new Error("Importe fuera de rango.");
  return n;
}
export function amountLabel(currency: string) {
  return currency === "PYG"
    ? "Importe en guaraníes (Gs.)"
    : `Importe en centavos (${currency})`;
}
