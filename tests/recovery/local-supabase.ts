import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { asUser } from "../integration/database";
import type { fixtures } from "../integration/fixtures";
const connection = process.env.LOCAL_DB_URL!;
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(connection).hostname)
)
  throw new Error("Recovery drill only supports isolated Supabase localhost");
const f = JSON.parse(
  await readFile(".test-data/e2e/fixtures.json", "utf8"),
) as Awaited<ReturnType<typeof fixtures>>;
const pool = new Pool({ connectionString: connection });
const container = "supabase_db_barberia-crm";
const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(new URL(connection).password),
};
const start = performance.now();
let restored: Pool | undefined;
try {
  // Financial source data belongs only to the isolated Auth fixtures, never a cloud project.
  const finance = async (action: string, data: object) =>
    (
      await asUser<{ result: { id: string } }>(
        pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) result",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), randomUUID()],
      )
    )[0].result.id;
  const method = await finance("configure", {
    entity: "payment_methods",
    name: "Recovery cash",
    code: "recovery_cash",
    type: "cash",
  });
  await finance("configure", {
    entity: "payment_method_fee_rules",
    payment_method_id: method,
    percentage_bps: 0,
    fixed_amount_minor: 0,
  });
  const item = await finance("configure", {
    entity: "finance_items",
    name: "Recovery product",
    kind: "product",
    price_minor: 10000,
  });
  const session = await finance("open_cash_session", {
    opening_amount_minor: 1000,
  });
  const checkout = await finance("create_checkout", {
    lines: [{ item_id: item, quantity: 1 }],
  });
  await finance("post_checkout", {
    id: checkout,
    payments: [
      {
        payment_method_id: method,
        amount_minor: 10000,
        cash_session_id: session,
      },
    ],
  });
  const dump = execFileSync(
    "docker",
    [
      "exec",
      "-e",
      "PGPASSWORD",
      container,
      "pg_dump",
      "-U",
      "postgres",
      "-h",
      "127.0.0.1",
      "-Fc",
      "--schema=public",
      "--schema=app_private",
      "--schema=auth",
      "--schema=extensions",
      "--no-publications",
      "--no-subscriptions",
      "postgres",
    ],
    { env, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  await pool.query("create database recovery_drill");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGPASSWORD",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "-h",
      "127.0.0.1",
      "-d",
      "recovery_drill",
      "--exit-on-error",
      "--no-owner",
      "--clean",
      "--if-exists",
    ],
    {
      env,
      input: dump,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const target = new URL(connection);
  target.pathname = "/recovery_drill";
  restored = new Pool({ connectionString: target.toString() });
  const countsSql =
    "select (select count(*)::int from public.organizations) organizations,(select count(*)::int from public.customers) customers,(select count(*)::int from public.staff) staff,(select count(*)::int from auth.users) auth_users,(select count(*)::int from public.audit_logs) audit_logs,(select count(*)::int from public.checkouts) checkouts,(select count(*)::int from public.payments) payments,(select count(*)::int from public.cash_movements) cash_movements";
  const source = (await pool.query(countsSql)).rows[0];
  assert.deepEqual((await restored.query(countsSql)).rows[0], source);
  assert.equal(
    (
      await asUser(
        restored,
        f.users.ownerA,
        "select id from public.customers where organization_id=$1",
        [f.orgB],
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await asUser(
        restored,
        f.users.managerA1,
        "select id from public.branches where id=$1",
        [f.branches.a2],
      )
    ).length,
    0,
  );
  const rls = (
    await restored.query(
      "select count(*)::int total,count(*) filter(where relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r'",
    )
  ).rows[0];
  assert.equal(rls.total, rls.protected);
  const restoredFinance = await asUser<{
    result: { session: { expected_cash_minor: number } };
  }>(
    restored,
    f.users.ownerA,
    "select public.finance_read($1,$2,'cash',current_date,current_date) result",
    [f.orgA, f.branches.a1],
  );
  assert.equal(restoredFinance[0].result.session.expected_cash_minor, 11000);
  assert.equal(
    (await asUser(restored, f.users.ownerB, "select id from public.payments"))
      .length,
    0,
  );
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(9, 0, 0, 0);
  const key = randomUUID();
  const args = [
    f.orgA,
    f.branches.a1,
    [f.services.cut],
    f.staff.a1,
    tomorrow.toISOString(),
    f.customers.a1,
    key,
  ];
  const sql =
    "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null) result";
  const booking = await asUser<{ result: { id: string } }>(
    restored,
    f.users.ownerA,
    sql,
    args,
  );
  const retry = await asUser<{ result: { id: string } }>(
    restored,
    f.users.ownerA,
    sql,
    args,
  );
  assert.equal(booking[0].result.id, retry[0].result.id);
  await assert.rejects(
    restored.query(
      "insert into public.appointments(organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,currency) values($1,$2,$3,$4,$5,$5::timestamptz+interval '40 minutes',40,'USD')",
      [
        f.orgA,
        f.branches.a1,
        f.customers.a2,
        f.staff.a1,
        tomorrow.toISOString(),
      ],
    ),
    { code: "23P01" },
  );
  const report = {
    executed_at: new Date().toISOString(),
    source:
      "Isolated Docker Supabase with real Auth fixtures; not managed production backup",
    status: "PASSED",
    dump_bytes: dump.byteLength,
    restore_and_validation_ms: Math.round(performance.now() - start),
    source_counts: source,
    checks: [
      "row counts incl Auth/audit",
      "all public tables RLS",
      "tenant isolation",
      "manager branch isolation",
      "idempotent booking",
      "GiST overlap constraint",
      "financial row counts, cash balance and tenant isolation",
    ],
    production_restore: "NOT_TESTED",
    schemas: ["public", "app_private", "auth", "extensions"],
    managed_platform_restore:
      "NOT_TESTED: Realtime/Storage infrastructure and publications are provisioned separately, not restored by this application drill.",
    ownership:
      "Portable local restore --no-owner; ACLs and RLS retained. Cloud ownership restoration not exercised.",
  };
  await mkdir("docs/verification", { recursive: true });
  await writeFile(
    "docs/verification/restore-local.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await restored?.end();
  await pool.query("drop database if exists recovery_drill");
  await pool.end();
}
