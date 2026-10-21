import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import type { fixtures } from "../integration/fixtures";
import { verifyRequest, verifyClient } from "./mfa-helper";
type Fixture = Awaited<ReturnType<typeof fixtures>> & { password: string };
const real = process.env.E2E_REAL_SUPABASE === "1";
let f: Fixture;
test.beforeAll(async () => {
  if (real)
    f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
});
test.describe("HTTP and Data API permission matrix with real Auth", () => {
  test.skip(
    !real,
    "Requires isolated local Supabase; no cloud fixtures or mocked Auth",
  );
  test("concurrent HTTP financial retries create one expense; malformed upload returns 400", async ({
    request,
  }) => {
    const headers = { Origin: "http://localhost:3000" };
    expect(
      (
        await request.post("/api/auth/signin", {
          headers,
          data: { email: "ownerA@fixture.invalid", password: f.password },
        })
      ).ok(),
    ).toBeTruthy();
    await verifyRequest(request, "ownerA");
    const call = async (
      action: string,
      data: object,
      key = crypto.randomUUID(),
    ) =>
      request.post("/api/finance/command", {
        headers,
        data: { org: f.orgA, branch: f.branches.a1, action, data, key },
      });
    const suffix = crypto.randomUUID().slice(0, 8);
    const methodResponse = await call("configure", {
      entity: "payment_methods",
      name: "HTTP retry bank",
      code: `http_bank_${suffix}`,
      type: "bank",
    });
    expect(methodResponse.ok()).toBeTruthy();
    const categoryResponse = await call("configure", {
      entity: "expense_categories",
      name: "HTTP retry rent",
      code: `http_rent_${suffix}`,
      kind: "operating",
    });
    expect(categoryResponse.ok()).toBeTruthy();
    const data = {
      payment_method_id: (await methodResponse.json()).id,
      category_id: (await categoryResponse.json()).id,
      amount_minor: 100,
      description: "HTTP retry fixture",
    };
    const key = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => call("create_expense", data, key)),
    );
    for (const result of results) expect(result.status()).toBe(201);
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(new Set(bodies.map((b) => b.id)).size).toBe(1);
    const badUpload = await request.post("/api/finance/import", {
      headers,
      data: {
        org: f.orgA,
        branch: f.branches.a1,
        key: crypto.randomUUID(),
        action: "preview",
        filename: "bad.xlsx",
        content: Buffer.from("not an XLSX").toString("base64"),
        dry_run: true,
      },
    });
    expect(badUpload.status()).toBe(400);
  });
  test("branch changes close unsaved financial dialogs and malformed agenda dates recover", async ({
    page,
  }) => {
    const login = await page.request.post("/api/auth/signin", {
      headers: { Origin: "http://localhost:3000" },
      data: { email: "ownerA@fixture.invalid", password: f.password },
    });
    expect(login.ok()).toBeTruthy();
    await verifyRequest(page.request, "ownerA");
    await page.goto("/fixture-a/caja");
    await page
      .getByRole("button", { name: "Venta sin cita", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Sucursal activa").selectOption(f.branches.a2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/fixture-a/agenda?date=malformed");
    await expect(
      page.getByRole("heading", { name: "Agenda", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
  for (const role of [
    "ownerA",
    "managerA1",
    "receptionA",
    "barberA",
    "financeA",
    "platform",
  ] as const) {
    test(`${role}: tenant, branch, write, field projection and export denial`, async ({
      request,
    }) => {
      const credentials = {
        email: `${role}@fixture.invalid`,
        password: f.password,
      };
      const login = await request.post("/api/auth/signin", {
        headers: { Origin: "http://localhost:3000" },
        data: credentials,
      });
      expect(login.status()).toBe(200);
      await verifyRequest(request, role);
      const today = new Date().toISOString().slice(0, 10);
      const base = `org=${f.orgA}&branch=${f.branches.a1}&from=${today}&to=${today}`;
      const foreign = await request.get(
        `/api/finance/cash?org=${f.orgB}&branch=${f.branches.b1}&from=${today}&to=${today}`,
      );
      expect(foreign.ok()).toBe(false);
      const exportResult = await request.get(
        `/api/finance/export?${base}&view=expenses`,
      );
      expect(exportResult.ok()).toBe(["ownerA", "financeA"].includes(role));
      const write = await request.post("/api/workspace/membership", {
        headers: { Origin: "http://localhost:3000" },
        data: {
          org: f.orgB,
          email: "ownerA@fixture.invalid",
          role: "organization_owner",
          all_branches: true,
          branches: [],
          active: true,
        },
      });
      expect(write.status()).toBe(403);
      const ownRead = await request.get(
        `/api/workspace/branches?org=${f.orgA}`,
      );
      expect(ownRead.status()).toBe(200);
      expect((await ownRead.json()).items.length).toBe(
        role === "platform"
          ? 0
          : ["ownerA", "receptionA"].includes(role)
            ? 2
            : 1,
      );
      const operationalWrite = await request.post("/api/workspace/record", {
        headers: {
          Origin: "http://localhost:3000",
          "x-role": "organization_owner",
        },
        data: {
          org: f.orgA,
          branch: f.branches.a1,
          entity: "customers",
          id: null,
          data: {
            name: `Auth matrix ${role}`,
            normalized_phone:
              "+1202" +
              crypto
                .randomUUID()
                .replaceAll("-", "")
                .replaceAll(/[a-f]/g, "1")
                .slice(0, 7),
            home_branch_id: f.branches.a1,
          },
        },
      });
      expect(operationalWrite.ok()).toBe(
        ["ownerA", "managerA1", "receptionA"].includes(role),
      );
      if (["managerA1", "financeA"].includes(role)) {
        const otherBranch = await request.get(
          `/api/finance/expenses?org=${f.orgA}&branch=${f.branches.a2}&from=${today}&to=${today}`,
        );
        expect(otherBranch.status()).toBe(403);
      }
      if (["receptionA", "barberA", "platform"].includes(role)) {
        const settlements = await request.get(
          `/api/finance/settlements?${base}`,
        );
        expect(settlements.ok()).toBe(false);
      }
      // Bypass the BFF with an ordinary user token, never a service-role key.
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const auth = await db.auth.signInWithPassword(credentials);
      expect(auth.error).toBeNull();
      await verifyClient(db, role);
      if (["barberA", "financeA", "platform"].includes(role)) {
        expect(
          (
            await db.auth.updateUser({
              data: {
                role: "organization_owner",
                organization_id: f.orgA,
                all_branches: true,
              },
            })
          ).error,
        ).toBeNull();
      }
      const settings = await db
        .from("finance_settings")
        .select("profit_share_staff_ids")
        .eq("organization_id", f.orgA);
      expect(settings.error).toBeNull();
      if (!["ownerA", "financeA"].includes(role))
        expect(settings.data).toEqual([]);
      else expect(settings.data!.length).toBeGreaterThan(0);
      const ownBranches = await db
        .from("branches")
        .select("id")
        .eq("organization_id", f.orgA);
      expect(ownBranches.error).toBeNull();
      expect(ownBranches.data!.length).toBe(
        role === "platform"
          ? 0
          : ["ownerA", "receptionA"].includes(role)
            ? 2
            : 1,
      );
      const directUpdate = await db
        .from("customers")
        .update({ name: "forged update" })
        .eq("id", f.customers.a1);
      expect(directUpdate.error?.code).toBe("42501");
      const foreignEvents = await db
        .from("domain_events")
        .select("id")
        .eq("organization_id", f.orgB);
      expect(foreignEvents.error).toBeNull();
      expect(foreignEvents.data).toEqual([]);
      const audit = await db
        .from("audit_logs")
        .select("id,action")
        .eq("organization_id", f.orgA);
      expect(audit.error).toBeNull();
      if (["receptionA", "barberA", "platform"].includes(role))
        expect(audit.data).toEqual([]);
      if (role === "financeA")
        expect(
          audit.data!.every((row) => row.action.startsWith("finance.")),
        ).toBeTruthy();
      const rows = await db
        .from("customers")
        .select("id")
        .eq("organization_id", f.orgB);
      expect(rows.error).toBeNull();
      expect(rows.data).toEqual([]);
      const directWrite = await db.from("customers").insert({
        organization_id: f.orgA,
        home_branch_id: f.branches.a1,
        name: "forged",
        normalized_phone: "+12025559998",
      });
      expect(directWrite.error).not.toBeNull();
      if (role === "barberA") {
        const otherStaff = await db.rpc("finance_read", {
          p_org: f.orgA,
          p_branch: f.branches.a1,
          p_view: "staff",
          p_from: today,
          p_to: today,
          p_id: f.staff.a2,
        });
        expect(otherStaff.error?.code).toBe("42501");
      }
      // Repeat live profile/membership/session revocation for every signed role.
      // These mutations are fixture administration on localhost, not mocks of
      // the HTTP or PostgREST requests under test.
      if (
        !["localhost", "127.0.0.1"].includes(
          new URL(process.env.LOCAL_DB_URL!).hostname,
        )
      )
        throw new Error("Revocation fixtures require localhost");
      const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
      const user = auth.data.user!.id;
      const memberships = (
        await pool.query(
          "select id from public.organization_memberships where organization_id=$1 and profile_id=$2 and active",
          [f.orgA, user],
        )
      ).rows.map((row) => row.id);
      try {
        await pool.query(
          "update public.profiles set active=false where id=$1",
          [user],
        );
        expect(
          (await request.get(`/api/workspace/branches?org=${f.orgA}`)).status(),
        ).toBe(403);
        expect(
          (await db.from("branches").select("id").eq("organization_id", f.orgA))
            .data,
        ).toEqual([]);
        expect((await db.rpc("security_context")).error?.code).toBe("42501");
        await pool.query("update public.profiles set active=true where id=$1", [
          user,
        ]);
        await pool.query(
          "update public.organization_memberships set active=false where id=any($1::uuid[])",
          [memberships],
        );
        const revoked = await request.get(
          `/api/workspace/branches?org=${f.orgA}`,
        );
        expect(revoked.status()).toBe(200);
        expect((await revoked.json()).items).toEqual([]);
        expect(
          (await db.from("branches").select("id").eq("organization_id", f.orgA))
            .data,
        ).toEqual([]);
        expect(
          (
            await db.rpc("finance_command", {
              p_org: f.orgA,
              p_branch: f.branches.a1,
              p_action: "open_cash_session",
              p_data: { opening_amount_minor: 0 },
              p_key: crypto.randomUUID(),
            })
          ).error?.code,
        ).toBe("42501");
        await pool.query(
          "update public.organization_memberships set active=true where id=any($1::uuid[])",
          [memberships],
        );
        await pool.query("delete from auth.sessions where user_id=$1", [user]);
        expect(
          (await request.get(`/api/workspace/branches?org=${f.orgA}`)).status(),
        ).toBe(401);
        expect(
          (await db.from("branches").select("id").eq("organization_id", f.orgA))
            .data,
        ).toEqual([]);
        expect((await db.rpc("security_context")).error?.code).toBe("42501");
      } finally {
        await pool.query("update public.profiles set active=true where id=$1", [
          user,
        ]);
        await pool.query(
          "update public.organization_memberships set active=true where id=any($1::uuid[])",
          [memberships],
        );
        await pool.end();
      }
      await db.auth.signOut();
    });
  }
  test("Anon cannot read business HTTP/Data API, mutate or execute privileged RPCs", async ({
    request,
  }) => {
    expect(
      (
        await request.get(
          `/api/workspace/customers?org=${f.orgA}&branch=${f.branches.a1}`,
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.get(
          `/api/finance/export?org=${f.orgA}&branch=${f.branches.a1}&from=2026-10-01&to=2026-10-20&view=expenses`,
        )
      ).status(),
    ).toBe(401);
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const table of [
      "customers",
      "payments",
      "audit_logs",
      "domain_events",
      "partner_distribution_payments",
    ]) {
      const r = await db.from(table).select("id");
      expect(r.error?.code).toBe("42501");
    }
    const rpc = await db.rpc("finance_command", {
      p_org: f.orgA,
      p_branch: f.branches.a1,
      p_action: "open_cash_session",
      p_data: { opening_amount_minor: 0, role: "organization_owner" },
      p_key: crypto.randomUUID(),
    });
    expect(rpc.error?.code).toBe("42501");
  });
});
