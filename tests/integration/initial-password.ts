import assert from "node:assert/strict";
import type { Pool } from "pg";
import { fixtures } from "./fixtures";
import { asUser } from "./database";
export async function initialPasswordContracts(pool: Pool) {
  const f = await fixtures(pool, undefined, "initial-password");
  await pool.query(
    "insert into app_private.required_password_changes(profile_id) values($1)",
    [f.users.ownerA],
  );
  const security = async () =>
    (
      await asUser<{
        s: {
          allowed: boolean;
          required: boolean;
          password_change_required: boolean;
        };
      }>(pool, f.users.ownerA, "select public.security_context() s")
    )[0].s;
  assert.deepEqual(await security(), {
    required: true,
    level: "aal2",
    allowed: false,
    password_change_required: true,
  });
  assert.equal(
    (await asUser(pool, f.users.ownerA, "select id from public.customers"))
      .length,
    0,
  );
  await assert.rejects(
    asUser(
      pool,
      f.users.ownerA,
      "select public.finance_command($1,$2,'open_cash_session','{\"opening_amount_minor\":0}',gen_random_uuid())",
      [f.orgA, f.branches.a1],
    ),
    { code: "42501" },
  );
  await assert.rejects(
    asUser(
      pool,
      f.users.ownerA,
      "select * from app_private.required_password_changes",
    ),
    { code: "42501" },
  );
  await pool.query(
    "update auth.users set raw_user_meta_data='{\"password_change_required\":false}',email_confirmed_at=now() where id=$1",
    [f.users.ownerA],
  );
  assert.equal((await security()).password_change_required, true);
  await pool.query(
    "update auth.users set encrypted_password=encrypted_password where id=$1",
    [f.users.ownerA],
  );
  assert.equal((await security()).password_change_required, true);
  assert.equal(
    (
      await asUser<{ s: { allowed: boolean } }>(
        pool,
        f.users.ownerB,
        "select public.security_context() s",
      )
    )[0].s.allowed,
    true,
  );
  await pool.query(
    "update auth.users set encrypted_password='synthetic-replacement-hash' where id=$1",
    [f.users.ownerA],
  );
  assert.equal((await security()).password_change_required, false);
  assert.equal((await security()).allowed, true);
  const state = (
    await pool.query(
      "select completed_at is not null completed from app_private.required_password_changes where profile_id=$1",
      [f.users.ownerA],
    )
  ).rows[0];
  assert.equal(state.completed, true);
  assert.equal(
    (await asUser(pool, f.users.ownerA, "select id from public.customers"))
      .length,
    2,
  );
  console.log(
    "PASS Initial password: private gate blocks business RLS/RPC even at AAL2; confirmation, metadata and same hash do not clear it; actual password update clears it; other accounts unaffected",
  );
}
