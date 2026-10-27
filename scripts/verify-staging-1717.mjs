/* global document, innerWidth */
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const project = "zdogqqmitpbwjgohwcww";
const base = process.env.STAGING_APP_URL ?? "http://localhost:3008";
assert.ok(
  [
    "localhost",
    "127.0.0.1",
    "barberia-crm-git-release-1-a06896-ortegatiago733-2656s-projects.vercel.app",
  ].includes(new URL(base).hostname),
);
const f = JSON.parse(
  await readFile(".test-data/staging-activation/fixtures.json", "utf8"),
);
const out = "docs/verification/activation-20261026/staging-browser";
await mkdir(out, { recursive: true });
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
const checks = [];
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
const headers = { Origin: base };
async function post(resource, data) {
  const response = await page.request.post(base + resource, { headers, data });
  const body = await response.json();
  assert.ok(
    response.ok(),
    `${resource}: HTTP ${response.status()} ${body.error ?? ""}`,
  );
  return body;
}
async function command(action, data) {
  return post("/api/finance/command", {
    org: f.orgA,
    branch: f.branches.a1,
    action,
    data,
    key: randomUUID(),
  });
}
async function record(entity, data, id = null, branch = null) {
  return post("/api/workspace/record", {
    org: f.orgA,
    entity,
    id,
    branch,
    data,
  });
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
  checks.push({
    flow: "genuine GoTrue password + MFA through application HTTP",
    status: "PASSED",
  });
  const suffix = randomUUID().slice(0, 8);
  await page.goto(base + "/staging1717-a/servicios");
  await page
    .getByRole("button", { name: "Agregar servicio", exact: true })
    .click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Synthetic staging service " + suffix);
  await page
    .getByRole("textbox", { name: "Identificador público", exact: true })
    .fill("qa-" + suffix);
  await page.getByLabel("Duración (minutos)", { exact: true }).fill("40");
  const saved = page.waitForResponse(
    (r) =>
      r.url().includes("/api/workspace/record") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const savedResponse = await saved;
  assert.equal(savedResponse.ok(), true);
  const service = (await savedResponse.json()).id;
  await expect(
    page.getByText(/Servicio guardado. Siguiente paso/),
  ).toBeVisible();
  await record(
    "services",
    { name: "Synthetic staging service edited " + suffix },
    service,
  );
  checks.push({
    flow: "create service in browser, edit through authorized application API",
    status: "PASSED",
  });
  const rulesResponse = await page.request.get(
    `${base}/api/workspace/staff_availability_rules?org=${f.orgA}&branch=${f.branches.a1}`,
  );
  assert.equal(rulesResponse.ok(), true);
  const rules = (await rulesResponse.json()).items;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekday = new Date(tomorrow + "T12:00:00Z").getUTCDay();
  await post("/api/workspace/weekly_schedule", {
    org: f.orgA,
    branch: f.branches.a1,
    staff: f.staff.a3,
    from: tomorrow,
    days: [weekday],
    blocks: [
      { weekday, starts_at: "09:00", ends_at: "12:00" },
      { weekday, starts_at: "12:30", ends_at: "19:00" },
    ],
    expected: rules
      .filter((r) => r.staff_id === f.staff.a3 && r.weekday === weekday)
      .map(({ id, updated_at }) => ({ id, updated_at })),
    key: randomUUID(),
  });
  checks.push({
    flow: "weekly schedule transaction with real concurrency versions and break",
    status: "PASSED",
  });
  const customer = await record("customers", {
    name: "Synthetic staging customer QA " + suffix,
    normalized_phone: "+12025550177",
    home_branch_id: f.branches.a1,
  });
  await record(
    "customers",
    { name: "Synthetic staging customer edited QA " + suffix },
    customer.id,
  );
  const walkin = await post("/api/workspace/walkin", {
    org: f.orgA,
    branch: f.branches.a1,
    customer: customer.id,
    customer_data: null,
    services: [f.services.cut],
    preferred_staff: f.staff.a2,
    key: randomUUID(),
  });
  const assigned = await post("/api/workspace/assign_walkin", {
    org: f.orgA,
    id: walkin.id,
    staff: f.staff.a2,
    starts_at: new Date().toISOString(),
    key: randomUUID(),
  });
  for (const status of ["checked_in", "in_service", "completed"])
    await post("/api/workspace/transition", {
      org: f.orgA,
      id: assigned.appointment_id,
      status,
      key: randomUUID(),
      reason: null,
    });
  checks.push({
    flow: "create/edit customer; walk-in → assigned appointment → completed service",
    status: "PASSED",
  });
  const methods = {};
  for (const [code, type] of [
    ["cash", "cash"],
    ["transfer", "bank"],
    ["debit", "card"],
    ["credit", "card"],
  ]) {
    methods[code] = (
      await command("configure", {
        entity: "payment_methods",
        name: "Synthetic " + code + " QA " + suffix,
        code: "qa_" + code + "_" + suffix,
        type,
      })
    ).id;
    if (type !== "card")
      await command("configure", {
        entity: "payment_method_fee_rules",
        payment_method_id: methods[code],
        percentage_bps: 0,
        fixed_amount_minor: 0,
      });
  }
  const item = (
    await command("configure", {
      entity: "finance_items",
      name: "Synthetic POS verification QA " + suffix,
      kind: "product",
      price_minor: 10000,
    })
  ).id;
  const cash = (
    await command("open_cash_session", { opening_amount_minor: 1000 })
  ).id;
  for (const code of ["cash", "transfer", "debit", "credit"]) {
    let checkout = (
      await command("create_checkout", {
        lines: [{ item_id: item, quantity: 1 }],
      })
    ).id;
    if (["debit", "credit"].includes(code)) {
      const pending = await page.request.post(base + "/api/finance/command", {
        headers,
        data: {
          org: f.orgA,
          branch: f.branches.a1,
          action: "post_checkout",
          data: {
            id: checkout,
            payments: [
              { payment_method_id: methods[code], amount_minor: 10000 },
            ],
          },
          key: randomUUID(),
        },
      });
      assert.ok(
        pending.ok(),
        "Cards can be recorded with an explicit pending cost",
      );
      const pendingCheckout = await (
        await page.request.get(
          base +
            "/api/finance/checkout?" +
            new URLSearchParams({
              org: f.orgA,
              branch: f.branches.a1,
              id: checkout,
              from: new Date().toISOString().slice(0, 10),
              to: new Date().toISOString().slice(0, 10),
            }),
        )
      ).json();
      assert.equal(pendingCheckout.payments[0].fee_minor, null);
      assert.equal(pendingCheckout.payments[0].fee_status, "unknown");
      checks.push({
        flow: code + " without fee evidence",
        status: "PASSED_WITH_PENDING_COST",
        production_action: "PENDING_EVIDENCE; no zero fee fabricated",
      });
      await command("configure", {
        entity: "payment_method_fee_rules",
        payment_method_id: methods[code],
        percentage_bps: code === "debit" ? 220 : 520,
        fixed_amount_minor: 0,
        evidence_reference:
          "Synthetic test values only; not UPay contractual evidence",
      });
      checkout = (
        await command("create_checkout", {
          lines: [{ item_id: item, quantity: 1 }],
        })
      ).id;
    }
    await command("post_checkout", {
      id: checkout,
      payments: [
        {
          payment_method_id: methods[code],
          amount_minor: 10000,
          ...(code === "cash" ? { cash_session_id: cash } : {}),
        },
      ],
    });
    checks.push({
      flow: code + " checkout/payment",
      status: "PASSED",
      rates: "synthetic fixture only",
    });
  }
  const category = (
    await command("configure", {
      entity: "expense_categories",
      name: "Synthetic QA expense " + suffix,
      code: "qa_exp_" + suffix,
      kind: "operating",
    })
  ).id;
  await command("create_expense", {
    category_id: category,
    payment_method_id: methods.cash,
    cash_session_id: cash,
    amount_minor: 100,
    description: "Synthetic staging expense QA",
  });
  await command("close_cash_session", { id: cash, actual_cash_minor: 10900 });
  checks.push({
    flow: "expense and cash close with exact cash balance",
    status: "PASSED",
  });
  for (const module of [
    "inicio",
    "agenda",
    "clientes",
    "equipo",
    "servicios",
    "caja",
    "finanzas",
    "reportes",
    "configuracion",
  ]) {
    await page.goto(`${base}/staging1717-a/${module}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator("main .loading")).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    checks.push({
      flow: module + " renders real staging data",
      status: "PASSED",
    });
  }
  await page.goto(base + "/staging1717-a/finanzas");
  await page.setViewportSize({ width: 360, height: 1000 });
  await page
    .locator("summary")
    .filter({ hasText: "Filtros financieros" })
    .click();
  await page
    .getByRole("combobox", { name: "Período", exact: true })
    .selectOption("7");
  await expect(page.locator("main .loading")).toHaveCount(0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: out + "/finance-360.png", fullPage: true });
  checks.push({ flow: "real-data mobile finance filters", status: "PASSED" });
  const publicPage = await browser.newPage({
    viewport: { width: 390, height: 1000 },
  });
  await publicPage.setContent(
    `<a href="${base}/book/staging1717-a/a1">Reservar en CRM staging · landing sintética QA</a>`,
  );
  await publicPage.getByRole("link").click();
  await publicPage.getByLabel("cut", { exact: true }).check();
  await publicPage.getByLabel("Fecha", { exact: true }).fill(tomorrow);
  await expect(publicPage.locator(".slot-grid button").first()).toBeVisible({
    timeout: 30000,
  });
  await publicPage.locator(".slot-grid button").first().click();
  await publicPage
    .locator('input[name="name"]')
    .fill("Synthetic public booking QA " + suffix);
  await publicPage.locator('input[name="phone"]').fill("+12025550188");
  await publicPage
    .getByRole("button", { name: "Confirmar mi reserva" })
    .click();
  await expect(
    publicPage.getByRole("heading", { name: "Tu reserva quedó registrada" }),
  ).toBeVisible({ timeout: 30000 });
  await publicPage.screenshot({
    path: out + "/public-booking-390.png",
    fullPage: true,
  });
  checks.push({
    flow: "synthetic landing link → staging hosted booking → actual reservation",
    status: "PASSED",
    live_landing: "NOT_TESTED",
  });
  assert.deepEqual(browserErrors, []);
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        project,
        app: base,
        synthetic_only: true,
        checks,
        browserErrors,
        status: "PASSED",
        email_delivery: "NOT_TESTED: synthetic .invalid fixture users",
        production_booking: "CLOSED; no production writes",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASSED: ${checks.length} staging flow checks, genuine Auth/MFA, synthetic records only.`,
  );
} catch (error) {
  await page
    .screenshot({ path: out + "/failure.png", fullPage: true })
    .catch(() => {});
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        project,
        synthetic_only: true,
        checks,
        status: "FAILED",
        failure: error.message,
        browserErrors,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
