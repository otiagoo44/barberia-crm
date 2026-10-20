import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fixtures, type FixtureUsers } from "../integration/fixtures";
import { asUser } from "../integration/database";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.LOCAL_DB_URL!).hostname,
  )
)
  throw new Error("Fixtures may only target an isolated localhost Supabase");
const admin = createClient(url, process.env.LOCAL_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = randomBytes(24).toString("base64url");
const users = {} as FixtureUsers;
for (const key of [
  "ownerA",
  "managerA1",
  "receptionA",
  "barberA",
  "ownerB",
  "platform",
] as const) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${key}@fixture.invalid`,
    password,
    email_confirm: true,
    user_metadata: { full_name: key },
  });
  if (error || !data.user)
    throw new Error("Failed isolated Auth fixture setup");
  users[key] = data.user.id;
}
const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
try {
  const f = await fixtures(pool, users);
  const { data: financeAccount, error: financeError } =
    await admin.auth.admin.createUser({
      email: "financeA@fixture.invalid",
      password,
      email_confirm: true,
    });
  if (financeError || !financeAccount.user)
    throw new Error("Failed finance Auth fixture setup");
  await asUser(
    pool,
    users.ownerA,
    "select public.manage_membership($1,'financeA@fixture.invalid','finance',false,$2,true)",
    [f.orgA, [f.branches.a1]],
  );
  await mkdir(".test-data/e2e", { recursive: true });
  await writeFile(
    ".test-data/e2e/fixtures.json",
    JSON.stringify({ ...f, password }),
    { mode: 0o600 },
  );
  console.log(
    "Prepared seven real Supabase Auth users and two isolated tenants.",
  );
} finally {
  await pool.end();
}
