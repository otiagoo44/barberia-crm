import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { totp } from "./mfa-helper";

test.describe("Live authorization with real signed Auth sessions", () => {
  test.skip(
    process.env.E2E_REAL_SUPABASE !== "1",
    "Requires isolated localhost GoTrue and PostgREST",
  );
  for (const change of [
    "membership",
    "branch",
    "profile",
    "session",
  ] as const) {
    test(`${change} revocation denies a waiting HTTP command and stale Data API/RPC access`, async ({
      request,
    }) => {
      const f = JSON.parse(
        await readFile(".test-data/e2e/fixtures.json", "utf8"),
      );
      if (
        !["localhost", "127.0.0.1"].includes(
          new URL(process.env.LOCAL_DB_URL!).hostname,
        )
      )
        throw new Error("Local Auth fixtures only");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const options = {
        auth: { persistSession: false, autoRefreshToken: false },
      };
      const admin = createClient(
        url,
        process.env.LOCAL_SERVICE_ROLE_KEY!,
        options,
      );
      const db = createClient(
        url,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        options,
      );
      const email = `revocation-${crypto.randomUUID()}@fixture.invalid`;
      const created = await admin.auth.admin.createUser({
        email,
        password: f.password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      const user = created.data.user!.id;
      const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
      const blocker = await pool.connect();
      let pending: Promise<import("@playwright/test").APIResponse> | undefined;
      try {
        const member = crypto.randomUUID();
        await pool.query(
          "insert into public.organization_memberships(id,organization_id,profile_id,role,all_branches) values($1,$2,$3,'manager',false)",
          [member, f.orgA, user],
        );
        await pool.query(
          "insert into public.membership_branch_access(organization_id,membership_id,branch_id) values($1,$2,$3)",
          [f.orgA, member, f.branches.a1],
        );
        expect(
          (await db.auth.signInWithPassword({ email, password: f.password }))
            .error,
        ).toBeNull();
        const enrolled = await db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Isolated revocation factor",
        });
        expect(enrolled.error).toBeNull();
        const factor = enrolled.data!;
        expect(
          (
            await db.auth.mfa.challengeAndVerify({
              factorId: factor.id,
              code: totp(factor.totp.secret),
            })
          ).error,
        ).toBeNull();
        const headers = { Origin: "http://localhost:3000" };
        expect(
          (
            await request.post("/api/auth/signin", {
              headers,
              data: { email, password: f.password },
            })
          ).ok(),
        ).toBeTruthy();
        expect(
          (
            await request.post("/api/auth/mfa/verify", {
              headers,
              data: { factor: factor.id, code: totp(factor.totp.secret) },
            })
          ).ok(),
        ).toBeTruthy();
        const endpoint = `/api/workspace/customers?org=${f.orgA}&branch=${f.branches.a1}`;
        expect((await request.get(endpoint)).status()).toBe(200);
        expect(
          (await db.from("customers").select("id").eq("id", f.customers.a1))
            .data,
        ).toHaveLength(1);
        const before = (
          await pool.query(
            "select count(*)::int n from public.cash_sessions where organization_id=$1",
            [f.orgA],
          )
        ).rows[0].n;
        await blocker.query("begin");
        await blocker.query("select app_private.lock_organization($1)", [
          f.orgA,
        ]);
        if (change === "membership")
          await blocker.query(
            "update public.organization_memberships set active=false where id=$1",
            [member],
          );
        if (change === "branch")
          await blocker.query(
            "delete from public.membership_branch_access where membership_id=$1",
            [member],
          );
        if (change === "profile")
          await blocker.query(
            "update public.profiles set active=false where id=$1",
            [user],
          );
        if (change === "session")
          await blocker.query("delete from auth.sessions where user_id=$1", [
            user,
          ]);
        pending = request.post("/api/finance/command", {
          headers,
          data: {
            org: f.orgA,
            branch: f.branches.a1,
            action: "open_cash_session",
            data: { opening_amount_minor: 0 },
            key: crypto.randomUUID(),
          },
        });
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          waiting = (
            await pool.query(
              "select exists(select 1 from pg_stat_activity where wait_event='advisory' and query like '%finance_command%') waiting",
            )
          ).rows[0].waiting;
          if (waiting) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(
          waiting,
          "HTTP RPC must reach and wait for the actual tenant lock",
        ).toBe(true);
        await blocker.query("commit");
        expect((await pending).status()).toBe(403);
        expect([401, 403]).toContain((await request.get(endpoint)).status());
        // The SDK still holds its original signed JWT. No signout, refresh or
        // fake claims precede these stale-token requests.
        const rows = await db
          .from("customers")
          .select("id")
          .eq("id", f.customers.a1);
        expect(rows.error).toBeNull();
        expect(rows.data).toEqual([]);
        const denied = await db.rpc("finance_command", {
          p_org: f.orgA,
          p_branch: f.branches.a1,
          p_action: "open_cash_session",
          p_data: { opening_amount_minor: 0 },
          p_key: crypto.randomUUID(),
        });
        expect(denied.error?.code).toBe("42501");
        expect(
          (
            await pool.query(
              "select count(*)::int n from public.cash_sessions where organization_id=$1",
              [f.orgA],
            )
          ).rows[0].n,
        ).toBe(before);
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (pending) await pending;
        await pool.end();
      }
    });
  }
});
