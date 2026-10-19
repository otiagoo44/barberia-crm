import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Produces reviewable SQL; never connects or executes against any database.
const migrations = [
  ["20261019154027", "database_scheduler"],
  ["20261019213732", "profit_sharing"],
  ["20261019220146", "enable_database_cron"],
];
let sql =
  "begin;\nselect pg_advisory_xact_lock(hashtextextended('barberia:release:20261019',0));\n";
for (const [version, name] of migrations) {
  const contents = await readFile(
    new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url),
    "utf8",
  );
  if (contents.includes("$migration_payload$"))
    throw new Error("Unsafe migration delimiter");
  sql += `do $apply$\ndeclare migration_sql text := $migration_payload$${contents}$migration_payload$;\nbegin\nif not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then\nexecute migration_sql;\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[migration_sql]);\nend if;\nend $apply$;\n`;
}
sql += "commit;\n";
sql += await readFile(
  new URL("./configure-1717-operations.sql", import.meta.url),
  "utf8",
);
sql += await readFile(
  new URL("./enable-scheduler.sql", import.meta.url),
  "utf8",
);
sql +=
  "\nselect jsonb_build_object('scheduler',app_private.run_scheduled_jobs(),'migrations',(select count(*) from supabase_migrations.schema_migrations),'unprotected_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'remuneration',(select remuneration_model from public.finance_settings s join public.organizations o on o.id=s.organization_id where o.slug='1717-barberia')) as release_verification;\n";
const destination = resolve(".test-data/production-rollout.sql");
await mkdir(resolve(".test-data"), { recursive: true });
await writeFile(destination, sql, { mode: 0o600 });
console.log(`Reviewable release SQL prepared at ${destination}; not executed.`);
