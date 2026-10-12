import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  normalizeRows,
  parseXlsx,
  parseCsv,
  excelDate,
  type ImportCatalog,
} from "../../src/features/finance/import-parser";
import { preselectedServices } from "../../src/lib/booking-links";
import { csvCell } from "../../src/lib/validation";
const catalog: ImportCatalog = {
  staff: [{ id: "staff-a", name: "Barber A" }],
  services: [{ id: "service-a", name: "Corte de pelo" }],
  items: [],
  payment_methods: [
    { id: "cash", name: "Efectivo" },
    { id: "debit", name: "Débito" },
  ],
  categories: [{ id: "rent", name: "Alquiler", kind: "operating" }],
};
const row = (values: string[], source_row = 2) => ({
  source_sheet: "Registro Diario",
  source_row,
  cells: values.map((value) => ({ value })),
});
test("import uses structured entities, casing and whitespace normalization", () => {
  const r = normalizeRows(
    [
      row([
        "46148",
        " barber a ",
        "Sin identidad",
        " CORTE DE PELO ",
        "Ingreso",
        "100000",
        "",
        " EFECTIVO ",
      ]),
    ],
    catalog,
  )[0];
  assert.equal(r.review_status, "READY");
  assert.equal(r.normalized.staff_id, "staff-a");
  assert.equal(r.normalized.amount_minor, 100000);
  assert.equal(r.normalized.date, excelDate("46148"));
  assert.equal(r.normalized.customer_id, undefined);
});
test("wrong-side amount, ambiguity, negative values and source formulas require review", () => {
  const expense = normalizeRows(
    [
      row(
        ["46148", "", "Vendor", "Alquiler", "egreso", "40000", "", "Efectivo"],
        110,
      ),
    ],
    catalog,
  )[0];
  assert.ok(expense.anomalies.includes("EXPENSE_WITH_INCOME_AMOUNT"));
  assert.equal(expense.review_status, "NEEDS_REVIEW");
  const source = row([
    "46148",
    "Barber A",
    "Name",
    "Corte de pelo",
    "ingreso",
    "-1",
    "",
    "Efectivo",
  ]);
  source.cells[5] = {
    value: "#NAME?",
    formula: "__xludf.DUMMYFUNCTION(1)",
  } as { value: string };
  assert.ok(
    normalizeRows([source], catalog)[0].anomalies.includes(
      "SOURCE_FORMULA_OR_ERROR",
    ),
  );
  assert.equal(
    normalizeRows(
      [
        row([
          "46148",
          "Barber A",
          "Name",
          "Corte de pelo",
          "ingreso",
          "100000",
          "",
          "Efectivo",
        ]),
      ],
      {
        ...catalog,
        staff: [...catalog.staff, { id: "staff-b", name: "BARBER A" }],
      },
    )[0].review_status,
    "NEEDS_REVIEW",
  );
});
test("anonymized XLSX fixture ignores broken derived formulas and retains source row", () => {
  const parts = {
    "xl/workbook.xml": strToU8(
      '<workbook><sheets><sheet name="Registro Diario" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/sharedStrings.xml": strToU8(
      "<sst><si><t>Barber A</t></si><si><t>Corte de pelo</t></si><si><t>Ingreso</t></si><si><t>Efectivo</t></si></sst>",
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      '<worksheet><sheetData><row r="2"><c r="A2"><v>46148</v></c><c r="B2" t="s"><v>0</v></c><c r="D2" t="s"><v>1</v></c><c r="E2" t="s"><v>2</v></c><c r="F2"><v>100000</v></c><c r="H2" t="s"><v>3</v></c><c r="I2" t="e"><f>__xludf.DUMMYFUNCTION(1)</f><v>#NAME?</v></c><c r="K2"><v>999999</v></c></row></sheetData></worksheet>',
    ),
  };
  const parsed = parseXlsx(zipSync(parts));
  assert.equal(parsed[0].source_row, 2);
  assert.equal(parsed[0].cells.length, 8);
  const normalized = normalizeRows(parsed, catalog)[0];
  assert.equal(normalized.review_status, "READY");
  assert.equal(normalized.normalized.amount_minor, 100000);
});
test("CSV quoting and export formula injection", () => {
  const parsed = parseCsv(
    'Fecha,Barbero,Cliente,Concepto,Tipo,Ingreso,Egreso,Medio\n2026-04-06,Barber A,"Name, anonymized",Corte de pelo,Ingreso,100000,,Efectivo',
  );
  assert.equal(parsed[0].cells[2].value, "Name, anonymized");
  assert.ok(csvCell('  =HYPERLINK("bad")').startsWith("\"'"));
  assert.ok(csvCell("\n@SUM(1)").startsWith("\"'"));
});
test("booking deep link only selects an available canonical service", () => {
  const services = [
    { slug: "cut", composition_mode: "standalone", base_service_slug: null },
    {
      slug: "curl",
      composition_mode: "standalone",
      base_service_slug: null,
      consultation_required: true,
    },
  ];
  assert.deepEqual(preselectedServices("cut", services), ["cut"]);
  assert.deepEqual(preselectedServices("other-tenant", services), []);
  assert.deepEqual(preselectedServices("curl", services), []);
});
