import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { fixtures } from "../integration/fixtures";
type Fixture = Awaited<ReturnType<typeof fixtures>> & { password: string };
const real = process.env.E2E_REAL_SUPABASE === "1";
let f: Fixture;
test.beforeAll(async () => {
  if (real)
    f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
});
async function login(page: Page, role: keyof Fixture["users"] = "ownerA") {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(`${role}@fixture.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
test("Login is responsive, has security headers, keyboard access and no browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const result = await page.goto("/login");
  expect(result!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(result!.headers()["x-frame-options"]).toBe("DENY");
  expect(result!.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir al contenido" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Crear una cuenta" }).click();
  await expect(page.getByLabel("Tu nombre")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(errors).toEqual([]);
});
test.describe("Real Supabase Auth and domain flows", () => {
  test.skip(
    !real,
    "Requires isolated local Supabase; never substitutes mocked Auth",
  );
  test("Signed sessions enforce tenant, branch, role and anonymous database permissions", async ({
    page,
  }) => {
    await login(page);
    const cookies = await page.context().cookies();
    expect(
      cookies
        .filter((c) => c.name.includes("auth-token"))
        .every((c) => c.httpOnly),
    ).toBeTruthy();
    expect(cookies.some((c) => c.name.includes("auth-token"))).toBeTruthy();
    const blocked = await page.request.get(
      `/api/workspace/customers?org=${f.orgB}`,
    );
    expect(blocked.status()).toBe(403);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await client.from("customers").select("id");
    expect(error).toBeTruthy();
    for (const [role, org, branch] of [
      ["ownerA", f.orgB, null],
      ["managerA1", f.orgA, f.branches.a2],
      ["ownerB", f.orgA, null],
    ] as const) {
      const signed = await client.auth.signInWithPassword({
        email: `${role}@fixture.invalid`,
        password: f.password,
      });
      expect(signed.error).toBeNull();
      const result = await client.rpc("list_customers", {
        p_org: org,
        p_branch: branch,
        p_query: "",
        p_cursor: null,
        p_limit: 50,
        p_retention: "all",
      });
      expect(result.error?.code).toBe("42501");
    }
    await client.auth.signInWithPassword({
      email: "receptionA@fixture.invalid",
      password: f.password,
    });
    const roles = await client.rpc("manage_membership", {
      p_org: f.orgA,
      p_email: "barberA@fixture.invalid",
      p_role: "organization_owner",
      p_all_branches: true,
      p_branches: [],
      p_active: true,
    });
    expect(roles.error?.code).toBe("42501");
    const rejectedOrigin = await page.request.post("/api/workspace/record", {
      headers: { Origin: "https://attacker.invalid" },
      data: {
        org: f.orgA,
        branch: f.branches.a1,
        entity: "customers",
        id: f.customers.a1,
        data: { name: "spoof" },
      },
    });
    expect(rejectedOrigin.status()).toBe(403);
  });
  test("Public booking through the browser creates one server-calculated reservation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/book/fixture-a/a1");
    await expect(
      page.getByRole("heading", { name: "fixture-a", exact: true }),
    ).toBeVisible();
    await page.getByLabel("cut", { exact: true }).check();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await page
      .getByLabel("Fecha", { exact: true })
      .fill(tomorrow.toISOString().slice(0, 10));
    await expect(page.locator(".slot-grid button").first()).toBeVisible();
    await page.locator(".slot-grid button").first().click();
    await page.locator('input[name="name"]').fill("Cliente público E2E");
    await page.locator('input[name="phone"]').fill("+12025550999");
    await page.getByRole("button", { name: "Confirmar mi reserva" }).click();
    await expect(
      page.getByRole("heading", { name: "Tu reserva quedó registrada" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
  test("Internal agenda, walk-ins, customers, retention, goals and reporting render actual data", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    for (const module of [
      "inicio",
      "agenda",
      "clientes",
      "walk-ins",
      "retencion",
      "equipo",
      "servicios",
      "sucursales",
      "metas",
      "reportes",
      "configuracion",
    ]) {
      await page.goto(`/fixture-a/${module}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await page.goto("/fixture-a/clientes");
    await page
      .getByRole("button", { name: "Customer a1", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Historial", exact: true }),
    ).toBeVisible();
    await page.locator('textarea[name="body"]').fill("Prefiere tijera");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(
      page.getByText("Prefiere tijera", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/fixture-a/agenda");
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `test-results/agenda-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
});
