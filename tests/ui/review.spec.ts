import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const phase = process.env.REVIEW_PHASE ?? "after";
const output = `docs/verification/review-20261023/${phase}`;
const empty = { items: [], has_more: false };
const catalog = {
  payment_methods: [{ id: "bank-qa", name: "Transferencia QA", type: "bank" }],
  items: [],
  services: [],
  staff: [],
  categories: [],
  fee_rules: [],
  commission_rules: [],
  settings: null,
};
const checkout = {
  id: "checkout-qa",
  status: "draft",
  total_minor: 40000,
  paid_minor: 0,
  lines: [{ id: "line-qa", name_snapshot: "Corte QA", amount_minor: 40000 }],
  payments: [],
};

async function fixtures(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split("/").at(-1);
    if (resource === "live")
      return route.fulfill({
        contentType: "text/event-stream",
        body: 'retry: 60000\ndata: {"type":"connected"}\n\n',
      });
    let json: unknown = empty;
    if (resource === "staff")
      json = {
        items: [
          { id: "staff-a", name: "Profesional A · QA", active: true },
          { id: "staff-b", name: "Profesional B · QA", active: true },
        ],
        has_more: false,
      };
    if (resource === "staff_branch_assignments")
      json = {
        items: [{ id: "assignment-qa", staff_id: "staff-a", active: true }],
        has_more: false,
      };
    if (resource === "calendar_blocks") json = { ...empty, absences: [] };
    if (resource === "catalog") json = catalog;
    if (resource === "cash")
      json = { session: null, pending: [], methods: [], expenses_minor: 0 };
    if (resource === "checkout") json = checkout;
    if (resource === "customer")
      json = {
        customer: {
          id: url.searchParams.get("id"),
          name: `Cliente ${url.searchParams.get("id")} · QA`,
          normalized_phone: "+12025550123",
        },
        stats: {},
        tags: [],
        preferences: [],
        upcoming: [],
      };
    if (resource === "setup")
      json = { checked_at: new Date().toISOString(), checks: [] };
    await route.fulfill({ json });
  });
}
async function query(page: Page, path: string) {
  await page.evaluate((path) => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
async function capture(page: Page, name: string) {
  await mkdir(output, { recursive: true });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: false,
    animations: "disabled",
  });
}
test.beforeEach(async ({ page }) => {
  await fixtures(page);
});

