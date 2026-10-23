import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { verifyRequest } from "./mfa-helper";
import { Pool } from "pg";
import { fixtures } from "../integration/fixtures";
test.describe("Daily work and accessible navigation with real Auth", () => {
  test.skip(
    process.env.E2E_REAL_SUPABASE !== "1",
    "Requires isolated Auth and actual domain RPCs",
  );
  test("mobile menu traps focus, Escape returns it, and search keyboard shortcut opens actual results", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/fixture-a/agenda");
    const trigger = page.getByRole("button", { name: "Abrir navegación" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Navegación" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      ).toBeTruthy();
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      ).toBeTruthy();
    }
    await page.keyboard.press("Control+k");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
    ).toBeTruthy();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("textbox", {
        name: "Buscar clientes, teléfono, barberos o citas",
      }),
    ).toBeFocused();
    await page
      .getByRole("textbox", {
        name: "Buscar clientes, teléfono, barberos o citas",
      })
      .fill("Agenda");
    await expect(
      page
        .locator(".search-results")
        .getByRole("link", { name: "Agenda Ir a la pantalla" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".search-results")).toHaveCount(0);
    const more = page.getByRole("button", { name: "Más", exact: true });
    await more.click();
    await expect(dialog).toBeVisible();
    await dialog.locator("summary").click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      ).toBeTruthy();
    }
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).focus();
    await page.screenshot({
      path: "test-results/mobile-menu-focus.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
  });
  test("owner saves explicit daily blocks and a break, inspects actual slots and copies only after confirmation", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 3);
    const day = date.toISOString().slice(0, 10);
    await page.goto("/fixture-a/equipo");
    await page.getByLabel("Día de trabajo").fill(day);
    await page.getByLabel("Profesional del día").selectOption(f.staff.a1);
    await page
      .getByRole("combobox", { name: "Barbero", exact: true })
      .selectOption(f.staff.a1);
    await page.getByLabel("Desde", { exact: true }).fill("09:00");
    await page.getByLabel("Hasta", { exact: true }).fill("18:00");
    await page
      .getByRole("button", { name: "Agregar otro bloque o descanso" })
      .click();
    await page.getByLabel("Tipo de bloque adicional").selectOption("false");
    await page.getByLabel("Desde (bloque adicional)").fill("12:00");
    await page.getByLabel("Hasta (bloque adicional)").fill("13:00");
    await page.getByRole("button", { name: "Guardar disponibilidad" }).click();
    await expect(
      page.getByText("Disponibilidad guardada.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".availability-block")).toHaveCount(2);
    await page
      .getByLabel("Servicio para comprobar")
      .selectOption(f.services.cut);
    await expect(page.locator(".slot-grid .badge").first()).toBeVisible();
    expect(
      await page.locator(".slot-grid .badge").allTextContents(),
    ).not.toContain("12:00");
    await page
      .getByRole("button", { name: "Copiar bloques a otra fecha" })
      .click();
    const dialog = page.getByRole("dialog");
    date.setUTCDate(date.getUTCDate() + 1);
    const target = date.toISOString().slice(0, 10);
    await dialog.getByLabel("Fecha de destino").fill(target);
    await expect(page.getByLabel("Día de trabajo")).toHaveValue(day);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar copia" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Día de trabajo")).toHaveValue(target);
    await expect(page.locator(".availability-block")).toHaveCount(2);
  });
  test("reception receives a walk-in, attends, collects a split payment and closes cash; owner reviews the actual sale", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const baseFixture = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    // Each attempt gets its own tenant/ledger. A failed walk-in must not leave
    // an open cash session or occupied staff behind for the retry.
    if (
      !["127.0.0.1", "localhost"].includes(
        new URL(process.env.LOCAL_DB_URL!).hostname,
      )
    )
      throw new Error("Daily fixtures require isolated localhost Supabase");
    const namespace = `daily-${crypto.randomUUID().slice(0, 8)}`;
    const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
    const f = await (async () => {
      try {
        const scoped = await fixtures(pool, baseFixture.users, namespace);
        // The walk-in starts at the real current time. Keep this isolated
        // branch near local noon so its 40-minute service never crosses the
        // test day's boundary. Production availability guards stay unchanged.
        const offset = new Date().getUTCHours() - 12;
        const timezone = `Etc/GMT${offset >= 0 ? "+" : ""}${offset}`;
        await pool.query("update public.branches set timezone=$1 where id=$2", [
          timezone,
          scoped.branches.a1,
        ]);
        return {
          ...baseFixture,
          ...scoped,
        };
      } finally {
        await pool.end();
      }
    })();
    const workspace = `/${namespace}-a`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const headers = { Origin: "http://localhost:3000" };
    await page.request.post("/api/auth/signin", {
      headers,
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    const suffix = crypto.randomUUID().slice(0, 8);
    const configure = async (data: object) => {
      const r = await page.request.post("/api/finance/command", {
        headers,
        data: {
          org: f.orgA,
          branch: f.branches.a1,
          action: "configure",
          data,
          key: crypto.randomUUID(),
        },
      });
      expect(r.ok()).toBeTruthy();
      return (await r.json()).id as string;
    };
    const cash = await configure({
      entity: "payment_methods",
      name: "Pilot cash " + suffix,
      code: "pc_" + suffix,
      type: "cash",
    });
    const bank = await configure({
      entity: "payment_methods",
      name: "Pilot bank " + suffix,
      code: "pb_" + suffix,
      type: "bank",
    });
    for (const payment_method_id of [cash, bank])
      await configure({
        entity: "payment_method_fee_rules",
        payment_method_id,
        percentage_bps: 0,
        fixed_amount_minor: 0,
      });
    await page.request.post("/api/auth/signout", { headers, data: {} });
    await page.request.post("/api/auth/signin", {
      headers,
      data: { email: "receptionA@fixture.invalid", password: f.password },
    });
    await page.goto(`${workspace}/caja`);
    await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
    await page
      .getByLabel("Efectivo inicial · Importe en centavos (USD)")
      .fill("0");
    await page.getByRole("button", { name: "Confirmar apertura" }).click();
    await expect(
      page.getByRole("heading", { name: "Caja abierta", exact: true }),
    ).toBeVisible();
    await page.goto(`${workspace}/walk-ins`);
    await page
      .getByRole("button", { name: "+ Agregar a la cola", exact: true })
      .click();
    const name = "Piloto aislado " + suffix;
    await page.getByLabel("cut", { exact: true }).check();
    await page
      .getByRole("combobox", { name: "Barbero", exact: true })
      .selectOption(f.staff.a1);
    await page
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page.getByLabel("Teléfono con código de país").fill(
      "+1202555" +
        Math.floor(Math.random() * 9999)
          .toString()
          .padStart(4, "0"),
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Agregar a la cola", exact: true })
      .click();
    const card = page.locator(".queue-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    const assigned = page.waitForResponse(
      (response) =>
        response.url().includes("/api/workspace/assign_walkin") &&
        response.request().method() === "POST",
    );
    await card.getByRole("button", { name: "Asignar disponible" }).click();
    expect((await assigned).ok()).toBeTruthy();
    await card.getByRole("button", { name: "Abrir servicio" }).click();
    await page.getByRole("button", { name: "Check-in", exact: true }).click();
    await page
      .getByRole("button", { name: "Iniciar servicio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Completar servicio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Preparar cobro", exact: true })
      .click();
    await page.getByRole("button", { name: "Dividir pago" }).click();
    await page
      .getByRole("combobox", { name: "Medio de pago", exact: true })
      .nth(0)
      .selectOption(cash);
    await page
      .getByRole("combobox", { name: "Medio de pago", exact: true })
      .nth(1)
      .selectOption(bank);
    await page
      .getByLabel("Importe en centavos (USD)", { exact: true })
      .nth(0)
      .fill("1200");
    await page
      .getByLabel("Importe en centavos (USD)", { exact: true })
      .nth(1)
      .fill("800");
    await page.getByRole("button", { name: "Cobrar y registrar" }).click();
    await expect(
      page.getByText("Venta cobrada y registrada.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/daily-split-paid.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Volver y ofrecer próximo turno" })
      .click();
    await expect(
      page.getByRole("button", { name: "Agendar próximo turno" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`${workspace}/caja`);
    await page
      .getByRole("button", { name: "Cerrar caja", exact: true })
      .click();
    await page
      .getByLabel("Efectivo contado · Importe en centavos (USD)")
      .fill("1200");
    await page.getByRole("button", { name: "Confirmar cierre" }).click();
    await expect(
      page.getByRole("heading", { name: "Caja cerrada", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/daily-cash-closed.png",
      fullPage: true,
    });
    await page.request.post("/api/auth/signout", { headers, data: {} });
    await page.request.post("/api/auth/signin", {
      headers,
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    await page.goto(`${workspace}/finanzas`);
    await expect(
      page.getByRole("heading", { name: "Ventas y dinero cobrado" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Movimientos", exact: true })
      .click();
    await page.getByLabel("Buscar concepto, cliente o proveedor").fill(name);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/daily-owner-movement.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
  test("week calendar batches schedules, validates ranges and preserves tenant isolation with real Auth", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    const schedules: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/workspace/calendar_blocks?"))
        schedules.push(r.url());
    });
    await page.goto("/fixture-a/agenda");
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    const dailyCount = schedules.length;
    expect(dailyCount).toBe(1);
    const scheduleResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/calendar_blocks?") &&
        r.status() === 200,
    );
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    const weeklyResponse = await scheduleResponse;
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /^Calendario horario del/ }),
    ).toHaveCount(7);
    expect(schedules.length - dailyCount).toBe(1);
    const url = new URL(weeklyResponse.url());
    const payload = await weeklyResponse.json();
    expect(Array.isArray(payload.items)).toBeTruthy();
    expect(Array.isArray(payload.absences)).toBeTruthy();
    url.searchParams.set("org", f.orgB);
    url.searchParams.set("branch", f.branches.b1);
    const otherTenant = await page.request.get(url.toString());
    expect(otherTenant.ok()).toBeTruthy();
    expect(await otherTenant.json()).toMatchObject({
      items: [],
      absences: [],
      has_more: false,
    });
    url.searchParams.set("end_day", url.searchParams.get("start_day")!);
    expect((await page.request.get(url.toString())).status()).toBe(400);
    await page
      .getByRole("button", { name: "+ Nueva reserva", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Nueva reserva",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      ).toBeTruthy();
    }
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "+ Nueva reserva", exact: true }),
    ).toBeFocused();
  });
  test("report period filters reload the authorized chart and expose keyboard-readable data", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    await verifyRequest(page.request, "ownerA");
    await page.goto("/fixture-a/reportes");
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/dashboard?") &&
        r.url().includes("from=") &&
        r.status() === 200,
    );
    await page.getByLabel("Período", { exact: true }).selectOption("1");
    const data = await (await response).json();
    expect(data.by_day.length).toBe(1);
    const summary = page.getByText("Ver datos de reservas y atención", {
      exact: true,
    });
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("region", {
        name: "Datos de Reservas y atención",
        exact: true,
      }),
    ).toBeVisible();
  });
});
