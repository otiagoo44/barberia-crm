/* global document, innerWidth */
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const baseURL = process.env.QA_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
  throw new Error("Website fixture QA only supports localhost");
const catalog = {
  slug: "fixture-a",
  name: "Isolated booking fixture",
  currency: "PYG",
  brand_color: "#6fe2ff",
  logo_url: null,
  website_booking_version: 1,
  branches: [
    {
      slug: "a1",
      name: "Fixture branch",
      timezone: "America/Asuncion",
      address: "Fixture address",
      staff: [
        {
          slug: "a1",
          name: "Fixture staff",
          services: ["cut", "curl", "design"],
        },
      ],
      services: [
        {
          slug: "cut",
          name: "Corte fixture",
          composition_mode: "standalone",
          base_service_slug: null,
          price_minor: 30000,
          consultation_required: false,
          website_category: "corte",
        },
        {
          slug: "curl",
          name: "Rulos fixture",
          composition_mode: "standalone",
          base_service_slug: null,
          price_minor: 180000,
          consultation_required: true,
          website_category: "rulos",
        },
        {
          slug: "design",
          name: "Diseño fixture",
          composition_mode: "included",
          base_service_slug: "cut",
          price_minor: 0,
          consultation_required: false,
          website_category: null,
        },
      ],
    },
  ],
};
const out = process.env.QA_OUT || "test-results/website-booking";
await mkdir(out, { recursive: true });
const report = {
  mode: "Production Next build with intercepted public API fixtures; database rules verified separately in isolated PostgreSQL. No production bookings.",
  cases: [],
  errors: [],
  requests: [],
};
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  await page.route("**/api/public/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    report.requests.push({
      path: url.pathname,
      services: url.searchParams.getAll("service"),
    });
    if (url.pathname.endsWith("/catalog"))
      return route.fulfill({ json: catalog });
    if (url.pathname.endsWith("/availability"))
      return route.fulfill({
        json: [
          {
            starts_at: url.searchParams.get("date") + "T17:00:00-03:00",
            staff_slug: "a1",
            staff_name: "Fixture staff",
            duration_minutes: 40,
          },
        ],
      });
    if (url.pathname.endsWith("/booking")) {
      const body = req.postDataJSON();
      assert.deepEqual(body.services, ["cut"]);
      assert.equal(body.source, "website");
      assert.equal(body.organization, "fixture-a");
      assert.equal(body.branch, "a1");
      assert.equal("price_minor" in body, false);
      assert.equal("duration_minutes" in body, false);
      report.bookingBodyKeys = Object.keys(body);
      return route.fulfill({
        status: 201,
        json: {
          reference: "fixture-reference",
          starts_at: body.starts_at,
          ends_at: body.starts_at,
          duration_minutes: 40,
        },
      });
    }
    throw new Error("Unexpected public API route");
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [query, expected] of [
      ["source=website", []],
      ["service=cut&source=website", ["cut"]],
      ["service=design&source=website", ["cut", "design"]],
      ["service=missing&source=website", []],
      ["service=curl&source=website", []],
      ["service=cut&service=curl&source=internal", []],
    ]) {
      await page.goto(baseURL + "/book/fixture-a/a1?" + query);
      await page.locator(".service-options").waitFor();
      const chosen = await page
        .locator(".service-option")
        .evaluateAll((els) =>
          els
            .filter((e) => e.querySelector("input").checked)
            .map((e) => e.innerText.trim()),
        );
      assert.deepEqual(
        chosen,
        expected.map((s) =>
          s === "cut" ? "Corte fixture" : "Diseño fixture\nIncluido",
        ),
      );
      assert.ok(
        !(await page.locator("main").innerText()).includes("Rulos fixture"),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      report.cases.push({ width, query, selected: expected });
    }
  }
  await page.goto(baseURL + "/book/fixture-a/a1?service=cut&source=website");
  await page.locator(".slot-grid button").first().click();
  await page.locator('input[name="name"]').fill("Fixture client");
  await page.locator('input[name="phone"]').fill("+12025550199");
  await page.locator("button.primary").click();
  await page.locator(".public-confirmation").waitFor();
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(
    "CRM browser: 12 query/viewport combinations and fixture booking payload PASS",
  );
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  throw e;
} finally {
  await writeFile(
    out + "/crm-browser-fixtures.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
