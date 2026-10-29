import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fixtures } from "./fixtures";
import { asUser } from "./database";

export async function googleCalendarContracts(pool: Pool) {
  const f = await fixtures(pool);
  const secret = randomBytes(32).toString("hex");
  await pool.query(
    "insert into app_private.gateway_credentials(name,secret_hash) values('calendar',$1)",
    [createHash("sha256").update(secret).digest("hex")],
  );
  const worker = async (action: string, data: Record<string, unknown> = {}) =>
    (
      await pool.query("select public.calendar_worker($1,$2,$3) result", [
        secret,
        action,
        data,
      ])
    ).rows[0].result;
  const actor = f.users.barberA,
    staff = f.staff.a1;
  const user = async (action: string, data: Record<string, unknown> = {}) =>
    (
      await asUser<{ result: Record<string, unknown> }>(
        pool,
        actor,
        "select public.calendar_user($1,$2,$3) result",
        [f.orgA, action, { staff, ...data }],
      )
    )[0].result;
  await assert.rejects(
    asUser(pool, null, "select public.calendar_user($1,'status','{}')", [
      f.orgA,
    ]),
    { code: "42501" },
  );
  await assert.rejects(
    asUser(
      pool,
      f.users.ownerB,
      "select public.calendar_user($1,'status','{}')",
      [f.orgA],
    ),
    { code: "42501" },
  );
  await assert.rejects(
    asUser(pool, f.users.ownerA, "select public.calendar_user($1,'begin',$2)", [
      f.orgA,
      { staff, state_hash: "0".repeat(64), verifier_cipher: "v".repeat(80) },
    ]),
    { code: "42501" },
  );
  await assert.rejects(
    pool.query("select public.calendar_worker('wrong','claim','{}')"),
    { code: "42501" },
  );
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  const begin = await user("begin", {
    state_hash: hash,
    verifier_cipher: "v".repeat(80),
  });
  await assert.rejects(
    asUser(pool, f.users.ownerA, "select public.calendar_consume($1)", [hash]),
    { code: "42501" },
  );
  const attempt = (
    await asUser<{ result: { exchange_key: string } }>(
      pool,
      actor,
      "select public.calendar_consume($1) result",
      [hash],
    )
  )[0].result;
  await assert.rejects(
    asUser(pool, actor, "select public.calendar_consume($1)", [hash]),
    { code: "42501" },
  );
  await worker("authorize", {
    connection: begin.connection_id,
    exchange_key: attempt.exchange_key,
    refresh_cipher: "v".repeat(80),
    calendar_id: "fixture-calendar",
    google_subject: "fixture-google",
    email: "barber@fixture.invalid",
  });
  // Only ciphertext can leave the database, and only through the worker gate.
  await assert.rejects(
    asUser(pool, actor, "select * from app_private.calendar_connections"),
    { code: "42501" },
  );
  const status = await user("status");
  assert.ok(!JSON.stringify(status).includes("refresh_cipher"));
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(10, 0, 0, 0);
  const created = (
    await asUser<{ result: { id: string } }>(
      pool,
      f.users.ownerA,
      "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null) result",
      [
        f.orgA,
        f.branches.a1,
        [f.services.cut],
        staff,
        tomorrow.toISOString(),
        f.customers.a1,
        randomUUID(),
      ],
    )
  )[0].result;
  let claims = await worker("claim");
  assert.equal(claims.length, 1);
  const identity = {
    connection: claims[0].connection_id,
    appointment: created.id,
    lease: claims[0].lease,
  };
  const snapshot = await worker("snapshot", identity);
  assert.equal(snapshot.remove, false);
  assert.equal(snapshot.appointment, created.id);
  assert.ok(!("customer_name" in snapshot));
  assert.ok(!("normalized_phone" in snapshot));
  assert.deepEqual(await worker("claim"), []);
  await pool.query("update app_private.calendar_jobs set leased_until=now()-interval '1 second' where appointment_id=$1",[created.id]);
  const reclaimed=await worker('claim');
  assert.equal(reclaimed.length,1);
  assert.notEqual(reclaimed[0].lease,identity.lease);
  await assert.rejects(worker('finish',{...identity,revision:snapshot.revision,auth_version:snapshot.auth_version}),{code:'42501'});
  identity.lease=reclaimed[0].lease;
  await assert.rejects(
    worker("finish", {
      ...identity,
      lease: randomUUID(),
      revision: snapshot.revision,
      auth_version: snapshot.auth_version,
    }),
    { code: "42501" },
  );
  // A change during delivery must remain pending after acknowledging the old revision.
  await pool.query(
    "update public.appointments set status='confirmed' where id=$1",
    [created.id],
  );
  await worker("finish", {
    ...identity,
    revision: snapshot.revision,
    auth_version: snapshot.auth_version,
  });
  claims = await worker("claim");
  assert.equal(claims.length, 1);
  const second = { ...identity, lease: claims[0].lease };
  const newer = await worker("snapshot", second);
  assert.ok(newer.revision > snapshot.revision);
  await worker("fail", {
    ...second,
    auth_version: newer.auth_version,
    code: "provider_unavailable",
  });
  const retry = (
    await pool.query(
      "select status,attempts from app_private.calendar_jobs where appointment_id=$1",
      [created.id],
    )
  ).rows[0];
  assert.equal(retry.status, "retry");
  await user("retry");
  claims = await worker("claim");
  assert.equal(claims.length, 1);
  const third = { ...identity, lease: claims[0].lease };
  const current = await worker("snapshot", third);
  await worker("finish", {
    ...third,
    revision: current.revision,
    auth_version: current.auth_version,
  });
  // Reassign to another professional: remove the event from the previous calendar.
  await pool.query("update public.appointments set staff_id=$1 where id=$2", [
    f.staff.a2,
    created.id,
  ]);
  claims = await worker("claim");
  assert.equal(claims.length, 1);
  const moved = { ...identity, lease: claims[0].lease };
  const removal = await worker("snapshot", moved);
  assert.equal(removal.remove, true);
  await worker("finish", {
    ...moved,
    revision: removal.revision,
    auth_version: removal.auth_version,
  });
  await pool.query(
    "update public.appointments set staff_id=$1,status='cancelled' where id=$2",
    [staff, created.id],
  );
  claims = await worker("claim");
  assert.equal(claims.length, 1);
  const cancelled = { ...identity, lease: claims[0].lease };
  const cancelledSnapshot = await worker("snapshot", cancelled);
  assert.equal(cancelledSnapshot.remove, true);
  await worker("fail", {
    ...cancelled,
    auth_version: cancelledSnapshot.auth_version,
    code: "authorization_required",
  });
  assert.deepEqual(await worker("claim"), []);
  assert.equal(
    (
      await pool.query(
        "select status from app_private.calendar_connections where id=$1",
        [begin.connection_id],
      )
    ).rows[0].status,
    "reconnect",
  );
  await user("disconnect");
  assert.equal(
    (
      await pool.query(
        "select refresh_cipher from app_private.calendar_connections where id=$1",
        [begin.connection_id],
      )
    ).rows[0].refresh_cipher,
    null,
  );
  const team = (
    await asUser<{
      result: { people: { password_change_required: boolean }[] };
    }>(pool, f.users.ownerA, "select public.setup_team($1,$2) result", [
      f.orgA,
      f.branches.a1,
    ])
  )[0].result;
  assert.ok(
    team.people.every((p) => typeof p.password_change_required === "boolean"),
  );
  console.log(
    "PASS Calendar SQL: user/tenant isolation, one-use OAuth, private tokens, queue leases, revisions, retries, reassignment, cancellation, revoked consent and setup diagnostics",
  );
}
