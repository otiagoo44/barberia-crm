// Explicitly disposable, synthetic fixtures for the separately authorized Free project.
// This runner has no production target, credential or restore path.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { fixtures, type FixtureUsers } from "../tests/integration/fixtures";
import { totp } from "../tests/e2e/mfa-helper";

const project = "zdogqqmitpbwjgohwcww";
const production = "tbcfhagteyqufjkmbxzz";
assert.notEqual(project, production);
const url = `https://${project}.supabase.co`;
const root = path.resolve(".test-data/staging-activation");
const evidence = path.resolve("docs/verification/activation-20261026");
await mkdir(root, { recursive: true });
await mkdir(evidence, { recursive: true });
const cliPath = path.resolve("node_modules/supabase/dist/supabase.js");
function cli(...args: string[]) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    timeout: 180000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const file = path.join(root, "query.sql");
  await writeFile(file, query, { mode: 0o600 });
  const result = JSON.parse(
    cli(
      "db",
      "query",
      "--linked",
      "--project-ref",
      project,
      "--file",
      file,
      "--output",
      "json",
    ),
  );
  assert.ok(Array.isArray(result.rows), "CLI must return a rows array");
  return result.rows as T[];
}
function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value));
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  return (
    "'" +
    (typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
    ).replaceAll("'", "''") +
    "'"
  );
}
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
async function snapshot(
  tables?: { schema: string; table: string; columns: string[] }[],
) {
  tables ??= await sql<{ schema: string; table: string; columns: string[] }>(`
    select table_schema schema,table_name "table",array_agg(column_name::text order by ordinal_position) columns
    from information_schema.columns where table_schema in ('public','auth')
    and table_name in(select tablename from pg_tables where schemaname in ('public','auth'))
    group by table_schema,table_name order by table_schema,table_name`);
  const rows = await sql(
    tables
      .map(
        (
          t,
        ) => `select ${literal(t.schema + "." + t.table)} name,count(*)::int count,
    md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C")::text,'[]')) fingerprint
    from(select ${t.columns.map(quote).join(",")} from ${quote(t.schema)}.${quote(t.table)})r`,
      )
      .join(" union all ") + " order by name",
  );
  return { tables, rows };
}
async function keys() {
  const values = JSON.parse(
    cli(
      "projects",
      "api-keys",
      "--project-ref",
      project,
      "--reveal",
      "--output",
      "json",
    ),
  );
  const publishable = values.find(
    (k: { type: string }) => k.type === "publishable",
  )?.api_key;
  const secret = values.find(
    (k: { type: string }) => k.type === "secret",
  )?.api_key;
  assert.ok(publishable?.startsWith("sb_publishable_"));
  assert.ok(secret?.startsWith("sb_secret_"));
  return { publishable, secret };
}
const action = process.argv[2];
if (action === "seed34") {
  assert.equal(
    (
      await sql<{ n: number }>(
        "select count(*)::int n from supabase_migrations.schema_migrations",
      )
    )[0].n,
    34,
  );
  assert.equal(
    (
      await sql<{ n: number }>(
        "select count(*)::int n from public.organizations",
      )
    )[0].n,
    0,
    "Staging must be empty before its single fixture import",
  );
  const { publishable, secret } = await keys();
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = randomBytes(32).toString("base64url");
  const users = {} as FixtureUsers;
  const emails: Record<string, string> = {};
  await writeFile(
    path.join(root, "pending-auth.json"),
    JSON.stringify({ password }),
    { mode: 0o600, flag: "wx" },
  );
  for (const role of [
    "ownerA",
    "managerA1",
    "receptionA",
    "barberA",
    "ownerB",
    "platform",
    "financeA",
  ] as const) {
    const email = `activation1717-${role.toLowerCase()}@fixture.invalid`;
    // Confirmed synthetic fixtures only; never real people or owner addresses.
    assert.ok(email.endsWith("@fixture.invalid"));
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `Synthetic QA ${role}`,
        staging_fixture: true,
      },
    });
    assert.ok(
      !created.error && created.data.user,
      "Synthetic staging Auth creation failed",
    );
    if (role !== "financeA") users[role] = created.data.user.id;
    emails[role] = email;
  }
  const statements: string[] = [];
  const recorder = {
    query: async (query: string, params: unknown[] = []) => {
      // All browser identities must use GoTrue sessions. No platform admin fixture here.
      if (
        query.startsWith("insert into auth.sessions") ||
        query.startsWith("insert into app_private.platform_admins")
      )
        return { rows: [] };
      statements.push(
        query.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1])) +
          ";",
      );
      return { rows: [] };
    },
  } as unknown as Pool;
  const f = await fixtures(recorder, users, "staging1717");
  await writeFile(
    path.join(root, "fixtures.json"),
    JSON.stringify({ ...f, password, emails, publishable }),
    { mode: 0o600 },
  );
  const gateway = JSON.parse(
    await readFile(path.join(root, "secrets.json"), "utf8"),
  );
  statements.push(
    `update public.organizations set name='Synthetic QA staging 17:17',currency='PYG' where id=${literal(f.orgA)};`,
  );
  for (const [name, key] of [
    ["booking", "BOOKING_GATEWAY_SECRET"],
    ["worker", "WORKER_SECRET"],
  ])
    statements.push(
      `update app_private.gateway_credentials set secret_hash=${literal(createHash("sha256").update(gateway[key]).digest("hex"))} where name=${literal(name)};`,
    );
  await sql(
    "begin;\n" +
      statements.join("\n") +
      "\ncommit; select cron.unschedule('barberia-internal-worker') as staging_scheduler_disabled;",
  );
  console.log(
    "Synthetic staging Auth and business fixtures prepared at schema 34.",
  );
} else if (action === "ledger34") {
  const f = JSON.parse(
    await readFile(path.join(root, "fixtures.json"), "utf8"),
  );
  const { publishable, password, emails } = f;
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.equal(
    (await client.auth.signInWithPassword({ email: emails.ownerA, password }))
      .error,
    null,
  );
  const enrolled = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Synthetic QA staging " + randomUUID().slice(0, 8),
  });
  assert.ok(!enrolled.error && enrolled.data.type === "totp");
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  assert.equal(verified.error, null);
  const mfa = {
    ownerA: { factor: enrolled.data.id, secret: enrolled.data.totp.secret },
  };
  await writeFile(
    path.join(root, "fixtures.json"),
    JSON.stringify({ ...f, password, emails, mfa, publishable }),
    { mode: 0o600 },
  );
  const command = async (p_action: string, p_data: object) => {
    const response = await client.rpc("finance_command", {
      p_org: f.orgA,
      p_branch: f.branches.a1,
      p_action,
      p_data,
      p_key: randomUUID(),
    });
    assert.equal(response.error, null, "Staging financial RPC failed");
    return response.data.id as string;
  };
  // Real signed MFA session and actual RPCs create a small synthetic pre-upgrade ledger.
  const cash = await command("configure", {
    entity: "payment_methods",
    name: "Synthetic cash QA",
    code: "qa_cash",
    type: "cash",
  });
  await command("configure", {
    entity: "payment_method_fee_rules",
    payment_method_id: cash,
    percentage_bps: 0,
    fixed_amount_minor: 0,
  });
  const item = await command("configure", {
    entity: "finance_items",
    name: "Synthetic upgrade item QA",
    kind: "product",
    price_minor: 10000,
  });
  const session = await command("open_cash_session", {
    opening_amount_minor: 1000,
  });
  const checkout = await command("create_checkout", {
    lines: [{ item_id: item, quantity: 1 }],
  });
  await command("post_checkout", {
    id: checkout,
    payments: [
      {
        payment_method_id: cash,
        amount_minor: 10000,
        cash_session_id: session,
      },
    ],
  });
  const category = await command("configure", {
    entity: "expense_categories",
    name: "Synthetic expense QA",
    code: "qa_expense",
    kind: "operating",
  });
  await command("create_expense", {
    category_id: category,
    payment_method_id: cash,
    cash_session_id: session,
    amount_minor: 100,
    description: "Synthetic upgrade expense QA",
  });
  await command("close_cash_session", {
    id: session,
    actual_cash_minor: 10900,
  });
  await client.auth.signOut();
  await writeFile(
    path.join(root, "fixtures.json"),
    JSON.stringify({ ...f, mfa }),
    { mode: 0o600 },
  );
  await writeFile(
    path.join(root, "before-upgrade.json"),
    JSON.stringify(await snapshot()),
    { mode: 0o600 },
  );
  console.log(
    "Staging 34: synthetic Auth/MFA, two isolated tenants and financial ledger prepared; no production data.",
  );
} else if (action === "upgrade") {
  const before = JSON.parse(
    await readFile(path.join(root, "before-upgrade.json"), "utf8"),
  );
  cli("migration", "up", "--linked", "--project-ref", project, "--yes");
  const after = await snapshot(before.tables);
  assert.deepEqual(
    after.rows,
    before.rows,
    "Existing staging data changed during upgrade",
  );
  const migrations = await sql(
    "select version,name from supabase_migrations.schema_migrations order by version",
  );
  assert.equal(migrations.length, 41);
  const security = await sql(`select
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) unprotected,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef) public_definers,
    (select count(*)::int from pg_policies where schemaname='public') policies,
    position(U&'barber\\00c3\\00ada' in pg_get_functiondef('app_private.process_job_core(uuid,uuid)'::regprocedure))=0 scheduler_encoding_ok`);
  assert.equal(security[0].unprotected, 0);
  assert.equal(security[0].public_definers, 0);
  assert.equal(security[0].scheduler_encoding_ok, true);
  await writeFile(
    path.join(evidence, "staging-upgrade.json"),
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        project,
        production_project: production,
        synthetic_only: true,
        clean_install_to: 34,
        upgrade_from: 34,
        upgrade_to: 41,
        original_tables_verified: before.tables.length,
        original_content_unchanged: true,
        genuine_auth_mfa_finance_rpc: true,
        migrations,
        security,
        status: "PASSED",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASSED: staging clean install 0→34 and data-preserving upgrade 34→41.",
  );
} else
  throw new Error(
    "Use seed34, ledger34 or upgrade; production is never accepted",
  );
