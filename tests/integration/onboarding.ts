import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { asUser } from "./database";

export async function onboardingContracts(pool: Pool) {
  // Dynamic import keeps the operator's generator usable directly with Node.
  const { onboardingSql } = await import("../../scripts/onboard-1717.mjs");
  await pool.query(
    "alter table auth.users add column if not exists email_confirmed_at timestamptz",
  );
  const owner = randomUUID();
  await pool.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'setup@fixture.invalid',now())",
    [owner],
  );
  const sql = await onboardingSql("setup@fixture.invalid");
  await pool.query(sql);
  await pool.query(sql);
  const rows = await asUser<{ id: string; currency: string }>(
    pool,
    owner,
    "select id,currency from public.organizations where slug='1717-barberia'",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currency, "PYG");
  const org = rows[0].id;
  const operationalSetup = await readFile(
    "scripts/configure-1717-operations.sql",
    "utf8",
  );
  await pool.query(operationalSetup);
  await pool.query(operationalSetup);
  const { rows: counts } = await pool.query(
    `select
    (select count(*) from public.staff where organization_id=$1)::int staff,
    (select count(*) from public.payment_methods where organization_id=$1)::int methods,
    (select count(*) from public.staff_availability_rules where organization_id=$1)::int shifts,
    (select count(*) from public.commission_rules where organization_id=$1)::int commissions,
    (select count(*) from public.checkouts where organization_id=$1)::int sales,
    (select booking_enabled from public.organization_settings where organization_id=$1) enabled,
    (select count(*) from app_private.platform_admins where profile_id=$2)::int platform`,
    [org, owner],
  );
  assert.deepEqual(counts[0], {
    staff: 2,
    methods: 4,
    shifts: 0,
    commissions: 0,
    sales: 0,
    enabled: false,
    platform: 0,
  });
  const manifest = JSON.parse(
    await readFile("config/onboarding/1717.json", "utf8"),
  );
  const { rows: services } = await pool.query(
    "select count(*)::int n from public.services where organization_id=$1",
    [org],
  );
  assert.equal(
    services[0].n,
    manifest.services.filter(
      (s: { duration_minutes: number | null }) => s.duration_minutes !== null,
    ).length,
  );
  const other = randomUUID();
  await pool.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'other-setup@fixture.invalid',now())",
    [other],
  );
  await assert.rejects(
    pool.query(await onboardingSql("other-setup@fixture.invalid")),
    /another owner/,
  );
  await pool.query("rollback");
  assert.equal(
    (
      await asUser(
        pool,
        other,
        "select id from public.organizations where id=$1",
        [org],
      )
    ).length,
    0,
  );
  const { rows: financialSetup } = await pool.query(
    `select b.id branch, (select id from public.staff where organization_id=$1 order by id limit 1) staff,
    (select id from public.services where organization_id=$1 order by id limit 1) service,
    (select id from public.payment_methods where organization_id=$1 and code='transfer') method,
    (select id from public.expense_categories where organization_id=$1 and kind='operating' limit 1) category
    from public.branches b where b.organization_id=$1`,
    [org],
  );
  const setup = financialSetup[0];
  async function command(action: string, data: object, actor = owner) {
    const result = await asUser<{ result: { id: string } }>(
      pool,
      actor,
      "select public.finance_command($1,$2,$3,$4,$5) result",
      [org, setup.branch, action, data, randomUUID()],
    );
    return result[0].result;
  }
  await assert.rejects(
    command("configure_settings", {
      remuneration_model: "equal_profit_share",
      profit_share_staff_ids: [setup.staff],
    }),
    { code: "22023" },
  );
  await assert.rejects(
    command("configure_settings", {
      remuneration_model: "equal_profit_share",
      profit_share_staff_ids: [setup.staff, setup.staff],
    }),
    { code: "22023" },
  );
  await assert.rejects(
    command("configure_settings", { remuneration_model: "commission" }, other),
    { code: "42501" },
  );
  await assert.rejects(
    asUser(
      pool,
      owner,
      "select app_private.configure_profit_settings($1,'{}')",
      [org],
    ),
    { code: "42501" },
  );
  const sale = await command("create_checkout", {
    lines: [{ service_id: setup.service, staff_id: setup.staff, quantity: 1 }],
  });
  const { rows: prices } = await pool.query(
    "select total_minor from public.checkouts where id=$1",
    [sale.id],
  );
  const amount = Number(prices[0].total_minor);
  await command("record_payment", {
    checkout_id: sale.id,
    payment_method_id: setup.method,
    amount_minor: amount,
  });
  await command("post_checkout", { id: sale.id });
  await command("create_expense", {
    category_id: setup.category,
    payment_method_id: setup.method,
    amount_minor: 1001,
    description: "Fixed business cost",
  });
  const summary = await asUser<{
    result: {
      profit_sharing: {
        profit_minor: number;
        per_partner_minor: number;
        remainder_minor: number;
        partners: unknown[];
      };
    };
  }>(
    pool,
    owner,
    "select public.finance_read($1,$2,'summary',current_date-1,current_date+1) result",
    [org, setup.branch],
  );
  assert.equal(summary[0].result.profit_sharing.profit_minor, amount - 1001);
  assert.equal(
    summary[0].result.profit_sharing.per_partner_minor,
    Math.floor((amount - 1001) / 2),
  );
  assert.equal(
    summary[0].result.profit_sharing.remainder_minor,
    (amount - 1001) % 2,
  );
  assert.equal(summary[0].result.profit_sharing.partners.length, 2);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from public.commission_entries where checkout_id=$1",
        [sale.id],
      )
    ).rows[0].n,
    0,
  );
  await assert.rejects(
    command("configure_settings", {
      remuneration_model: "commission",
      profit_share_staff_ids: [],
    }),
    { code: "23514" },
  );
  await command("create_expense", {
    category_id: setup.category,
    payment_method_id: setup.method,
    amount_minor: amount,
    description: "Period loss case",
  });
  const loss = await asUser<{
    result: {
      profit_sharing: { profit_minor: number; per_partner_minor: number };
    };
  }>(
    pool,
    owner,
    "select public.finance_read($1,$2,'summary',current_date-1,current_date+1) result",
    [org, setup.branch],
  );
  assert.equal(loss[0].result.profit_sharing.profit_minor, -1001);
  assert.equal(loss[0].result.profit_sharing.per_partner_minor, 0);
  console.log(
    "PASS Profit sharing: equal allocation after costs, exact rounding, losses, no service commission, permissions and history lock",
  );
  console.log(
    "PASS Onboarding: confirmed owner, idempotency, tenant isolation, no invented schedules/commissions/sales or platform access",
  );
  for (const call of [
    "app_private.run_scheduled_jobs()",
    "app_private.worker_tick_core()",
    "app_private.claim_jobs_core(20)",
    "app_private.process_job_core(gen_random_uuid(),gen_random_uuid())",
    "app_private.fail_job_core(gen_random_uuid(),gen_random_uuid())",
  ]) {
    for (const actor of [owner, null]) {
      await assert.rejects(asUser(pool, actor, `select ${call}`), {
        code: "42501",
      });
    }
  }
  await pool.query(
    "insert into public.automation_jobs(organization_id,branch_id,job_type,payload) select organization_id,id,'metrics_rebuild','{\"local_dates\":[]}' from public.branches where organization_id=$1",
    [org],
  );
  const { rows: scheduler } = await pool.query(
    "select app_private.run_scheduled_jobs() as result",
  );
  assert.equal(scheduler[0].result.failed, 0);
  assert.ok(scheduler[0].result.completed >= 1);
  const { rows: drained } = await pool.query(
    "select app_private.run_scheduled_jobs() as result",
  );
  assert.equal(drained[0].result.completed, 0);
  console.log(
    "PASS Scheduler: owner-only execution, gateway unchanged, jobs drained without duplicate work",
  );
}
