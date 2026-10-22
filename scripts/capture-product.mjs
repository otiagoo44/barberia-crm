/* global document, innerWidth, FontFace */
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHmac, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw Error("Visual fixtures require isolated localhost Auth");
const phase = process.env.QA_PHASE === "before" ? "before" : "after";
const f = JSON.parse(await readFile(".test-data/e2e/ux-fixtures.json", "utf8"));
const out = `docs/verification/ux/${phase}`;
const target = resolve(out);
if (dirname(target) !== resolve("docs/verification/ux"))
  throw Error("Unsafe screenshot path");
await rm(target, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
async function verify(request, role) {
  const m = f.mfa?.[role];
  if (!m) return;
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
  const result = await request.post(base + "/api/auth/mfa/verify", {
    headers: { Origin: base },
    data: { factor: m.factor, code },
  });
  expect(result.ok()).toBeTruthy();
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const accessibility = [];
  const results = [];
  async function audit(page, module, width) {
    if (width !== 390 && width !== 1440) return;
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    accessibility.push({
      module,
      width,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    await writeFile(
      `${out}/accessibility.json`,
      JSON.stringify(accessibility, null, 2),
    );
  }
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
  const anonymousContext = await browser.newContext();
  const anonymous = await anonymousContext.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await anonymous.setViewportSize({ width, height: 1000 });
    await anonymous.goto(base + "/login");
    await anonymous.screenshot({
      path: `${out}/login-${width}.png`,
      fullPage: true,
    });
    await audit(anonymous, "login", width);
    await anonymous.goto(base + "/book/ux-b/b1");
    await expect(anonymous.locator(".loading:visible")).toHaveCount(0);
    await expect(anonymous.locator("h1").first()).toBeVisible();
    expect(
      await anonymous.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await anonymous.screenshot({
      path: `${out}/reserva-publica-${width}.png`,
      fullPage: true,
    });
    await audit(anonymous, "reserva-publica", width);
  }
  await anonymousContext.close();
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
    await audit(page, "mfa", width);
  }
  await verify(page.request, "ownerA");
  if (phase === "after") {
    const fontResults = [];
    const interBytes = [
      ...(await readFile(
        "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      )),
    ];
    for (const font of ["DM Sans Variable", "Inter QA"]) {
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base + "/ux-a/clientes");
        await expect(page.locator("main .loading")).toHaveCount(0);
        const metrics = await page.evaluate(
          async ({ font, interBytes }) => {
            if (font === "Inter QA") {
              const face = new FontFace(
                font,
                new Uint8Array(interBytes).buffer,
                { weight: "100 900" },
              );
              await face.load();
              document.fonts.add(face);
            }
            document.documentElement.style.fontFamily = `"${font}",sans-serif`;
            await document.fonts.ready;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.font = `16px "${font}"`;
            return {
              font,
              numberWidth: ctx.measureText("Gs. 128.450.000").width,
              textWidth: ctx.measureText(
                "Próxima atención · Teléfono · Jonatan y Esteban",
              ).width,
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          },
          { font, interBytes },
        );
        expect(metrics.overflow).toBeFalsy();
        fontResults.push({ ...metrics, width });
        await page.screenshot({
          path: `${out}/tipografia-${font === "Inter QA" ? "inter" : "dm-sans"}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await mkdir("docs/verification/definitive", { recursive: true });
    await writeFile(
      "docs/verification/definitive/typeface-comparison.json",
      JSON.stringify(fontResults, null, 2),
    );
    await page.goto(base + "/mfa");
  }
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
      navigation: performance.getEntriesByType("navigation").map((n) => ({
        duration: n.duration,
        domContentLoaded: n.domContentLoadedEventEnd,
      })),
      resources: performance.getEntriesByType("resource").length,
      transferBytes: performance
        .getEntriesByType("resource")
        .reduce((n, r) => n + r.transferSize, 0),
    }));
    results.push({ module, width, overflow: false, performance });
    await audit(page, module, width);
  }
  if (phase === "after") {
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + "/mfa");
      await capture("mfa-dispositivos", width);
      const revoke = page.getByRole("button", {
        name: "Cerrar todas mis sesiones",
        exact: true,
      });
      await revoke.click();
      await capture("mfa-confirmacion", width);
      await page.keyboard.press("Escape");
      await expect(revoke).toBeFocused();
    }
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
        if (phase === "after") {
          await page
            .getByRole("tab", { name: "Actividad", exact: true })
            .click();
          await capture("cliente-actividad", width);
          await page
            .getByRole("tab", { name: "Notas y preferencias", exact: true })
            .click();
          await capture("cliente-notas", width);
        }
        await page.keyboard.press("Escape");
      }
      if (module === "equipo") {
        await capture("disponibilidad", width);
        await page
          .getByRole("button", { name: "Barberos", exact: true })
          .click();
        await capture("equipo-tabla", width);
      }
      if (module === "caja") {
        await page
          .getByRole("button", { name: "Cobrar", exact: true })
          .first()
          .click();
        await expect(
          page.getByRole("dialog", { name: "Cobrar", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Dividir pago", exact: true })
          .click();
        await capture("checkout", width);
        await page.keyboard.press("Escape");
      }
      if (module === "agenda") {
        if (width < 768)
          await page
            .getByRole("button", { name: "Abrir navegación", exact: true })
            .click();
        await capture("navegacion", width);
        if (width < 768) await page.keyboard.press("Escape");
        if (phase === "after") {
          await page
            .getByRole("button", { name: "Semana", exact: true })
            .click();
          await capture("agenda-semana", width);
          await page.getByRole("button", { name: "Día", exact: true }).click();
          const appointment = page.locator(".calendar-event").first();
          await appointment.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("reserva-detalle", width);
          await page.keyboard.press("Escape");
          await expect(appointment).toBeFocused();
          await page
            .getByRole("button", { name: "+ Nueva reserva", exact: true })
            .click();
          await capture("reserva-nueva", width);
          await page.keyboard.press("Escape");
        }
      }
      if (module === "finanzas") {
        const period = page.getByRole("combobox", {
          name: "Período",
          exact: true,
        });
        if (phase === "before") {
          // The recovered PR has Today/Week/Month/Custom, not a 7-day preset.
          // Compare the same real range using its existing date controls.
          await period.selectOption("custom");
          const end = await page
            .getByLabel("Hasta", { exact: true })
            .inputValue();
          const start = new Date(end + "T12:00:00Z");
          start.setUTCDate(start.getUTCDate() - 6);
          await page
            .getByLabel("Desde", { exact: true })
            .fill(start.toISOString().slice(0, 10));
        } else {
          await period.selectOption("7");
        }
        await capture("finanzas-7dias", width);
        if (phase === "after") {
          await page
            .getByRole("button", { name: "Ticket promedio", exact: true })
            .click();
          await capture("equipo-ticket", width);
          await page
            .getByRole("button", { name: "Comisiones", exact: true })
            .click();
          await capture("equipo-comisiones", width);
        }
      }
      if (module === "reportes" && phase === "after") {
        await page
          .getByRole("button", { name: "Clientes y retorno", exact: true })
          .click();
        await capture("reportes-retencion", width);
        await page
          .getByRole("button", { name: "Equipo y servicios", exact: true })
          .click();
        await capture("reportes-equipo", width);
      }
    }
  }
  if (phase === "after") {
    for (const role of ["managerA1", "receptionA", "barberA", "financeA"]) {
      const roleContext = await browser.newContext();
      const rolePage = await roleContext.newPage();
      rolePage.on("pageerror", (e) => errors.push(e.message));
      rolePage.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      rolePage.on("response", (r) => {
        if (r.url().includes("/api/") && r.status() >= 400)
          failedRequests.push({
            role,
            path: new URL(r.url()).pathname,
            status: r.status(),
          });
      });
      const signIn = await rolePage.request.post(base + "/api/auth/signin", {
        headers: { Origin: base },
        data: { email: role + "@fixture.invalid", password: f.password },
      });
      expect(signIn.ok()).toBeTruthy();
      await verify(rolePage.request, role);
      for (const width of [360, 390, 768, 1024, 1440]) {
        await rolePage.setViewportSize({ width, height: 1000 });
        await rolePage.emulateMedia({ reducedMotion: "reduce" });
        await rolePage.goto(base + "/ux-a/inicio");
        await expect(rolePage.locator("main h1").first()).toBeVisible();
        await expect(rolePage.locator("main .loading")).toHaveCount(0);
        await expect(rolePage.locator("main").getByRole("alert")).toHaveCount(
          0,
        );
        expect(
          await rolePage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await rolePage.screenshot({
          path: `${out}/inicio-${role}-${width}.png`,
          fullPage: true,
        });
        await audit(rolePage, "inicio-" + role, width);
        results.push({ module: "inicio-" + role, width, overflow: false });
      }
      await roleContext.close();
    }
  }
  expect(errors).toEqual([]);
  const screenshots = [];
  for (const file of (await readdir(out))
    .filter((file) => file.endsWith(".png"))
    .sort()) {
    const bytes = await readFile(`${out}/${file}`);
    screenshots.push({
      file,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
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
        accessibility,
        screenshots,
        srcTree: execFileSync("git", ["rev-parse", "HEAD:src"], {
          encoding: "utf8",
        }).trim(),
        schemaTree: execFileSync("git", ["rev-parse", "HEAD:supabase"], {
          encoding: "utf8",
        }).trim(),
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
  if (phase === "after")
    expect(
      accessibility.flatMap((a) => a.violations),
      "WCAG automated checks",
    ).toEqual([]);
  console.log(
    `Captured ${results.length} actual ${phase} screenshots with Supabase Auth.`,
  );
} finally {
  await browser.close();
}
