import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { fixtures } from "../integration/fixtures";
import { verifyClient } from "./mfa-helper";

test("cash distribution requires two real signed AAL2 owners and rejects payment after just one approval", async () => {
  test.skip(
    process.env.E2E_REAL_SUPABASE !== "1",
    "Requires isolated GoTrue; SQL fixtures do not prove signed sessions",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (
    !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.LOCAL_DB_URL!).hostname,
    )
  )
    throw new Error("Only isolated localhost is allowed");
  const f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
  const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
  const first = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const second = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let extraOrgs: string[] = [];
  try {
    const isolated = await fixtures(pool, f.users, "real-cash");
    extraOrgs = [isolated.orgA, isolated.orgB];
    const org = isolated.orgA,
      branch = isolated.branches.a1;
    await pool.query(
      "update public.organizations set currency='PYG' where id=$1",
      [org],
    );
    await pool.query(
      "insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values($1,$2,'organization_owner',true)",
      [org, f.users.ownerB],
    );
    await pool.query("update public.staff set profile_id=$2 where id=$1", [
      isolated.staff.a1,
      f.users.ownerA,
    ]);
    await pool.query("update public.staff set profile_id=$2 where id=$1", [
      isolated.staff.a2,
      f.users.ownerB,
    ]);
    for (const [client, role] of [
      [first, "ownerA"],
      [second, "ownerB"],
    ] as const) {
      expect(
        (
          await client.auth.signInWithPassword({
            email: `${role}@fixture.invalid`,
            password: f.password,
          })
        ).error,
      ).toBeNull();
    }
    const call = (client: SupabaseClient, action: string, data: object) =>
      client.rpc("partner_distribution_command", {
        p_org: org,
        p_branch: branch,
        p_action: action,
        p_data: data,
        p_key: crypto.randomUUID(),
      });
    expect((await call(first, "configure_cash", {})).error?.code).toBe("42501");
    await verifyClient(first, "ownerA");
    await verifyClient(second, "ownerB");
    expect(
      (
        await first.rpc("finance_command", {
          p_org: org,
          p_branch: branch,
          p_action: "configure_settings",
          p_data: {
            remuneration_model: "equal_profit_share",
            profit_share_staff_ids: [isolated.staff.a1, isolated.staff.a2],
          },
          p_key: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await call(first, "configure_cash", {
          confirmed: true,
          recognition: "settled_collections_including_advances",
          first_month: "2026-01-01",
          initial_losses_confirmed_zero: true,
          reference: "Isolated real Auth policy evidence",
        })
      ).error,
    ).toBeNull();
    const gates = Object.fromEntries(
      [
        "owner_accounts",
        "smtp",
        "mfa",
        "pos_contract",
        "policy",
        "staging",
        "backup_restore",
        "alerts",
        "pilot",
      ].map((k) => [
        k,
        `Local fixture evidence ${k}; no production certification`,
      ]),
    );
    expect(
      (await call(first, "approve_activation", { gates })).error,
    ).toBeNull();
    expect(
      (await call(first, "prepare", { from: "2026-01-01", to: "2026-01-31" }))
        .error?.message,
    ).toContain("distribution_activation_gates_open");
    expect(
      (await call(second, "approve_activation", { gates })).error,
    ).toBeNull();
    const prepared = await call(first, "prepare", {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(prepared.error).toBeNull();
    const period = prepared.data.id;
    expect(
      (
        await call(first, "approve", {
          id: period,
          reconciled: true,
          reference: "First real owner approval",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await call(first, "approve", {
          id: period,
          reconciled: true,
          reference: "Duplicate real owner approval",
        })
      ).error?.code,
    ).toBe("23505");
    const allocations = await pool.query(
      "select id from public.partner_distribution_allocations where period_id=$1",
      [period],
    );
    expect(
      (await call(first, "pay", { allocation: allocations.rows[0].id })).error
        ?.message,
    ).toContain("dual_approval_required");
    expect(
      (
        await call(second, "approve", {
          id: period,
          reconciled: true,
          reference: "Second real owner approval",
        })
      ).error,
    ).toBeNull();
    const approvals = await pool.query(
      "select a.approver_id,a.session_id,s.user_id from public.partner_period_approvals a join auth.sessions s on s.id=a.session_id where a.period_id=$1",
      [period],
    );
    expect(approvals.rows).toHaveLength(2);
    expect(new Set(approvals.rows.map((a) => a.approver_id)).size).toBe(2);
    expect(
      approvals.rows.every((a) => a.approver_id === a.user_id),
    ).toBeTruthy();
    expect(
      (
        await pool.query(
          "select status from public.partner_distribution_periods where id=$1",
          [period],
        )
      ).rows[0].status,
    ).toBe("approved");
    expect((await first.auth.signOut({ scope: "local" })).error).toBeNull();
    expect(
      (
        await pool.query(
          "select count(*)::int n from public.partner_period_approvals where period_id=$1",
          [period],
        )
      ).rows[0].n,
    ).toBe(2);
  } finally {
    await first.auth.signOut({ scope: "local" });
    await second.auth.signOut({ scope: "local" });
    if (extraOrgs.length)
      await pool.query(
        "update public.organizations set active=false where id=any($1::uuid[])",
        [extraOrgs],
      );
    await pool.end();
  }
});
