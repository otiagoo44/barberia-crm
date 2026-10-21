import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { migrationUpgradeContracts } from "../integration/migration-upgrade";
import type { FixtureUsers } from "../integration/fixtures";

for (const value of [
  process.env.LOCAL_DB_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
])
  if (
    process.env.E2E_REAL_SUPABASE !== "1" ||
    !value ||
    !["127.0.0.1", "localhost"].includes(new URL(value).hostname)
  )
    throw new Error("Upgrade/reset drill requires isolated localhost Supabase");
const cli = path.resolve("node_modules/supabase/dist/supabase.js");
function supabase(...args: string[]) {
  execFileSync(process.execPath, [cli, ...args], { stdio: "inherit" });
}
// The CI already installed all migrations from zero. Now preserve an actual
// 27-migration Supabase ledger across migration up, then reset only this local
// disposable instance for the independent real-Auth/browser suites.
supabase("db", "reset", "--local", "--no-seed", "--version", "20261019223415");
const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
try {
  await pool.query("update cron.job set active=false");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.LOCAL_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const users = {} as FixtureUsers;
  const prefix = randomUUID();
  for (const key of [
    "ownerA",
    "managerA1",
    "receptionA",
    "barberA",
    "ownerB",
    "platform",
  ] as const) {
    const created = await admin.auth.admin.createUser({
      email: `upgrade-${prefix}-${key}@fixture.invalid`,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw new Error("Isolated upgrade Auth identity creation failed");
    users[key] = created.data.user.id;
  }
  await migrationUpgradeContracts({
    pool,
    users,
    migrate: async () => {
      supabase("migration", "up", "--local");
    },
  });
} finally {
  await pool.end();
}
supabase("db", "reset", "--local", "--no-seed");
