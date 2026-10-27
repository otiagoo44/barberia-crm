import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

export type ImportEntity = { id: string; name: string; kind?: string };
export type ImportCatalog = {
  staff: ImportEntity[];
  services: ImportEntity[];
  items: ImportEntity[];
  payment_methods: ImportEntity[];
  categories: ImportEntity[];
};
export type ImportMapping = Partial<
  Record<
    "staff" | "services" | "items" | "payment_methods" | "categories",
    Record<string, string>
  >
>;
export type SourceCell = { value: string; formula?: string; error?: boolean };
export type ImportCorrections = Record<
  string,
  {
    cells: Partial<
      Record<"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7", string>
    >;
    reason: string;
  }
>;
export type SourceRow = {
  source_sheet: string;
  source_row: number;
  cells: SourceCell[];
};
export type PreviewRow = {
  source_sheet: string;
  source_row: number;
  raw_values: SourceCell[];
  normalized: Record<string, string | number | null>;
  anomalies: string[];
  review_status: "READY" | "NEEDS_REVIEW" | "EXCLUDED";
};
export function canonical(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function match(
  name: string,
  kind: keyof ImportCatalog,
  catalog: ImportCatalog,
  mapping: ImportMapping,
): string | null {
  const key = canonical(name);
  const mapped = mapping[kind]?.[key];
  if (mapped) return catalog[kind].some((e) => e.id === mapped) ? mapped : null;
  const options = catalog[kind].filter((e) => canonical(e.name) === key);
  return options.length === 1 ? options[0].id : null;
}
function integer(value: string): number | null {
  if (!/^\d+(?:\.0+)?$/.test(value.trim())) return null;
  const v = Number(value);
  return Number.isSafeInteger(v) && v >= 0 && v <= 9000000000000 ? v : null;
}
export function excelDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 25569 || n > 100000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function normalizeRows(
  rows: SourceRow[],
  catalog: ImportCatalog,
  mapping: ImportMapping = {},
  excluded: number[] = [],
  corrections: ImportCorrections = {},
): PreviewRow[] {
  return rows
    .filter((row) =>
      row.cells.slice(1, 8).some((c) => c.value.trim() || c.formula),
    )
    .map((row) => {
      const original = Array.from(
        { length: 8 },
        (_, i) => row.cells[i] ?? { value: "" },
      );
      const correction = corrections[String(row.source_row)];
      const cells = original.map((cell, index) => {
        const replacement =
          correction?.cells[String(index) as keyof typeof correction.cells];
        return replacement === undefined ? cell : { value: replacement };
      });
      const values = cells.map((c) => c.value.trim());
      const [date, barber, person, concept, type, income, expense, method] =
        values;
      const anomalies: string[] = [];
      if (correction && correction.reason.trim().length < 3)
        anomalies.push("REVIEW_REASON_REQUIRED");
      if (
        cells.some(
          (c) =>
            c.formula ||
            c.error ||
            /#(?:NAME\?|REF!|VALUE!|DIV\/0!)/i.test(c.value),
        )
      )
        anomalies.push("SOURCE_FORMULA_OR_ERROR");
      const movement =
        canonical(type) === "ingreso"
          ? "income"
          : canonical(type) === "egreso"
            ? "expense"
            : null;
      if (!movement) anomalies.push("UNKNOWN_MOVEMENT_TYPE");
      const occurred = excelDate(date);
      if (!occurred) anomalies.push("INVALID_DATE");
      const incoming = income ? integer(income) : 0;
      const outgoing = expense ? integer(expense) : 0;
      if (incoming === null || outgoing === null)
        anomalies.push("INVALID_INTEGER_AMOUNT");
      if (movement === "expense" && incoming !== 0)
        anomalies.push("EXPENSE_WITH_INCOME_AMOUNT");
      if (movement === "income" && outgoing !== 0)
        anomalies.push("INCOME_WITH_EXPENSE_AMOUNT");
      const amount = movement === "income" ? incoming : outgoing;
      if (!amount) anomalies.push("MISSING_POSITIVE_AMOUNT");
      const paymentMethod = match(method, "payment_methods", catalog, mapping);
      if (!paymentMethod) anomalies.push("PAYMENT_METHOD_NEEDS_MAPPING");
      const staff = barber ? match(barber, "staff", catalog, mapping) : null;
      if (barber && !staff) anomalies.push("STAFF_NEEDS_MAPPING");
      const service =
        movement === "income"
          ? match(concept, "services", catalog, mapping)
          : null;
      const item =
        movement === "income" && !service
          ? match(concept, "items", catalog, mapping)
          : null;
      const category =
        movement === "expense"
          ? match(concept, "categories", catalog, mapping)
          : null;
      if (movement === "income" && !service && !item)
        anomalies.push("CONCEPT_NEEDS_MAPPING");
      if (movement === "expense" && !category)
        anomalies.push("CATEGORY_NEEDS_MAPPING");
      const categoryKind =
        catalog.categories.find((c) => c.id === category)?.kind ?? null;
      if (categoryKind && categoryKind !== "operating" && !staff)
        anomalies.push("STAFF_REQUIRED_FOR_PAYOUT");
      return {
        source_sheet: row.source_sheet,
        source_row: row.source_row,
        raw_values: original,
        normalized: {
          date: occurred,
          type: movement,
          staff_id: staff,
          service_id: service,
          item_id: item,
          category_id: category,
          category_kind: categoryKind,
          payment_method_id: paymentMethod,
          person_label: person,
          concept,
          amount_minor: amount,
          ...(correction
            ? {
                review_reason: correction.reason.trim(),
                corrected_fields: JSON.stringify(correction.cells),
              }
            : {}),
        },
        anomalies,
        review_status: excluded.includes(row.source_row)
          ? "EXCLUDED"
          : anomalies.length
            ? "NEEDS_REVIEW"
            : "READY",
      };
    });
}
type XmlRecord = Record<string, unknown>;
function object(v: unknown): XmlRecord {
  return typeof v === "object" && v !== null ? (v as XmlRecord) : {};
}
function array(v: unknown): unknown[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
function value(v: unknown): string {
  return typeof v === "object" && v !== null
    ? value(object(v)["#text"])
    : String(v ?? "");
}
export function parseXlsx(bytes: Uint8Array): SourceRow[] {
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  if (
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  )
    throw new Error("INVALID_WORKBOOK");
  let total = 0;
  const parts = unzipSync(bytes, {
    filter: (file) => {
      const allowed =
        /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(
          file.name,
        );
      if (allowed) {
        total += file.originalSize;
        if (file.originalSize > 4 * 1024 * 1024 || total > 12 * 1024 * 1024)
          throw new Error("WORKBOOK_EXPANSION_LIMIT");
      }
      return allowed;
    },
  });
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: false,
  });
  function xml(name: string): XmlRecord {
    const bytes = parts[name];
    if (!bytes) throw new Error("INVALID_WORKBOOK");
    const text = strFromU8(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("UNSAFE_XML");
    return object(parser.parse(text));
  }
  const relationships = array(
    object(xml("xl/_rels/workbook.xml.rels").Relationships).Relationship,
  ).map(object);
  const sheet = array(
    object(object(xml("xl/workbook.xml").workbook).sheets).sheet,
  )
    .map(object)
    .find((s) => canonical(value(s["@_name"])) === "registro diario");
  if (!sheet) throw new Error("REGISTRO_DIARIO_NOT_FOUND");
  const relationship = relationships.find((r) => r["@_Id"] === sheet["@_r:id"]);
  const target = value(relationship?.["@_Target"]);
  const sheetPath = target.startsWith("/xl/")
    ? target.slice(1)
    : "xl/" + target;
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(sheetPath))
    throw new Error("UNSAFE_SHEET_PATH");
  const shared = parts["xl/sharedStrings.xml"]
    ? array(object(xml("xl/sharedStrings.xml").sst).si).map((v) => {
        const si = object(v);
        return si.t !== undefined
          ? value(si.t)
          : array(si.r)
              .map((r) => value(object(r).t))
              .join("");
      })
    : [];
  const rows = array(object(object(xml(sheetPath).worksheet).sheetData).row);
  if (rows.length > 2000) throw new Error("TOO_MANY_ROWS");
  return rows
    .map(object)
    .filter((r) => Number(r["@_r"]) > 1)
    .map((r) => {
      const cells: SourceCell[] = Array.from({ length: 8 }, () => ({
        value: "",
      }));
      for (const c of array(r.c).map(object)) {
        const column = value(c["@_r"]).match(/^([A-H])\d+$/)?.[1];
        if (!column) continue;
        const raw = value(c.v);
        cells[column.charCodeAt(0) - 65] = {
          value:
            c["@_t"] === "s"
              ? (shared[Number(raw)] ?? "")
              : c["@_t"] === "inlineStr"
                ? value(object(c.is).t)
                : raw,
          ...(c.f !== undefined ? { formula: value(c.f) } : {}),
          ...(c["@_t"] === "e" ? { error: true } : {}),
        };
      }
      return {
        source_sheet: "Registro Diario",
        source_row: Number(r["@_r"]),
        cells,
      };
    });
}
export function parseCsv(text: string): SourceRow[] {
  if (Buffer.byteLength(text) > 2 * 1024 * 1024)
    throw new Error("FILE_TOO_LARGE");
  if (text.includes("\0")) throw new Error("INVALID_CSV_STRUCTURE");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("INVALID_CSV_QUOTES");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (
    rows.length > 2000 ||
    canonical(rows[0]?.[0]?.replace(/^\ufeff/, "") ?? "") !== "fecha"
  )
    throw new Error("INVALID_CSV_STRUCTURE");
  return rows.slice(1).map((cells, i) => ({
    source_sheet: "Registro Diario",
    source_row: i + 2,
    cells: cells.slice(0, 8).map((value) => ({ value })),
  }));
}
export function sourceHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