test("calendar requests and synthetic interaction timing remain measurable", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      /\/api\/(workspace|finance)\//.test(request.url())
    )
      requests.push(request.url());
  });
  await page.goto("/fixture-a/agenda?date=2026-10-23");
  await expect(page.locator(".time-calendar")).toHaveCount(1);
  const initial = [...requests];
  const samples = [];
  for (let index = 0; index < 10; index++) {
    const start = performance.now();
    const offset = requests.length;
    const week = index % 2 === 0;
    await page
      .getByRole("button", { name: week ? "Semana" : "Día", exact: true })
      .click();
    await expect(page.locator(".time-calendar")).toHaveCount(week ? 7 : 1);
    const urls = requests.slice(offset);
    expect(new Set(urls).size).toBe(urls.length);
    samples.push({
      duration_ms: performance.now() - start,
      requests: urls.length,
    });
  }
  const times = samples.map((s) => s.duration_ms).sort((a, b) => a - b);
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/interaction-samples.json`,
    JSON.stringify(
      {
        scope:
          "Isolated actual React components; synthetic API transport, includes Playwright overhead; not HTTP/cloud/field INP",
        initial_gets: initial.length,
        initial_duplicates: initial.length - new Set(initial).size,
        samples,
        p50_ms: times[4],
        p95_ms: times[9],
        p99_ms: times[9],
      },
      null,
      2,
    ),
  );
});

test("agenda follows a new URL in place and browser history while preserving its view", async ({
  page,
}) => {
  await page.goto("/fixture-a/agenda?date=2026-10-23&staff=staff-a");
  const input = page.getByLabel("Fecha de agenda", { exact: true });
  await expect(input).toHaveValue("2026-10-23");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await query(page, "/fixture-a/agenda?date=2026-10-24&staff=staff-b");
  await capture(page, "agenda-navigation-1440");
  await expect(input).toHaveValue("2026-10-24");
  await expect(page.getByLabel("Filtrar por barbero")).toHaveValue("staff-b");
  await expect(
    page.getByRole("button", { name: "Lista", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(input).toHaveValue("2026-10-23");
  await expect(page.getByLabel("Filtrar por barbero")).toHaveValue("staff-a");
  await input.fill("2026-10-25");
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(input).toHaveValue("2026-10-25");
});

test("customer destination opens in place after dismissal and resets detail tabs", async ({
  page,
}) => {
  await page.goto("/fixture-a/clientes?customer=A");
  await expect(
    page.getByRole("dialog", { name: "Cliente A · QA", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Actividad", exact: true }).click();
  await query(page, "/fixture-a/clientes?customer=B");
  await capture(page, "customer-navigation-1440");
  const dialog = page.getByRole("dialog", {
    name: "Cliente B · QA",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("tab", { name: "Resumen", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await query(page, "/fixture-a/clientes?customer=C");
  await expect(
    page.getByRole("dialog", { name: "Cliente C · QA", exact: true }),
  ).toBeVisible();
});

for (const resource of ["catalog", "checkout", "cash"]) {
  test(`checkout exposes ${resource} read failures with recovery and no write`, async ({
    page,
  }) => {
    let fail = true;
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") writes.push(request.url());
    });
    await page.route(`**/api/finance/${resource}?**`, (route) =>
      fail
        ? route.fulfill({
            status: 503,
            json: { error: "Lectura QA no disponible" },
          })
        : route.fallback(),
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/fixture-a/checkout");
    await expect(page.locator(".loading:visible")).toHaveCount(0);
    await capture(page, `checkout-${resource}-error-390`);
    await expect(page.getByRole("alert")).toContainText(
      "Lectura QA no disponible",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(
      page.getByRole("button", { name: /Preparar cobro|Cobrar y registrar/ }),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
    fail = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cobrar y registrar", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("checkout waits for cash and confirms only a successful POST, even during revalidation", async ({
  page,
}) => {
  let releaseCash!: () => void;
  const cashGate = new Promise<void>((resolve) => {
    releaseCash = resolve;
  });
  await page.route("**/api/finance/cash?**", async (route) => {
    await cashGate;
    await route.fallback();
  });
  await page.goto("/fixture-a/checkout");
  try {
    await expect(page.locator(".loading:visible")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Cobrar y registrar", exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseCash();
  }
  await expect(
    page.getByRole("button", { name: "Cobrar y registrar", exact: true }),
  ).toBeVisible();
  let releasePost!: () => void;
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  let posted = false;
  await page.route("**/api/finance/command", async (route) => {
    await postGate;
    posted = true;
    await route.fulfill({ json: { id: "checkout-qa", status: "posted" } });
  });
  await page.route("**/api/finance/checkout?**", (route) =>
    posted
      ? route.fulfill({
          status: 503,
          json: { error: "Falla QA posterior a confirmación" },
        })
      : route.fallback(),
  );
  const button = page.getByRole("button", {
    name: "Cobrar y registrar",
    exact: true,
  });
  await button.click();
  try {
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByText("Venta cobrada y registrada.", { exact: true }),
    ).toHaveCount(0);
  } finally {
    releasePost();
  }
  await expect(
    page.getByText("Venta cobrada y registrada.", { exact: true }),
  ).toBeVisible();
});

test("home does not announce an empty day when its request fails", async ({
  page,
}) => {
  await page.route("**/api/workspace/agenda?**", (route) =>
    route.fulfill({ status: 503, json: { error: "Agenda QA no disponible" } }),
  );
  await page.goto("/fixture-a/inicio");
  await expect(page.getByRole("alert")).toContainText(
    "Agenda QA no disponible",
  );
  await capture(page, "home-error-1440");
  await expect(
    page.getByText("Sin próximas citas hoy", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reintentar", exact: true }),
  ).toBeVisible();
});

test("calendar list does not invent an empty result during loading", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/workspace/agenda?**", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/fixture-a/agenda");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  try {
    await capture(page, "agenda-loading-1440");
    await expect(
      page.getByText("Sin reservas en este rango.", { exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByText("Sin reservas en este rango.", { exact: true }),
  ).toBeVisible();
});

test("selection, keyboard, reduced motion, contrast and target viewports", async ({
  page,
}) => {
  await page.goto("/fixture-a/agenda");
  await expect(page.locator(".loading:visible")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Día", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Semana", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Semana", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const samples = [];
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations;
    expect(violations).toEqual([]);
    await capture(page, `agenda-${width}`);
    samples.push({ width, axe_violations: violations.length });
  }
  await query(page, "/fixture-a/clientes");
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: false })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Nuevo cliente", exact: false }),
  ).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: false })
    .click();
  expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  const enlarged = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll("body *"))
      .map((el) => ({
        element: el.tagName,
        class: el.className,
        right: el.getBoundingClientRect().right,
        width: el.getBoundingClientRect().width,
      }))
      .filter((el) => el.right > innerWidth + 1)
      .slice(0, 20),
  }));
  expect(enlarged.scroll, JSON.stringify(enlarged)).toBeLessThanOrEqual(
    enlarged.width,
  );
  await capture(page, "customer-zoom-200");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await expect(
    page.getByRole("button", { name: "Activos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await query(page, "/fixture-a/configuracion");
  await expect(
    page.getByRole("button", { name: "Puesta en marcha", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/accessibility.json`,
    JSON.stringify(
      {
        scope: "Actual components with synthetic transport; not real Auth",
        samples,
      },
      null,
      2,
    ),
  );
});
