import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import {
  normalizeRows,
  parseCsv,
} from "../../src/features/finance/import-parser";
const catalog = {
  payment_methods: [
    { id: "bank", name: "Transferencia", type: "bank" },
    { id: "debit", name: "Débito", type: "card" },
  ],
  staff: [{ id: "barber", name: "Barber QA" }],
  services: [{ id: "cut", name: "Corte", price_minor: 30000 }],
  items: [{ id: "course", name: "Curso", price_minor: null }],
  categories: [{ id: "utility", name: "Servicios", kind: "operating" }],
  settings: null,
  fee_rules: [],
  commission_rules: [],
};
const book = {
  totals: {
    income_minor: "30000",
    expense_minor: "1000",
    balance_before_fees_minor: "29000",
    net_minor: null,
    unknown_fees: 1,
  },
  methods: [
    {
      payment_method_id: "debit",
      payment_method: "Débito",
      income_minor: "30000",
      expense_minor: "1000",
      balance_before_fees_minor: "29000",
      net_minor: null,
    },
  ],
  items: [
    {
      id: "payment",
      local_date: "2026-10-26",
      staff_name: "Barber QA",
      person: "Synthetic visitor",
      concept: "Corte",
      kind: "Ingreso",
      income_minor: "30000",
      expense_minor: "0",
      payment_method: "Débito",
      fee_minor: null,
      fee_status: "unknown",
    },
  ],
};
test("daily book records collected income with one submit and stays readable on mobile", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await page.route("**/api/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1);
    if (resource === "command") {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { id: "new-income" } });
    }
    return route.fulfill({
      json:
        resource === "catalog"
          ? catalog
          : resource === "daybook"
            ? book
            : resource === "cash"
              ? { session: null }
              : { items: [] },
    });
  });
  await page.goto("/fixture-a/finanzas");
  await expect(
    page.getByRole("heading", { name: "Registro diario", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Costo POS pendiente", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar ingreso", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Concepto", exact: true })
    .selectOption("service:cut");
  await expect(
    page.getByLabel("Importe en guaraníes (Gs.)", { exact: true }),
  ).toHaveValue("30000");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Barbero", exact: true })
    .selectOption("barber");
  await page
    .getByRole("combobox", { name: "Medio de pago", exact: true })
    .selectOption("debit");
  await page.getByLabel("Cliente (opcional)").fill("Synthetic walk-in");
  await page.getByRole("button", { name: "Guardar ingreso cobrado" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    action: "record_income",
    data: {
      service_id: "cut",
      staff_id: "barber",
      amount_minor: 30000,
      payment_method_id: "debit",
      person_label: "Synthetic walk-in",
    },
  });
  await mkdir(".test-data/daybook-visual", { recursive: true });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `.test-data/daybook-visual/daybook-${width}.png`,
      fullPage: true,
    });
  }
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("Sheets import reviews corrections without writes, then commits the exact reviewed rows", async ({
  page,
}) => {
  const requests: { action: string; dry_run?: boolean }[] = [];
  await page.route("**/api/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1);
    if (resource === "import") {
      const p = route.request().postDataJSON();
      requests.push(p);
      if (p.action === "confirm")
        return route.fulfill({ json: { id: "batch", imported_rows: 2 } });
      const rows = normalizeRows(
        parseCsv(Buffer.from(p.content, "base64").toString("utf8")),
        catalog,
        p.mapping,
        p.excluded_rows,
        p.corrections,
      );
      return route.fulfill({
        json: {
          rows,
          corrections: p.corrections,
          ...(p.dry_run
            ? { dry_run: true }
            : { id: "batch", preview_hash: "a".repeat(64) }),
        },
      });
    }
    return route.fulfill({
      json:
        resource === "catalog"
          ? catalog
          : resource === "daybook"
            ? book
            : { items: [] },
    });
  });
  await page.goto("/fixture-a/finanzas");
  await page.getByRole("button", { name: "Importar Excel / Sheets" }).click();
  await page.getByLabel("Archivo XLSX o CSV").setInputFiles({
    name: "Synthetic Sheets export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Fecha,Barbero,Cliente,Concepto,Tipo,Ingresos,Egresos,Medio de pago\n2026-04-06,Barber QA,Synthetic visitor,Corte,ingreso,30000,,Débito\n2026-04-06,,,Servicios,egreso,,1000,",
    ),
  });
  await page
    .getByRole("button", { name: "Analizar archivo", exact: true })
    .click();
  await expect(page.getByText(/1 listas · 1 por revisar/)).toBeVisible();
  expect(requests.every((r) => r.dry_run === true)).toBeTruthy();
  await page
    .getByRole("button", { name: "Corregir fila", exact: true })
    .click();
  await page.getByLabel("Medio de pago", { exact: true }).fill("Transferencia");
  await page
    .getByLabel("Motivo de la corrección")
    .fill("Payment method confirmed");
  await expect(
    page.getByRole("button", { name: /Confirmar importación/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Actualizar revisión", exact: true })
    .click();
  await expect(page.getByText(/2 listas · 0 por revisar/)).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar importación de 2 movimientos" })
    .click();
  await expect(page.getByText(/Histórico importado/)).toBeVisible();
  expect(requests.map((r) => [r.action, r.dry_run])).toEqual([
    ["preview", true],
    ["preview", true],
    ["preview", false],
    ["confirm", undefined],
  ]);
});
