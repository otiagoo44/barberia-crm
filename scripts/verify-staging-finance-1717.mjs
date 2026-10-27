/* global document, URLSearchParams */
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const project = "zdogqqmitpbwjgohwcww",
  base = "http://localhost:3008";
const f = JSON.parse(
  await readFile(".test-data/staging-activation/fixtures.json", "utf8"),
);
function totp(secret) {
  let bits = "";
  for (const c of secret)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
    offset = h[h.length - 1] & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "docs/verification/finance-20261026";
await mkdir(out, { recursive: true });
async function post(path, data) {
  const response = await page.request.post(base + path, {
    headers: { Origin: base },
    data,
  });
  const body = await response.json();
  assert.ok(response.ok(), `${path}: ${response.status()} ${body.error ?? ""}`);
  return body;
}
const command = (action, data) =>
  post("/api/finance/command", {
    org: f.orgA,
    branch: f.branches.a1,
    action,
    data,
    key: randomUUID(),
  });
const today = new Date().toISOString().slice(0, 10),
  q = new URLSearchParams({
    org: f.orgA,
    branch: f.branches.a1,
    from: today,
    to: today,
  });
async function get(view) {
  const r = await page.request.get(`${base}/api/finance/${view}?${q}`);
  assert.ok(r.ok(), `${view}: ${r.status()}`);
  return r.json();
}
try {
  await post("/api/auth/signin", {
    email: f.emails.ownerA,
    password: f.password,
  });
  await post("/api/auth/mfa/verify", {
    factor: f.mfa.ownerA.factor,
    code: totp(f.mfa.ownerA.secret),
  });
  const suffix = randomUUID().slice(0, 8);
  const card = (
    await command("configure", {
      entity: "payment_methods",
      name: "Synthetic pending debit " + suffix,
      code: "daily_" + suffix,
      type: "card",
    })
  ).id;
  const catalog = await get("catalog");
  const service = catalog.services.find((s) => s.id === f.services.cut);
  assert.ok(service);
  const staff = catalog.staff.find((s) => s.id === f.staff.a1);
  assert.ok(staff);
  await page.goto(base + "/staging1717-a/finanzas");
  await page
    .getByRole("button", { name: "Registrar ingreso", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Concepto", exact: true })
    .selectOption("service:" + service.id);
  await dialog
    .getByRole("combobox", { name: "Barbero", exact: true })
    .selectOption(staff.id);
  await dialog
    .getByRole("combobox", { name: "Medio de pago", exact: true })
    .selectOption(card);
  await dialog
    .getByLabel("Cliente (opcional)")
    .fill("Synthetic finance QA " + suffix);
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/finance/command") &&
      r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Guardar ingreso cobrado" }).click();
  const response = await saved;
  assert.ok(response.ok());
  const sale = await response.json();
  await expect(dialog).toHaveCount(0);
  const checkout = await (
    await page.request.get(`${base}/api/finance/checkout?${q}&id=${sale.id}`)
  ).json();
  assert.equal(checkout.status, "posted");
  assert.equal(checkout.payments[0].fee_status, "unknown");
  assert.equal(checkout.payments[0].fee_minor, null);
  assert.equal(Number(checkout.total_minor), Number(service.price_minor));
  checks.push({
    flow: "real GoTrue + MFA; one-submit collected service income; missing POS fee remains NULL",
    status: "PASSED",
  });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `${out}/staging-daybook-${width}.png`,
      fullPage: true,
    });
  }
  // Entirely synthetic export, shaped like the supplied workbook. No real file is uploaded.
  const bank = catalog.payment_methods.find((m) => m.type === "bank");
  assert.ok(bank);
  const category = catalog.categories.find((c) => c.kind === "operating");
  assert.ok(category);
  const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const csv = `Fecha,Barbero,Cliente,Concepto,Tipo,Ingresos,Egresos,Medio de pago\n${date},${staff.name},Synthetic history ${suffix},${service.name},egreso,12345,,${bank.name}\n${date},,Synthetic vendor ${suffix},${category.name},egreso,,123,${bank.name}`;
  const payload = {
    org: f.orgA,
    branch: f.branches.a1,
    filename: `synthetic-${suffix}.csv`,
    content: Buffer.from(csv).toString("base64"),
    corrections: {
      2: { cells: { 4: "ingreso" }, reason: "Synthetic owner confirmation" },
    },
    mapping: {},
    excluded_rows: [],
  };
  const simulation = await post("/api/finance/import", {
    ...payload,
    action: "preview",
    dry_run: true,
    key: randomUUID(),
  });
  assert.equal(simulation.rows.length, 2);
  assert.ok(simulation.rows.every((r) => r.review_status === "READY"));
  assert.equal(simulation.rows[0].raw_values[4].value, "egreso");
  assert.equal(simulation.rows[0].normalized.type, "income");
  const preview = await post("/api/finance/import", {
    ...payload,
    action: "preview",
    dry_run: false,
    key: randomUUID(),
  });
  const imported = await post("/api/finance/import", {
    org: f.orgA,
    branch: f.branches.a1,
    action: "confirm",
    id: preview.id,
    preview_hash: preview.preview_hash,
    key: randomUUID(),
  });
  assert.equal(imported.imported_rows, 2);
  const duplicate = await page.request.post(base + "/api/finance/import", {
    headers: { Origin: base },
    data: { ...payload, action: "preview", dry_run: false, key: randomUUID() },
  });
  assert.ok(!duplicate.ok());
  checks.push({
    flow: "synthetic Sheets-shaped historical import, corrected row provenance, atomic confirmation and duplicate-file rejection",
    status: "PASSED",
  });
  const book = await get("daybook");
  assert.ok(Number(book.totals.unknown_fees) > 0);
  assert.equal(book.totals.net_minor, null);
  assert.equal(errors.length, 0);
  const result = {
    project,
    production_project: "tbcfhagteyqufjkmbxzz",
    production_writes: 0,
    real_workbook_uploaded: false,
    checks,
    browser_errors: errors,
    checked_at: new Date().toISOString(),
  };
  await writeFile(
    `${out}/staging-results.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
