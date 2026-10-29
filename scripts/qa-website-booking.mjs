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
      phone: "+12025550199",
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
  let failBooking = false;
  let branchPhone = catalog.branches[0].phone;
  let bookingRequests = 0;
  const page = await browser.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    // The conflict scenario deliberately returns 409 from this exact fixture.
    if (m.type() === "error" && !(failBooking && m.text().includes("409 (Conflict)") && m.location().url.endsWith("/api/public/booking"))) report.errors.push(m.text());
  });
  await page.route("**/api/public/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    report.requests.push({
      path: url.pathname,
      services: url.searchParams.getAll("service"),
    });
    if (url.pathname.endsWith("/catalog"))
      return route.fulfill({ json: { ...catalog, branches: catalog.branches.map((b) => ({ ...b, phone: branchPhone })) } });
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
      bookingRequests++;
      const body = req.postDataJSON();
      assert.deepEqual(body.services, ["cut"]);
      assert.equal(body.source, "website");
      assert.equal(body.organization, "fixture-a");
      assert.equal(body.branch, "a1");
      assert.equal("price_minor" in body, false);
      assert.equal("duration_minutes" in body, false);
      report.bookingBodyKeys = Object.keys(body);
      if (failBooking) return route.fulfill({ status: 409, json: { error: "Horario ocupado" } });
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
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["success", "no-phone", "conflict"]) {
      failBooking = mode === "conflict";
      branchPhone = mode === "no-phone" ? null : "+12025550199";
      await page.goto(baseURL + "/book/fixture-a/a1?service=cut&source=website");
      await page.locator(".service-options").waitFor();
      assert.equal(await page.getByRole("link", { name: "Avisar por WhatsApp" }).count(), 0);
      await page.getByLabel("Barbero").selectOption("a1");
      await page.locator(".slot-grid button").first().click();
      await page.locator('input[name="name"]').fill("Fixture client");
      await page.locator('input[name="phone"]').fill("+12025550199");
      const before = bookingRequests;
      await page.locator("button.primary").click();
      if (failBooking) {
        await page.getByText("Horario ocupado", { exact: true }).waitFor();
        assert.equal(await page.locator(".public-confirmation").count(), 0);
      } else {
        await page.locator(".public-confirmation").waitFor();
        const link = page.getByRole("link", { name: "Avisar por WhatsApp" });
        assert.equal(await link.count(), mode === "success" ? 1 : 0);
        if (mode === "success") {
          const url = new URL(await link.getAttribute("href"));
          assert.equal(url.origin + url.pathname, "https://wa.me/12025550199");
          const message = url.searchParams.get("text");
          for (const text of ["Corte fixture", "Profesional solicitado: Fixture staff", "17:00", "40 min", "fixture-reference"]) assert.ok(message.includes(text));
          assert.ok(!message.includes("Fixture client"));
          assert.equal(await link.getAttribute("target"), "_blank");
          assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
          assert.equal(await link.getAttribute("referrerpolicy"), "no-referrer");
          // Intercept the outbound page so the test never contacts WhatsApp.
          await page.context().route("https://wa.me/**", (route) => route.fulfill({ body: "Fixture WhatsApp destination" }));
          const popupPromise = page.waitForEvent("popup");
          await link.click();
          const popup = await popupPromise;
          await popup.close();
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `${out}/confirmation-${mode}-${width}.png` });
      }
      assert.equal(bookingRequests, before + 1);
      assert.equal(await page.getByRole("link", { name: "Avisar por WhatsApp" }).count(), mode === "success" ? 1 : 0);
      report.cases.push({ width, confirmation: mode, bookingRequests: 1, autoMessage: false });
    }
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(
    "CRM browser: 12 query/viewport combinations, 6 confirmations/conflicts and manual WhatsApp PASS",
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
