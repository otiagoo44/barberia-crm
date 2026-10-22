// Prepare an atomic, reviewable release for the exact 27-migration cloud ledger.
// This script never connects to a database or runs its output.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await readFile("docs/verification/applied-migrations-27.json", "utf8"),
);
const expected = [];
for (const entry of manifest.files) {
  const contents = (await readFile(entry.path, "utf8")).replaceAll(
    "\r\n",
    "\n",
  );
  if (createHash("sha256").update(contents).digest("hex") !== entry.sha256)
    throw Error("Applied migration changed: " + entry.path);
  expected.push(entry.path.split(/[\\/]/).at(-1).slice(0, 14));
}
const pending = (await readdir("supabase/migrations"))
  .filter((f) => /^\d{14}_/.test(f) && !expected.includes(f.slice(0, 14)))
  .sort();
if (expected.length !== 27 || pending.length !== 7)
  throw Error("Unexpected release inventory");
let query = `do $verified_release$\nbegin\nperform set_config('lock_timeout','5s',true);\nperform pg_advisory_xact_lock(hashtextextended('barberia:pr3:verified-rollout',0));\nif (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from array[${expected.map((v) => `'${v}'`).join(",")}]::text[] then raise exception 'unexpected_cloud_migration_history'; end if;\n`;
const files = [];
for (const [i, file] of pending.entries()) {
  const content = (
    await readFile("supabase/migrations/" + file, "utf8")
  ).replaceAll("\r\n", "\n");
  const delimiter = `$release_payload_${i}$`;
  if (content.includes(delimiter)) throw Error("Unsafe SQL delimiter");
  const version = file.slice(0, 14),
    name = file.slice(15, -4);
  query += `execute ${delimiter}${content}${delimiter};\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${delimiter}${content}${delimiter}]);\n`;
  files.push({
    file,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}
query += "end $verified_release$;\n";
await mkdir(".test-data", { recursive: true });
await writeFile(".test-data/pr3-reviewed-rollout.sql", query, { mode: 0o600 });
await writeFile(
  ".test-data/pr3-rollout-manifest.json",
  JSON.stringify(
    {
      expectedMigrations: expected,
      files,
      sqlSha256: createHash("sha256").update(query).digest("hex"),
      executed: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    prepared: true,
    executed: false,
    migrations: files.length,
    bytes: Buffer.byteLength(query),
  }),
);
