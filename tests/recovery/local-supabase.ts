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
    "select (select count(*)::int from public.organizations) organizations,(select count(*)::int from public.customers) customers,(select count(*)::int from public.staff) staff,(select count(*)::int from auth.users) auth_users,(select count(*)::int from public.audit_logs) audit_logs";
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
      "select count(*)::int total,count(*) filter(where relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    )
  ).rows[0];
  assert.equal(rls.total, rls.protected);
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
    ],
    production_restore: "NOT_TESTED",
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
