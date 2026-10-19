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
  const finance = async (action: string, data: object, key = randomUUID()) =>
    (
      await asUser<{ result: { id: string } }>(
        pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) result",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), key],
      )
    )[0].result.id;
  await finance("configure_settings", { advances_deductible: false });
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
  const categories: Record<string, string> = {};
  for (const kind of ["operating", "advance", "salary"])
    categories[kind] = await finance("configure", {
      entity: "expense_categories",
      name: `Recovery ${kind}`,
      code: `recovery_${kind}`,
      kind,
    });
  const expenseKey = randomUUID();
  const expenseData = {
    category_id: categories.operating,
    payment_method_id: method,
    cash_session_id: session,
    amount_minor: 100,
    description: "Recovery operating expense",
  };
  const expenseId = await finance("create_expense", expenseData, expenseKey);
  await finance("record_staff_advance", {
    category_id: categories.advance,
    payment_method_id: method,
    cash_session_id: session,
    staff_id: f.staff.a1,
    amount_minor: 20,
    description: "Recovery advance",
    deductible: false,
  });
  await finance("record_salary_payment", {
    category_id: categories.salary,
    payment_method_id: method,
    cash_session_id: session,
    staff_id: f.staff.a1,
    amount_minor: 30,
    description: "Recovery salary",
  });
  await finance("close_cash_session", {
    id: session,
    actual_cash_minor: 10850,
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
      "--extension=btree_gist",
      "--extension=pg_trgm",
      "--extension=pgcrypto",
      "--no-publications",
      "--no-subscriptions",
      "postgres",
    ],
    { env, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  await pool.query("create database recovery_drill template template0");
  const target = new URL(connection);
  target.pathname = "/recovery_drill";
  restored = new Pool({ connectionString: target.toString() });
  // Only the fresh, disposable recovery database: pg_dump includes CREATE SCHEMA
  // public when schemas are selected explicitly. No application tables exist here.
  await restored.query("drop schema public");
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
      "supabase_admin",
      "-h",
      "127.0.0.1",
      "-d",
      "recovery_drill",
      "--exit-on-error",
    ],
    {
      env,
      input: dump,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const countsSql =
    "select (select count(*)::int from public.organizations) organizations,(select count(*)::int from public.customers) customers,(select count(*)::int from public.staff) staff,(select count(*)::int from auth.users) auth_users,(select count(*)::int from public.audit_logs) audit_logs,(select count(*)::int from public.checkouts) checkouts,(select count(*)::int from public.payments) payments,(select count(*)::int from public.cash_movements) cash_movements,(select count(*)::int from public.expenses) expenses,(select count(*)::int from public.staff_advances) advances,(select count(*)::int from public.salary_payments) salaries,(select count(*)::int from public.daily_closures) closures,(select count(*)::int from app_private.idempotency_keys where operation like 'finance.%') financial_dedupe_keys";
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
  assert.equal(restoredFinance[0].result.session.expected_cash_minor, 10850);
  const retriedExpense = await asUser<{ result: { id: string } }>(
    restored,
    f.users.ownerA,
    "select public.finance_command($1,$2,'create_expense',$3,$4) result",
    [f.orgA, f.branches.a1, JSON.stringify(expenseData), expenseKey],
  );
  assert.equal(retriedExpense[0].result.id, expenseId);
  assert.equal(
    (await restored.query("select count(*)::int n from public.expenses"))
      .rows[0].n,
    source.expenses,
  );
  assert.equal(
    (await asUser(restored, f.users.platform, "select id from public.payments"))
      .length,
    0,
  );
  assert.equal(
    (
      await asUser(
        restored,
        f.users.receptionA,
        "select id from public.salary_payments",
      )
    ).length,
    0,
  );
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
      "expenses, advances, salaries, sealed cash closure and durable financial retry",
      "restored platform and reception permission denials",
    ],
    production_restore: "NOT_TESTED",
    schemas: ["public", "app_private", "auth", "extensions"],
    extensions: ["btree_gist", "pg_trgm", "pgcrypto"],
    managed_platform_restore:
      "NOT_TESTED: Realtime/Storage infrastructure and publications are provisioned separately, not restored by this application drill.",
    ownership:
      "Original local owners, ACLs and RLS restored using the isolated container's existing supabase_admin role. No production privileges changed; cloud recovery not exercised.",
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
