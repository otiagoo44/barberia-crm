import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { totp, verifyRequest } from "./mfa-helper";
const real = process.env.E2E_REAL_SUPABASE === "1";
test.describe("Real MFA release boundary", () => {
  test.skip(!real, "Requires isolated Supabase Auth; no mock proof");
  test("AAL1 privileged sessions fail HTTP and direct Data API until TOTP; spoofed headers cannot elevate", async ({
    page,
  }) => {
    const request = page.request;
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/fixture-a/agenda");
    await expect(page).toHaveURL(/\/login$/);
    const f = JSON.parse(
      await readFile(".test-data/e2e/fixtures.json", "utf8"),
    );
    for (const role of ["ownerA", "managerA1", "financeA", "platform"]) {
      const login = await request.post("/api/auth/signin", {
        headers: { Origin: "http://localhost:3000" },
        data: { email: `${role}@fixture.invalid`, password: f.password },
      });
      expect(login.status()).toBe(200);
      for (const module of ["inicio", "agenda", "clientes", "caja"]) {
        await page.goto(`/fixture-a/${module}`);
        await expect(page).toHaveURL(/\/mfa$/);
        await expect(
          page.getByRole("heading", { name: "Verificá tu identidad" }),
        ).toBeVisible();
      }
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
    expect(pageErrors).toEqual([]);
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
    const invalidCode = ((Number(totp(first)) + 1) % 1000000)
      .toString()
      .padStart(6, "0");
    const invalidFactor = await admin.auth.admin.mfa.listFactors({
      userId: created.data.user!.id,
    });
    const invalid = await page.request.post("/api/auth/mfa/verify", {
      headers: { Origin: "http://localhost:3000" },
      data: { factor: invalidFactor.data!.factors[0].id, code: invalidCode },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.text()).includes(first)).toBe(false);
    await page.getByLabel("Código de 6 dígitos").fill(totp(first));
    await page
      .getByRole("button", { name: "Confirmar autenticador", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mfa");
    await expect(
      page.getByRole("button", { name: "Retirar dispositivo" }),
    ).toBeDisabled();
    const onlyFactor = await page.request.post("/api/auth/mfa/unenroll", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        factor: (
          await admin.auth.admin.mfa.listFactors({
            userId: created.data.user!.id,
          })
        ).data!.factors[0].id,
      },
    });
    expect(onlyFactor.status()).toBe(409);
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
    await expect(
      page.getByText("Respaldo privado", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByAltText("Código QR para agregar tu autenticador"),
    ).toHaveCount(0);
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
    const retirement = page.getByRole("dialog", {
      name: "Retirar dispositivo",
      exact: true,
    });
    await expect(retirement).toBeVisible();
    await retirement
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(
      page.getByText("Teléfono principal", { exact: true }),
    ).toBeVisible();
    const retireButton = page
      .locator(".row")
      .filter({ hasText: "Teléfono principal" })
      .getByRole("button", { name: "Retirar dispositivo" });
    await expect(retireButton).toBeFocused();
    await retireButton.click();
    await retirement
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await expect(
      page.getByText("Teléfono principal", { exact: true }),
    ).toHaveCount(0);
    // Bypass our HTTP endpoint using an ordinary AAL2 Auth token. Provider
    // unenrollment must obey the same last-factor invariant.
    const direct = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(
      (await direct.auth.signInWithPassword({ email, password: f.password }))
        .error,
    ).toBeNull();
    const remaining = await direct.auth.mfa.listFactors();
    const backupId = remaining.data!.totp[0].id;
    expect(
      (
        await direct.auth.mfa.challengeAndVerify({
          factorId: backupId,
          code: totp(backup),
        })
      ).error,
    ).toBeNull();
    const refused = await direct.auth.mfa.unenroll({ factorId: backupId });
    expect(refused.error).not.toBeNull();
    expect((await direct.auth.mfa.listFactors()).data!.totp).toHaveLength(1);
    await direct.auth.signOut({ scope: "local" });
    const auditPool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
    try {
      const leakage = await auditPool.query(
        "select exists(select 1 from public.audit_logs where strpos(metadata::text,$1)>0 or strpos(metadata::text,$2)>0) or exists(select 1 from auth.audit_log_entries where strpos(payload::text,$1)>0 or strpos(payload::text,$2)>0) leaked",
        [first, backup],
      );
      expect(leakage.rows[0].leaked).toBe(false);
    } finally {
      await auditPool.end();
    }
    // Exercise the real callback/OTP/password path locally without claiming an
    // SMTP delivery. A recovery email must still require the existing factor.
    const recovery = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    expect(recovery.error).toBeNull();
    await page.goto(
      "/auth/callback?type=recovery&next=reset-password&token_hash=" +
        recovery.data.properties!.hashed_token,
    );
    await expect(page).toHaveURL(/\/mfa\?next=reset-password$/);
    await page.getByLabel("Código de 6 dígitos").fill(totp(backup));
    await page
      .getByRole("button", { name: "Verificar y continuar", exact: true })
      .click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(f.password + "recovered");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mfa");
    await page
      .getByRole("button", { name: "Cerrar todas mis sesiones" })
      .click();
    const revocation = page.getByRole("dialog", {
      name: "Cerrar todas mis sesiones",
      exact: true,
    });
    await expect(revocation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", {
        name: "Cerrar todas mis sesiones",
        exact: true,
      }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Cerrar todas mis sesiones", exact: true })
      .click();
    await revocation
      .getByRole("button", { name: "Confirmar", exact: true })
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
