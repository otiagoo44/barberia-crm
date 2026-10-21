import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { totp, verifyRequest } from "./mfa-helper";
const real = process.env.E2E_REAL_SUPABASE === "1";
test.describe("Real MFA release boundary", () => {
  test.skip(!real, "Requires isolated Supabase Auth; no mock proof");
  test("AAL1 privileged sessions fail HTTP and direct Data API until TOTP; spoofed headers cannot elevate", async ({
    request,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    for (const role of ["ownerA", "managerA1", "financeA", "platform"]) {
      const login = await request.post("/api/auth/signin", {
        headers: { Origin: "http://localhost:3000" },
        data: { email: `${role}@fixture.invalid`, password: f.password },
      });
      expect(login.status()).toBe(200);
      const forbidden = await request.get(
        `/api/finance/summary?org=${f.orgA}&branch=${f.branches.a1}&from=2026-10-01&to=2026-10-20`,
        { headers: { "x-aal": "aal2" } },
      );
      expect(forbidden.status()).toBe(403);
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      await client.auth.signInWithPassword({
        email: `${role}@fixture.invalid`,
        password: f.password,
      });
      const rows = await client.from("customers").select("id");
      expect(rows.error).toBeNull();
      expect(rows.data).toEqual([]);
      const forged = await client.rpc("finance_command", {
        p_org: f.orgA,
        p_branch: f.branches.a1,
        p_action: "open_cash_session",
        p_data: { opening_amount_minor: 0, aal: "aal2" },
        p_key: crypto.randomUUID(),
      });
      expect(forged.error?.code).toBe("42501");
      await verifyRequest(request, role);
      const verified = await request.get(
        `/api/finance/summary?org=${f.orgA}&branch=${f.branches.a1}&from=2026-10-01&to=2026-10-20`,
      );
      expect(verified.status()).toBe(role === "platform" ? 400 : 200);
      await client.auth.signOut();
    }
  });
  test("TOTP enrollment, backup authenticator recovery, retirement and global revocation use actual Auth", async ({
    page,
  }) => {
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.LOCAL_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const email = `mfa-flow-${crypto.randomUUID()}@fixture.invalid`;
    const created = await admin.auth.admin.createUser({
      email,
      password: f.password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email, password: f.password },
    });
    await page.goto("/mfa");
    await page.getByLabel("Nombre del dispositivo").fill("Teléfono principal");
    await page
      .getByRole("button", { name: "Configurar dispositivo", exact: true })
      .click();
    await expect(
      page.getByAltText("Código QR para agregar tu autenticador"),
    ).toBeVisible();
    await page
      .getByText("Ingresar la clave manualmente", { exact: true })
      .click();
    const first = (await page.locator(".secret-key").textContent())!;
    await page.getByLabel("Código de 6 dígitos").fill(totp(first));
    await page
      .getByRole("button", { name: "Confirmar autenticador", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mfa");
    await expect(
      page.getByRole("button", { name: "Retirar dispositivo" }),
    ).toBeDisabled();
    await page.getByLabel("Nombre del dispositivo").fill("Respaldo privado");
    await page
      .getByRole("button", { name: "Configurar dispositivo", exact: true })
      .click();
    await page
      .getByText("Ingresar la clave manualmente", { exact: true })
      .click();
    const backup = (await page.locator(".secret-key").textContent())!;
    await page.getByLabel("Código de 6 dígitos").fill(totp(backup));
    await page
      .getByRole("button", { name: "Confirmar autenticador", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu acceso está protegido" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(f.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/mfa$/);
    await page
      .getByLabel("Dispositivo")
      .selectOption({ label: "Respaldo privado" });
    await page.getByLabel("Código de 6 dígitos").fill(totp(backup));
    await page
      .getByRole("button", { name: "Verificar y continuar", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mfa");
    await page
      .locator(".row")
      .filter({ hasText: "Teléfono principal" })
      .getByRole("button", { name: "Retirar dispositivo" })
      .click();
    await expect(
      page.getByText("Teléfono principal", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Cerrar todas mis sesiones" })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (
        await page.request.get("/api/workspace/notifications?org=" + f.orgA)
      ).status(),
    ).toBe(401);
    expect(await requestNoSecret(page.request)).toBe(403);
  });
});
async function requestNoSecret(
  request: import("@playwright/test").APIRequestContext,
) {
  return (await request.get("/api/health/operations")).status();
}
