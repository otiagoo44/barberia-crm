import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("service creation shows field errors, preserves input and explains price/capability setup", async ({
  page,
}) => {
  let saves = 0;
  await page.route("**/api/**", async (route) => {
    if (
      route.request().url().includes("/record") &&
      route.request().method() === "POST"
    ) {
      saves++;
      const data = route.request().postDataJSON();
      expect(data.data.website_category).toBeNull();
      return route.fulfill({
        status: saves === 1 ? 400 : 200,
        json:
          saves === 1
            ? {
                error: "Ya existe un servicio con ese identificador.",
                fields: { slug: "Elegí otro identificador." },
              }
            : { id: "new-service" },
      });
    }
    return route.fulfill({ json: { items: [], has_more: false } });
  });
  await page.goto("/fixture-a/servicios");
  await page
    .getByRole("button", { name: "Agregar servicio", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Tinte global");
  await page
    .getByRole("textbox", { name: "Identificador público", exact: true })
    .fill("tinte global");
  await page.getByLabel("Duración (minutos)", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/Usá entre 2 y 63/)).toBeVisible();
  expect(saves).toBe(0);
  await page
    .getByRole("textbox", { name: "Identificador público", exact: true })
    .fill("tinte-global");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Elegí otro identificador.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Tinte global",
  );
  await page
    .getByRole("textbox", { name: "Identificador público", exact: true })
    .fill("tinte-global-nuevo");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText(/Servicio guardado. Siguiente paso/),
  ).toBeVisible();
});

test("weekly editor previews the break, excludes Sunday and posts one batch", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/**", async (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1);
    if (resource === "weekly_schedule" && route.request().method() === "POST") {
      calls++;
      const data = route.request().postDataJSON();
      expect(data.blocks).toHaveLength(12);
      expect(data.days).toEqual([1, 2, 3, 4, 5, 6]);
      expect(data.blocks[0]).toEqual({
        weekday: 1,
        starts_at: "09:00",
        ends_at: "12:00",
      });
      expect(data.blocks[1]).toEqual({
        weekday: 1,
        starts_at: "12:30",
        ends_at: "19:00",
      });
      return route.fulfill({ json: { items: [] } });
    }
    if (resource === "weekly_schedule")
      return route.fulfill({ json: { weekly_editor_supported: true } });
    if (resource === "staff")
      return route.fulfill({
        json: {
          items: [{ id: "staff-qa", name: "Esteban QA", active: true }],
          has_more: false,
        },
      });
    return route.fulfill({ json: { items: [], has_more: false } });
  });
  await page.goto("/fixture-a/equipo");
  await page
    .getByRole("combobox", { name: "Profesional", exact: true })
    .selectOption("staff-qa");
  await page.getByLabel("Agregar descanso", { exact: true }).check();
  await expect(page.getByLabel("Domingo", { exact: true })).not.toBeChecked();
  await expect(
    page.getByText("09:00–12:00 · 12:30–19:00").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar semana", exact: true })
    .click();
  await expect(page.getByText(/Semana guardada/)).toBeVisible();
  expect(calls).toBe(1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await mkdir("docs/verification/pilot-20261024", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/verification/pilot-20261024/weekly-editor-${width}.png`,
      fullPage: true,
    });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});

test("manual sale offers real services without a fictitious finance item", async ({
  page,
}) => {
  let created = false;
  await page.route("**/api/**", async (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1);
    if (resource === "catalog")
      return route.fulfill({
        json: {
          services: [{ id: "cut-qa", name: "Corte", price_minor: 30000 }],
          items: [],
          staff: [{ id: "staff-qa", name: "Esteban" }],
          payment_methods: [],
          fee_rules: [],
          categories: [],
        },
      });
    if (resource === "cash") return route.fulfill({ json: { session: null } });
    if (resource === "command") {
      const data = route.request().postDataJSON();
      expect(data.data.lines).toEqual([
        { service_id: "cut-qa", staff_id: "staff-qa", quantity: 1 },
      ]);
      created = true;
      return route.fulfill({ json: { id: "checkout-new" } });
    }
    if (resource === "checkout")
      return route.fulfill({
        json: {
          id: "checkout-new",
          status: "draft",
          total_minor: 30000,
          paid_minor: 0,
          lines: [],
          payments: [],
        },
      });
    return route.fulfill({ json: { items: [], has_more: false } });
  });
  await page.goto("/fixture-a/manual-checkout");
  await page
    .getByRole("combobox", { name: "Servicio o concepto", exact: true })
    .selectOption("service:cut-qa");
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(
    page.getByText("Elegí el profesional que realizó el servicio."),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Profesional que atendió", exact: true })
    .selectOption("staff-qa");
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(page.getByText("Pendiente:", { exact: false })).toBeVisible();
  expect(created).toBe(true);
});
