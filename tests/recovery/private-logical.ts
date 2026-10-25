import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const db = await isolatedDatabase(34);
try {
  const f = await fixtures(db.pool);
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
  const result = {
    checked_at: new Date().toISOString(),
    scope: "ISOLATED FIXTURES ONLY; not a copy of production",
    encryption_roundtrip: true,
    wrong_password_rejected: true,
    tampering_rejected: true,
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
