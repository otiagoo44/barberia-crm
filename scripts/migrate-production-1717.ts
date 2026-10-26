// Authorized 34→41 upgrade only. No fixture, seed, reset, auth claim or business write.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";

const project = "tbcfhagteyqufjkmbxzz";
const staging = "zdogqqmitpbwjgohwcww";
const privateRoot = path.resolve(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/private-backups",
  project,
);
const workdir = path.join(privateRoot, "migration-20261026");
const evidence = path.resolve("docs/verification/activation-20261026");
await mkdir(path.join(workdir, "supabase/migrations"), { recursive: true });
await mkdir(evidence, { recursive: true });
const cliPath = path.resolve("node_modules/supabase/dist/supabase.js");
function cli(...args: string[]) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    timeout: 180000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const file = path.join(workdir, "read-only-query.sql");
  await writeFile(file, "begin read only;\n" + sql + ";\ncommit;", {
    mode: 0o600,
  });
  return JSON.parse(
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
  ).rows as T[];
}
const receipts = [];
for (const file of await readdir(privateRoot)) {
  if (!file.endsWith(".bkos.receipt.json")) continue;
  receipts.push(
    JSON.parse(await readFile(path.join(privateRoot, file), "utf8")),
  );
}
const backup = receipts
  .filter(
    (r) =>
      r.project === project &&
      r.restore?.status === "PASSED" &&
      r.restore?.isolated_upgrade?.status === "PASSED",
  )
  .sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0];
assert.ok(
  backup &&
    backup.restore.tables_verified >= 100 &&
    backup.restore.auth_tables_verified >= 20,
  "Real recovered production snapshot required",
);
assert.equal(backup.restore.isolated_upgrade.from, 34);
assert.equal(backup.restore.isolated_upgrade.to, 41);
const stage = JSON.parse(
  await readFile(path.join(evidence, "staging-upgrade.json"), "utf8"),
);
assert.equal(stage.project, staging);
assert.equal(stage.status, "PASSED");
assert.equal(stage.original_content_unchanged, true);
const identity = (
  await query<{ id: string; branch: string }>(
    "select o.id,b.id branch from public.organizations o join public.branches b on b.organization_id=o.id where o.slug='1717-barberia' and b.slug='luque'",
  )
)[0];
assert.equal(identity.id, "db03ca0c-48cc-46d2-bcbe-86c6ba8525d4");
assert.equal(identity.branch, "1c10857c-c9da-442a-a1cb-46edd114832d");
const history = await query<{ version: string; name: string }>(
  "select version,name from supabase_migrations.schema_migrations order by version",
);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
assert.equal(files.length, 41);
assert.equal(
  history.length,
  34,
  "Reinspect instead of rerunning an already applied production upgrade",
);
assert.deepEqual(
  history.map((m) => m.version),
  files.slice(0, 34).map((f) => f.split("_")[0]),
);
type Table = { schema: string; table: string; columns: string[] };
const tables =
  await query<Table>(`select table_schema schema,table_name "table",array_agg(column_name::text order by ordinal_position) columns
from information_schema.columns where table_schema in ('public','auth') and table_name in(select tablename from pg_tables where schemaname in ('public','auth'))
group by table_schema,table_name order by table_schema,table_name`);
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const fingerprintSql =
  tables
    .map(
      (t) =>
        `select '${t.schema}.${t.table}' name,count(*)::int count,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C")::text,'[]')) fingerprint from(select ${t.columns.map(quote).join(",")} from ${quote(t.schema)}.${quote(t.table)})r`,
    )
    .join(" union all ") + " order by name";
const before = await query(fingerprintSql);
await writeFile(
  path.join(workdir, "before.json"),
  JSON.stringify({
    checked_at: new Date().toISOString(),
    tables,
    rows: before,
    history,
  }),
  { mode: 0o600 },
);
await copyFile(
  "supabase/config.toml",
  path.join(workdir, "supabase/config.toml"),
);
for (const file of files.slice(0, 34))
  await copyFile(
    path.join("supabase/migrations", file),
    path.join(workdir, "supabase/migrations", file),
  );
const applied = [];
for (let index = 34; index < 41; index++) {
  const file = files[index];
  await copyFile(
    path.join("supabase/migrations", file),
    path.join(workdir, "supabase/migrations", file),
  );
  // migration up does not synchronize config or Vault. Stop on any exception.
  cli(
    "migration",
    "up",
    "--linked",
    "--project-ref",
    project,
    "--workdir",
    workdir,
    "--yes",
  );
  const current = await query<{ version: string; name: string }>(
    "select version,name from supabase_migrations.schema_migrations order by version",
  );
  assert.equal(current.length, index + 1);
  assert.equal(current.at(-1)!.version, file.split("_")[0]);
  applied.push(file);
  await writeFile(
    path.join(evidence, "production-migrations.json"),
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        project,
        before: 34,
        after: current.length,
        applied,
        backup_verified_at: backup.checked_at,
        status: index === 40 ? "APPLIED_VERIFYING" : "IN_PROGRESS",
      },
      null,
      2,
    ),
  );
  console.log(`Verified production migration ${index + 1}/41: ${file}`);
}
const after = await query(fingerprintSql);
await writeFile(path.join(workdir, "after.json"), JSON.stringify(after), {
  mode: 0o600,
});
assert.deepEqual(
  after,
  before,
  "Existing production rows changed during upgrade; stop dependent configuration",
);
const checks = (
  await query(`select
(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) unprotected_tables,
(select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef) public_definers,
(select count(*)::int from pg_policies where schemaname='public') policies,
to_regprocedure('public.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid)') is not null weekly_rpc,
position(U&'barber\\00c3\\00ada' in pg_get_functiondef('app_private.process_job_core(uuid,uuid)'::regprocedure))=0 scheduler_encoding_ok`)
)[0];
assert.equal(checks.unprotected_tables, 0);
assert.equal(checks.public_definers, 0);
assert.equal(checks.weekly_rpc, true);
assert.equal(checks.scheduler_encoding_ok, true);
await writeFile(
  path.join(evidence, "production-migrations.json"),
  JSON.stringify(
    {
      checked_at: new Date().toISOString(),
      project,
      before: 34,
      after: 41,
      applied,
      backup_verified_at: backup.checked_at,
      original_tables_verified: tables.length,
      original_content_unchanged: true,
      checks,
      status: "PASSED",
    },
    null,
    2,
  ),
);
console.log(
  "PASSED: production 34→41; original business/Auth rows preserved, RLS and scheduler checked.",
);
