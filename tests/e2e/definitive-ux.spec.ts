import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { verifyRequest } from "./mfa-helper";

test.describe("Definitive workspace with real scoped Auth", () => {
  test.skip(
    process.env.E2E_REAL_SUPABASE !== "1",
    "Requires real isolated Supabase Auth; no cloud fixtures",
  );
  test.beforeEach(async ({ page }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const signIn = await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    expect(signIn.ok()).toBeTruthy();
    await verifyRequest(page.request, "ownerA");
  });

  test("setup is live, owner scoped, branch scoped and never activates booking", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const query = new URLSearchParams({
      org: f.orgA,
      branch: f.branches.a1,
      date: new Date().toISOString().slice(0, 10),
    });
    const result = await page.request.get(`/api/workspace/setup?${query}`);
    expect(result.ok()).toBeTruthy();
    const status = await result.json();
    expect(
      status.checks.map((check: { key: string }) => check.key).sort(),
    ).toEqual(
      [
        "account",
        "permissions",
        "branch",
        "services",
        "professionals",
        "schedule",
        "payments",
        "pos",
        "booking",
        "security",
      ].sort(),
    );
    // Weekly rules are authoritative even with no available day exception.
    expect(
      status.checks.find((c: { key: string }) => c.key === "schedule").status,
    ).toBe("ready");
    expect(
      status.checks.find((c: { key: string }) => c.key === "schedule").detail,
    ).toContain("horarios configurados");
    // Having payment method buttons never certifies processor reconciliation.
    expect(
      status.checks.find((c: { key: string }) => c.key === "pos").status,
    ).toBe("pending");
    expect(
      status.checks.find((c: { key: string }) => c.key === "pos").detail,
    ).toContain("requieren evidencia de conciliación");
    expect(
      status.checks.find((c: { key: string }) => c.key === "security").detail,
    ).toContain("backups y alertas");
    expect(JSON.stringify(status)).not.toContain(f.users.ownerA);
    query.set("branch", f.branches.b1);
    expect(
      (await page.request.get(`/api/workspace/setup?${query}`)).status(),
    ).toBe(404);
    query.set("org", f.orgB);
    expect(
      (await page.request.get(`/api/workspace/setup?${query}`)).status(),
    ).toBe(403);
    await page.goto("/fixture-a/configuracion");
    await expect(
      page.getByText("Comprobado", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Este diagnóstico no habilita reservas/),
    ).toBeVisible();
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "receptionA@fixture.invalid", password: f.password },
    });
    query.set("org", f.orgA);
    query.set("branch", f.branches.a1);
    expect(
      (await page.request.get(`/api/workspace/setup?${query}`)).status(),
    ).toBe(403);
    let releaseCash: () => void = () => {};
    const cashGate = new Promise<void>((resolve) => {
      releaseCash = resolve;
    });
    await page.route("**/api/finance/cash?**", async (route) => {
      await cashGate;
      await route.continue();
    });
    await page.goto("/fixture-a/inicio");
    await expect(
      page.getByText("Consultando caja…", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Sin apertura", { exact: true })).toHaveCount(
      0,
    );
    releaseCash();
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("service validation reaches real SQL with normalized category and field-specific duplicate errors", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const payload = {
      org: f.orgA,
      branch: null,
      entity: "services",
      id: null,
      data: {
        name: "Tinte QA aislado",
        slug: `tinte-qa-${Date.now()}`,
        default_duration_minutes: 150,
        website_category: "otro",
        composition_mode: "standalone",
        consultation_required: true,
        active: true,
      },
    };
    const headers = { Origin: "http://localhost:3000" };
    const invalid = await page.request.post("/api/workspace/record", {
      headers,
      data: {
        ...payload,
        data: { ...payload.data, default_duration_minutes: 0 },
      },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).fields.default_duration_minutes).toBeTruthy();
    const valid = await page.request.post("/api/workspace/record", {
      headers,
      data: payload,
    });
    expect(valid.ok()).toBeTruthy();
    expect((await valid.json()).website_category).toBeNull();
    const duplicate = await page.request.post("/api/workspace/record", {
      headers,
      data: payload,
    });
    expect(duplicate.status()).toBe(400);
    expect((await duplicate.json()).fields.slug).toContain("identificador");
  });

  test("weekly batch uses real Auth and database idempotency with version checks", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const query = new URLSearchParams({ org: f.orgA, branch: f.branches.a1 });
    const supported = await page.request.get(
      `/api/workspace/weekly_schedule?${query}`,
    );
    expect(supported.ok()).toBeTruthy();
    expect((await supported.json()).weekly_editor_supported).toBe(true);
    const loaded = await page.request.get(
      `/api/workspace/staff_availability_rules?${query}`,
    );
    expect(loaded.ok()).toBeTruthy();
    const list = await loaded.json();
    expect(list.has_more).toBe(false);
    const rows = list.items.filter(
      (r: { staff_id: string; weekday: number }) =>
        r.staff_id === f.staff.a3 && r.weekday === 1,
    );
    const data = {
      org: f.orgA,
      branch: f.branches.a1,
      staff: f.staff.a3,
      from: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      days: [1],
      blocks: [
        { weekday: 1, starts_at: "09:00", ends_at: "12:00" },
        { weekday: 1, starts_at: "12:30", ends_at: "19:00" },
      ],
      expected: rows.map((r: { id: string; updated_at: string }) => ({
        id: r.id,
        updated_at: r.updated_at,
      })),
      key: crypto.randomUUID(),
    };
    const headers = { Origin: "http://localhost:3000" };
    const first = await page.request.post("/api/workspace/weekly_schedule", {
      headers,
      data,
    });
    expect(first.ok()).toBeTruthy();
    const retry = await page.request.post("/api/workspace/weekly_schedule", {
      headers,
      data,
    });
    expect(retry.ok()).toBeTruthy();
    expect(await retry.json()).toEqual(await first.json());
    const stale = await page.request.post("/api/workspace/weekly_schedule", {
      headers,
      data: { ...data, key: crypto.randomUUID() },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toContain("Otra persona");
  });

  test("same-page destinations update agenda and customer detail with real scoped reads", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    await page.goto("/fixture-a/agenda?date=2026-10-23");
    await expect(
      page.getByLabel("Fecha de agenda", { exact: true }),
    ).toHaveValue("2026-10-23");
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await page.evaluate(() =>
      history.pushState(null, "", "/fixture-a/agenda?date=2026-10-24"),
    );
    await expect(
      page.getByLabel("Fecha de agenda", { exact: true }),
    ).toHaveValue("2026-10-24");
    await expect(
      page.getByRole("button", { name: "Lista", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goto(`/fixture-a/clientes?customer=${f.customers.a1}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    const nextRead = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/workspace/customer" &&
        url.searchParams.get("id") === f.customers.a2
      );
    });
    await page.evaluate(
      (id) => history.pushState(null, "", `/fixture-a/clientes?customer=${id}`),
      f.customers.a2,
    );
    const response = await nextRead;
    expect(response.ok()).toBeTruthy();
    const detail = await response.json();
    await expect(
      page.getByRole("dialog", { name: detail.customer.name, exact: true }),
    ).toBeVisible();
  });

  test("credit checkout explains a missing tariff and preserves a real service sale for retry", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const headers = { Origin: "http://localhost:3000" };
    const command = async (action: string, data: object) => {
      const r = await page.request.post("/api/finance/command", {
        headers,
        data: {
          org: f.orgA,
          branch: f.branches.a1,
          action,
          data,
          key: crypto.randomUUID(),
        },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
      return r.json();
    };
    const method = await command("configure", {
      entity: "payment_methods",
      name: "Crédito aislado sin tarifa",
      code: `qa_credit_${Date.now()}`,
      type: "card",
    });
    const query = new URLSearchParams({
      org: f.orgA,
      branch: f.branches.a1,
      from: new Date().toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    });
    const catalog = await (
      await page.request.get(`/api/finance/catalog?${query}`)
    ).json();
    const price = Number(
      catalog.services.find((s: { id: string }) => s.id === f.services.cut)
        .price_minor,
    );
    await page.goto("/fixture-a/caja");
    await page
      .getByRole("button", { name: "Venta sin cita", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Servicio o concepto", exact: true })
      .selectOption(`service:${f.services.cut}`);
    await page
      .getByRole("combobox", { name: "Profesional que atendió", exact: true })
      .selectOption(f.staff.a3);
    const prepared = page.waitForResponse(
      (r) =>
        r.url().includes("/api/finance/command") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON().action === "create_checkout",
    );
    await page
      .getByRole("button", { name: "Preparar cobro", exact: true })
      .click();
    const created = await (await prepared).json();
    await page
      .getByRole("combobox", { name: "Medio de pago", exact: true })
      .selectOption(method.id);
    await page
      .getByLabel("Importe en centavos (USD)", { exact: true })
      .fill(String(price));
    await page
      .getByRole("button", { name: "Cobrar y registrar", exact: true })
      .click();
    await expect(
      page.getByText(/No existe tarifa vigente para este método/),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Medio de pago", exact: true }),
    ).toHaveValue(method.id);
    await expect(
      page.getByLabel("Importe en centavos (USD)", { exact: true }),
    ).toHaveValue(String(price));
    query.set("id", created.id);
    const draft = await (
      await page.request.get(`/api/finance/checkout?${query}`)
    ).json();
    expect(draft.status).toBe("draft");
    expect(draft.payments).toHaveLength(0);
    expect(Number(draft.total_minor)).toBe(price);
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: method.id,
      percentage_bps: 520,
      fixed_amount_minor: 0,
      evidence_reference:
        "Explicit isolated credit fixture, not UPay production evidence",
    });
    await page
      .getByRole("button", { name: "Cobrar y registrar", exact: true })
      .click();
    await expect(
      page.getByText("Venta cobrada y registrada.", { exact: true }),
    ).toBeVisible();
    const paid = await (
      await page.request.get(`/api/finance/checkout?${query}`)
    ).json();
    expect(paid.status).toBe("posted");
    expect(paid.payments).toHaveLength(1);
    expect(Number(paid.total_minor)).toBe(price);
    expect(Number(paid.payments[0].amount_minor)).toBe(price);
  });

  test("financial filters hide obsolete totals while loading, transport errors expose no previous totals", async ({
    page,
  }) => {
    await page.goto("/fixture-a/finanzas");
    await page.getByRole("button", { name: "Resumen", exact: true }).click();
    await page
      .locator("summary")
      .filter({ hasText: "Filtros financieros" })
      .click();
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await expect(page.locator(".kpi-grid").first()).toBeVisible();
    const sections = page.getByRole("group", {
      name: "Secciones de finanzas",
      exact: true,
    });
    await expect(
      sections.getByRole("button", { name: "Resumen", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested = false;
    await page.route("**/api/finance/summary?**", async (route) => {
      requested = true;
      await gate;
      await route.continue();
    });
    await page
      .getByRole("combobox", { name: "Período", exact: true })
      .selectOption("7");
    await expect.poll(() => requested).toBeTruthy();
    await expect(page.locator(".loading:visible")).toHaveCount(1);
    await expect(page.locator(".kpi-grid")).toHaveCount(0);
    release();
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await expect(page.locator(".kpi-grid").first()).toBeVisible();
    await page.unroute("**/api/finance/summary?**");
    await page.route("**/api/finance/summary?**", (route) =>
      route.abort("failed"),
    );
    await page
      .getByRole("combobox", { name: "Período", exact: true })
      .selectOption("30");
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "No pudimos conectar",
    );
    await expect(page.locator(".kpi-grid")).toHaveCount(0);
    await page.unroute("**/api/finance/summary?**");
    await page
      .getByRole("combobox", { name: "Período", exact: true })
      .selectOption("today");
    await expect(page.locator(".kpi-grid").first()).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await sections.getByRole("button", { name: "Gastos", exact: true }).click();
    await expect(
      sections.getByRole("button", { name: "Gastos", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      sections.getByRole("button", { name: "Resumen", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".loading:visible")).toHaveCount(0);
  });

  test("large financial figures remain complete and readable across target widths", async ({
    page,
  }) => {
    await page.goto("/fixture-a/finanzas");
    await expect(page.locator(".kpi-grid").first()).toBeVisible();
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    // Visual stress values only in this isolated browser DOM, never a business write.
    const values = [128450000, 9000000000000].map((value) =>
      new Intl.NumberFormat("es-PY", {
        style: "currency",
        currency: "PYG",
        maximumFractionDigits: 0,
      }).format(value),
    );
    await page.locator(".kpi strong").evaluateAll((elements, values) => {
      elements.forEach((element, index) => {
        element.textContent = values[index % values.length];
      });
    }, values);
    await page.evaluate(() => {
      const note = document.createElement("p");
      note.textContent =
        "Prueba visual QA: importes sintéticos, sin operaciones del negocio.";
      document.querySelector("main")?.prepend(note);
    });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      // ResponsiveContainer measures through ResizeObserver after viewport
      // changes. Keep the exact no-overflow condition, await its settled layout.
      try {
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
      } catch (error) {
        await test.info().attach(`financial-layout-${width}`, {
          contentType: "application/json",
          body: JSON.stringify(
            await page.evaluate(() => ({
              width: innerWidth,
              scroll: document.documentElement.scrollWidth,
              offenders: Array.from(document.querySelectorAll("body *"))
                .map((el) => ({
                  tag: el.tagName,
                  css: el.getAttribute("class"),
                  right: el.getBoundingClientRect().right,
                }))
                .filter((el) => el.right > innerWidth + 1)
                .slice(0, 20),
            })),
          ),
        });
        throw error;
      }
      const amounts = await page
        .locator(".kpi strong")
        .evaluateAll((elements) =>
          elements.map((el) => ({
            text: el.textContent,
            fits: el.scrollWidth <= el.clientWidth,
            fontSize: parseFloat(getComputedStyle(el).fontSize),
          })),
        );
      for (const [index, amount] of amounts.entries()) {
        expect(amount.text).toBe(values[index % values.length]);
        expect(amount.fits).toBeTruthy();
        expect(amount.fontSize).toBeGreaterThanOrEqual(28);
      }
      await page.screenshot({
        path: `test-results/large-figures-${width}.png`,
        fullPage: false,
      });
    }
  });

  test("motion, 200 percent layout, keyboard, contrast and readable controls across target widths", async ({
    page,
  }) => {
    await page.goto("/fixture-a/clientes");
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const primary = page.getByRole("button", {
      name: "+ Nuevo cliente",
      exact: true,
    });
    await expect(primary).toBeVisible();
    expect(
      await primary.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(15);
    await primary.focus();
    await expect(primary).toBeFocused();
    expect(
      await primary.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    await primary.hover();
    await page.mouse.down();
    await expect
      .poll(() => primary.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe("none");
    await page.mouse.up();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const save = dialog.getByRole("button", {
      name: "Guardar cliente",
      exact: true,
    });
    // Exercise the native disabled state without starting a customer write.
    await save.evaluate((el) => {
      (el as HTMLButtonElement).disabled = true;
    });
    await expect(save).toHaveCSS("background-color", "rgb(236, 232, 223)");
    await save.hover();
    await expect(save).toHaveCSS("background-color", "rgb(236, 232, 223)");
    expect(await save.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await page.keyboard.press("Escape");
    await expect(primary).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await primary.click();
      expect(
        await dialog.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await primary.click();
    await expect(dialog).toBeVisible();
    const heading = dialog.getByRole("heading", {
      name: "Nuevo cliente",
      exact: true,
    });
    const bounds = await heading.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({
      path: "test-results/clients-css-zoom-200.png",
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    // Reflow at the CSS viewport equivalent of 1440x1000 at 200% browser zoom.
    await page.setViewportSize({ width: 720, height: 500 });
    await primary.click();
    await expect(
      dialog.getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeVisible();
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  });
});
