import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { totp } from "./mfa-helper";

test("provisioned owner must verify real MFA and replace the temporary password before HTTP and Data API business access", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const value of [
    process.env.LOCAL_DB_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ])
    if (!value || !["localhost", "127.0.0.1"].includes(new URL(value).hostname))
      throw new Error("Initial-password fixture is localhost only");
  const f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const admin = createClient(url, process.env.LOCAL_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `initial-password-${randomUUID()}@fixture.invalid`;
  const password = randomBytes(24).toString("base64url"),
    replacement = randomBytes(24).toString("base64url");
  // Confirmed synthetic E2E fixture only; real owners are never auto-confirmed.
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  const user = created.data.user!.id;
  const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
  try {
    await pool.query(
      "insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values($1,$2,'organization_owner',true)",
      [f.orgA, user],
    );
    await pool.query(
      "insert into app_private.required_password_changes(profile_id) values($1)",
      [user],
    );
    const headers = { Origin: "http://localhost:3000" };
    expect(
      (
        await page.request.post("/api/auth/signin", {
          headers,
          data: { email, password },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto("/fixture-a/inicio");
    await expect(page).toHaveURL(/\/mfa\?next=reset-password$/);
    const resource = `/api/finance/summary?org=${f.orgA}&branch=${f.branches.a1}&from=2026-10-01&to=2026-10-26`;
    expect((await page.request.get(resource)).status()).toBe(403);
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await client.auth.signInWithPassword({ email, password })).error,
    ).toBeNull();
    expect((await client.from("customers").select("id")).data).toEqual([]);
    expect(
      (
        await client.auth.updateUser({
          data: { password_change_required: false },
        })
      ).error,
    ).toBeNull();
    const enrolled = await page.request.post("/api/auth/mfa/enroll", {
      headers,
      data: { name: "Synthetic initial-password authenticator" },
    });
    expect(enrolled.ok()).toBeTruthy();
    const factor = await enrolled.json();
    expect(
      (
        await page.request.post("/api/auth/mfa/verify", {
          headers,
          data: { factor: factor.id, code: totp(factor.secret) },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto("/reset-password");
    await expect(
      page.getByText(/Tu cuenta usa una contraseña temporal/),
    ).toBeVisible();
    expect((await page.request.get(resource)).status()).toBe(403);
    expect(
      (
        await page.request.post("/api/auth/password", {
          headers,
          data: { password },
        })
      ).status(),
    ).toBe(400);
    expect((await page.request.get(resource)).status()).toBe(403);
    expect(
      (
        await page.request.post("/api/auth/password", {
          headers,
          data: { password: replacement },
        })
      ).ok(),
    ).toBeTruthy();
    expect((await page.request.get(resource)).ok()).toBeTruthy();
    expect(
      (
        await pool.query(
          "select completed_at is not null completed from app_private.required_password_changes where profile_id=$1",
          [user],
        )
      ).rows[0].completed,
    ).toBe(true);
    const old = await client.auth.signInWithPassword({ email, password });
    expect(old.error).not.toBeNull();
    expect(
      (await client.auth.signInWithPassword({ email, password: replacement }))
        .error,
    ).toBeNull();
    // Password replacement never bypasses the owner's MFA requirement.
    expect((await client.from("customers").select("id")).data).toEqual([]);
    await client.auth.signOut();
  } finally {
    await pool.end();
  }
});
