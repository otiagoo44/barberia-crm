import { readFile } from "node:fs/promises";
import {
  normalizeRows,
  parseXlsx,
  sourceHash,
  type ImportCatalog,
} from "../src/features/finance/import-parser";
import { confirmedImportCorrections } from "../src/features/finance/confirmed-import";
import { importTotals } from "../src/features/finance/import-review";
const file = process.argv[2];
if (!file)
  throw new Error(
    "Usage: npx tsx scripts/finance-dry-run.ts <xlsx path>. Read-only, no database writes.",
  );
const bytes = await readFile(file);
// Diagnostic identities only. These are never written to a database or treated as live entity IDs.
const entities = (names: string[]) =>
  names.map((name, index) => ({ id: "diagnostic-only-" + index, name }));
const catalog: ImportCatalog = {
  staff: entities(["Jonatan", "Esteban"]),
  services: entities([
    "corte de pelo",
    "barba",
    "perfilado de cejas",
    "lavado",
    "rulos",
    "combo rulos y corte",
    "tinte global",
    "tinte mechas",
  ]),
  items: entities(["venta de productos", "curso"]),
  payment_methods: entities(["Efectivo", "Transferencia", "Débito", "Crédito"]),
  categories: entities([
    "alquiler",
    "contadora",
    "servicios",
    "adelantos",
    "salario",
  ]).map((e) => ({
    ...e,
    kind:
      e.name === "adelantos"
        ? "advance"
        : e.name === "salario"
          ? "salary"
          : "operating",
  })),
};
const corrections = process.argv.includes("--confirmed-1717")
  ? confirmedImportCorrections("1717-barberia", sourceHash(bytes))
  : {};
const preview = normalizeRows(parseXlsx(bytes), catalog, {}, [], corrections);
const anomalies: Record<string, number[]> = {};
for (const row of preview)
  for (const anomaly of row.anomalies)
    (anomalies[anomaly] ??= []).push(row.source_row);
console.log(
  JSON.stringify(
    {
      dry_run: true,
      database_writes: 0,
      source_sha256: sourceHash(bytes),
      source_sheet: "Registro Diario",
      source_rows: preview.length,
      ready: preview.filter((r) => r.review_status === "READY").length,
      needs_review: preview.filter((r) => r.review_status === "NEEDS_REVIEW")
        .length,
      anomalies,
      owner_confirmed_corrections: Object.keys(corrections).map(Number),
      totals_before_commissions: importTotals(preview),
      historical_rules:
        "not inferred; runtime import requires actual entity IDs and historical rules",
    },
    null,
    2,
  ),
);
