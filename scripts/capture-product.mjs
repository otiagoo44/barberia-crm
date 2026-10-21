/* global document, innerWidth */
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw Error("Visual fixtures require isolated localhost Auth");
const phase = process.env.QA_PHASE === "before" ? "before" : "after";
const f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
const out = `docs/verification/ux/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const login = await page.request.post(base + "/api/auth/signin", {
    headers: { Origin: base },
    data: { email: "ownerA@fixture.invalid", password: f.password },
  });
  expect(login.ok()).toBeTruthy();
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
    ]) {
      await page.goto(`${base}/fixture-a/${module}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.locator("main .loading")).toHaveCount(0);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      expect(fits, `${module} overflows at ${width}`).toBeTruthy();
      await page.screenshot({
        path: `${out}/${module}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      results.push({ module, width, overflow: false });
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
      },
      null,
      2,
    ),
  );
  console.log(
    `Captured ${results.length} actual ${phase} screenshots with Supabase Auth.`,
  );
} finally {
  await browser.close();
}
