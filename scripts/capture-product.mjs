/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw Error("Visual fixtures require isolated localhost Auth");
const phase = process.env.QA_PHASE === "before" ? "before" : "after";
const f = JSON.parse(await readFile(".test-data/e2e/ux-fixtures.json", "utf8"));
const out = `docs/verification/ux/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400)
      failedRequests.push({
        path: new URL(r.url()).pathname,
        status: r.status(),
      });
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const anonymous = await browser.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await anonymous.setViewportSize({ width, height: 1000 });
    await anonymous.goto(base + "/login");
    await anonymous.screenshot({
      path: `${out}/login-${width}.png`,
      fullPage: true,
    });
  }
  await anonymous.close();
  const login = await page.request.post(base + "/api/auth/signin", {
    headers: { Origin: base },
    data: { email: "ownerA@fixture.invalid", password: f.password },
  });
  expect(login.ok()).toBeTruthy();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/mfa");
    await expect(
      page.getByRole("heading", { name: "Verificá tu identidad" }),
    ).toBeVisible();
    await page.screenshot({ path: `${out}/mfa-${width}.png`, fullPage: true });
  }
  if (f.mfa?.ownerA) {
    const m = f.mfa.ownerA;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bits = [...m.secret.toUpperCase().replace(/=+$/, "")]
      .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
      .join("");
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8)
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
    const code = ((h.readUInt32BE(h.at(-1) & 15) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, "0");
    const verified = await page.request.post(base + "/api/auth/mfa/verify", {
      headers: { Origin: base },
      data: { factor: m.factor, code },
    });
    expect(verified.ok()).toBeTruthy();
  }
  const results = [];
  async function capture(module, width) {
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    expect(fits, `${module} overflows at ${width}`).toBeTruthy();
    await page.screenshot({
      path: `${out}/${module}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const performance = await page.evaluate(() => ({
      navigation: performance
        .getEntriesByType("navigation")
        .map((n) => ({
          duration: n.duration,
          domContentLoaded: n.domContentLoadedEventEnd,
        })),
      resources: performance.getEntriesByType("resource").length,
      transferBytes: performance
        .getEntriesByType("resource")
        .reduce((n, r) => n + r.transferSize, 0),
    }));
    results.push({ module, width, overflow: false, performance });
  }
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
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
      "walk-ins",
      "sucursales",
      "metas",
      "retencion",
    ]) {
      await page.goto(`${base}/ux-a/${module}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator("main .loading")).toHaveCount(0);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      await capture(module, width);
      if (module === "clientes") {
        await page
          .getByRole("button", { name: "Cliente de prueba · QA", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await capture("cliente-ficha", width);
        await page.keyboard.press("Escape");
      }
      if (module === "equipo") await capture("disponibilidad", width);
      if (module === "caja") {
        await page
          .getByRole("button", { name: "Cobrar", exact: true })
          .first()
          .click();
        await expect(
          page.getByRole("dialog", { name: "Cobrar", exact: true }),
        ).toBeVisible();
        await capture("checkout", width);
        await page.keyboard.press("Escape");
      }
      if (module === "agenda") {
        if (width <= 768)
          await page
            .getByRole("button", { name: "Abrir navegación", exact: true })
            .click();
        await capture("navegacion", width);
        if (width <= 768) await page.keyboard.press("Escape");
      }
    }
  }
  expect(errors).toEqual([]);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        phase,
        fixture: "isolated Supabase Auth tenants; no production data",
        results,
        browserErrors: errors,
        consoleErrors,
        failedRequests,
        source: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
      },
      null,
      2,
    ),
  );
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  console.log(
    `Captured ${results.length} actual ${phase} screenshots with Supabase Auth.`,
  );
} finally {
  await browser.close();
}
