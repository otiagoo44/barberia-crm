import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isolatedDatabase, asUser } from "../integration/database";
import { fixtures } from "../integration/fixtures";
import {
  decryptBackup,
  encryptBackup,
  exportSnapshot,
  restoreIsolated,
} from "../../scripts/private-database-backup";

assert.equal(
  process.platform,
  "win32",
  "This private backup entry point uses the verified Windows PostgreSQL tools",
);
process.env.TASK_BACKUP_FIXTURE_DIAGNOSTICS = "1";
const root = path.resolve(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/private-backups/local-drill",
);
const pgBin = path.resolve(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/tools/postgresql-17.11/pgsql/bin",
);
await mkdir(root, { recursive: true });
const db = await isolatedDatabase(34, ["--encoding=UTF8", "--locale=C"]);
try {
  await db.pool.query(
    "create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])",
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .slice(0, 34))
    await db.pool.query(
      "insert into supabase_migrations.schema_migrations values($1,$2,$3)",
      [
        file.slice(0, 14),
        file.slice(15, -4),
        [await readFile(path.join("supabase/migrations", file), "utf8")],
      ],
    );
  const f = await fixtures(db.pool);
  await db.pool.query(
    "create sequence public.backup_drill_sequence start 7;select nextval('public.backup_drill_sequence')",
  );
  await db.pool.query(
    "create table public.backup_drill_unicode(value text,at timestamptz default now());alter table public.backup_drill_unicode enable row level security;insert into public.backup_drill_unicode(value) values('Barbería, atención, ñ'),('Unicode ✂️ 💈')",
  );
  const command = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        db.pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [
          f.orgA,
          f.branches.a1,
          action,
          JSON.stringify(data),
          crypto.randomUUID(),
        ],
      )
    )[0].r.id;
  const method = await command("configure", {
    entity: "payment_methods",
    name: "Backup transfer",
    code: "backup_transfer",
    type: "bank",
  });
  await command("configure", {
    entity: "payment_method_fee_rules",
    payment_method_id: method,
    percentage_bps: 0,
    fixed_amount_minor: 0,
  });
  const sale = await command("create_checkout", {
    lines: [{ service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 }],
  });
  await command("post_checkout", {
    id: sale,
    payments: [{ payment_method_id: method, amount_minor: 2000 }],
  });
  const source = await db.pool.connect();
  const config = db.pool.options;
  const bundle = await exportSnapshot(source, pgBin, {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: String(config.port),
    PGUSER: "postgres",
    PGPASSWORD: String(config.password),
    PGDATABASE: "postgres",
    PGSSLMODE: "disable",
  });
  source.release();
  const passphrase = randomBytes(32).toString("hex");
  const encrypted = encryptBackup(bundle, passphrase);
  const file = path.join(root, "fixture.bkos");
  await writeFile(file, encrypted, { mode: 0o600 });
  assert.deepEqual(decryptBackup(await readFile(file), passphrase), bundle);
  assert.throws(() =>
    decryptBackup(encrypted, randomBytes(32).toString("hex")),
  );
  const corrupt = JSON.parse(encrypted.toString("utf8"));
  const bytes = Buffer.from(corrupt.data, "base64");
  bytes[0] ^= 1;
  corrupt.data = bytes.toString("base64");
  assert.throws(() =>
    decryptBackup(Buffer.from(JSON.stringify(corrupt)), passphrase),
  );
  const restored = await restoreIsolated(
    decryptBackup(await readFile(file), passphrase),
    pgBin,
    root,
  );
  const legacy = JSON.parse(bundle.toString("utf8"));
  delete legacy.content_hash_order;
  for (const table of legacy.state.tables)
    table.content_hash = "legacy_database_collation_dependent";
  const legacyRestored = await restoreIsolated(
    Buffer.from(JSON.stringify(legacy)),
    pgBin,
    root,
  );
  assert.equal(legacyRestored.portable_source_checksums, false);
  assert.equal(legacyRestored.row_content_verified_against_archive, true);
  assert.equal(legacyRestored.isolated_upgrade.status, "PASSED");
  legacy.state.tables[0].rows = "999999";
  await assert.rejects(
    () => restoreIsolated(Buffer.from(JSON.stringify(legacy)), pgBin, root),
    { code: "RESTORE_STATE_MISMATCH" },
  );
  const result = {
    checked_at: new Date().toISOString(),
    scope: "ISOLATED FIXTURES ONLY; not a copy of production",
    encryption_roundtrip: true,
    wrong_password_rejected: true,
    tampering_rejected: true,
    legacy_collation_copy_verified: true,
    mismatched_restore_rejected: true,
    ...restored,
  };
  await writeFile(
    "docs/verification/activation-20261025/private-backup-local.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await db.stop();
}
