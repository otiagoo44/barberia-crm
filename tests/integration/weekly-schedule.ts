import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { asUser } from "./database";
import { fixtures } from "./fixtures";

export async function weeklyScheduleContracts(pool: Pool) {
  const f = await fixtures(pool);
  const from = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const weekday = new Date(from + "T12:00:00Z").getUTCDay();
  const blocks = [
    { weekday, starts_at: "09:00", ends_at: "12:00" },
    { weekday, starts_at: "12:30", ends_at: "19:00" },
  ];
  const versions = async () =>
    (
      await pool.query(
        "select id,updated_at::text updated_at from public.staff_availability_rules where organization_id=$1 and branch_id=$2 and staff_id=$3 and weekday=$4 order by id",
        [f.orgA, f.branches.a1, f.staff.a1, weekday],
      )
    ).rows;
  const save = async (
    expected: unknown,
    input = blocks,
    key = randomUUID(),
    user = f.users.ownerA,
  ) =>
    asUser(
      pool,
      user,
      "select public.save_weekly_schedule($1,$2,$3,$4,$5,$6,$7,$8) result",
      [
        f.orgA,
        f.branches.a1,
        f.staff.a1,
        from,
        [weekday],
        JSON.stringify(input),
        JSON.stringify(expected),
        key,
      ],
    );
  const initial = await versions();
  const key = randomUUID();
  const result = await save(initial, blocks, key);
  const diagnostic = await asUser<{
    r: { people: { staff_id: string; state: string }[] };
  }>(pool, f.users.ownerA, "select public.setup_availability($1,$2,$3) r", [
    f.orgA,
    f.branches.a1,
    from,
  ]);
  assert.equal(
    diagnostic[0].r.people.find((p) => p.staff_id === f.staff.a1)?.state,
    "available",
  );
  assert.deepEqual(await save(initial, blocks, key), result);
  assert.equal((await versions()).length, 3); // one historic + two current segments
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from public.staff_availability_rules where staff_id=$1 and valid_until=$2::date-1",
        [f.staff.a1, from],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(save(initial), /stale_weekly_schedule/);
  await assert.rejects(
    save(await versions(), blocks, randomUUID(), f.users.ownerB),
    { code: "42501" },
  );
  await assert.rejects(
    save(await versions(), [
      { weekday, starts_at: "09:00", ends_at: "13:00" },
      { weekday, starts_at: "12:00", ends_at: "19:00" },
    ]),
    /invalid_weekly_blocks/,
  );
  const state = await versions();
  const concurrent = await Promise.allSettled([
    save(state, [{ weekday, starts_at: "10:00", ends_at: "18:00" }]),
    save(state, [{ weekday, starts_at: "11:00", ends_at: "18:00" }]),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((r) => r.status === "rejected").length, 1);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from public.staff_availability_exceptions where organization_id=$1",
        [f.orgA],
      )
    ).rows[0].n,
    0,
  );
  const team = await asUser<{
    result: { people: { verified_factors: number }[] };
  }>(pool, f.users.ownerA, "select public.setup_team($1,$2) result", [
    f.orgA,
    f.branches.a1,
  ]);
  assert.ok(team[0].result.people.length > 0);
  assert.equal(team[0].result.people[0].verified_factors, 0);
  await assert.rejects(
    asUser(pool, f.users.ownerB, "select public.setup_team($1,$2)", [
      f.orgA,
      f.branches.a1,
    ]),
    { code: "42501" },
  );
  // A booked future visit makes an incompatible reduction roll back completely.
  await asUser(
    pool,
    f.users.ownerA,
    "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null)",
    [
      f.orgA,
      f.branches.a1,
      [f.services.cut],
      f.staff.a1,
      from + "T12:30:00Z",
      f.customers.a1,
      randomUUID(),
    ],
  );
  const before = await versions();
  await assert.rejects(
    save(before, [{ weekday, starts_at: "15:00", ends_at: "18:00" }]),
    /schedule_conflicts_with_bookings/,
  );
  assert.deepEqual(await versions(), before);
  // Real service lines, explicit provider total estimates in isolated PYG fixtures.
  // No item/product is invented to charge a haircut; no card surcharge is added.
  await pool.query(
    "update public.organizations set currency='PYG' where id=$1",
    [f.orgA],
  );
  const price = (
    await pool.query(
      "select id from public.branch_services where organization_id=$1 and branch_id=$2 and service_id=$3",
      [f.orgA, f.branches.a1, f.services.cut],
    )
  ).rows[0].id;
  await asUser(
    pool,
    f.users.ownerA,
    "select public.manage_record($1,'branch_services',$2,$3,'{\"price_minor\":30000}')",
    [f.orgA, price, f.branches.a1],
  );
  const command = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), randomUUID()],
      )
    )[0].r.id;
  for (const [code, bps, fee] of [
    ["debit", 220, 660],
    ["credit", 520, 1560],
  ] as const) {
    const method = await command("configure", {
      entity: "payment_methods",
      code,
      name: code,
      type: "card",
    });
    let sale = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    const payment = { payment_method_id: method, amount_minor: 30000 };
    await command("post_checkout", { id: sale, payments: [payment] });
    const pending = (
      await pool.query(
        "select fee_minor,fee_status from public.payments where checkout_id=$1",
        [sale],
      )
    ).rows[0];
    assert.equal(pending.fee_minor, null);
    assert.equal(pending.fee_status, "unknown");
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: method,
      percentage_bps: bps,
      fixed_amount_minor: 0,
      evidence_reference:
        "Synthetic total deduction test; components are not actual UPay terms",
    });
    sale = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    await command("post_checkout", { id: sale, payments: [payment] });
    const paid = (
      await pool.query(
        "select c.total_minor,p.amount_minor,p.fee_minor from public.checkouts c join public.payments p on p.checkout_id=c.id where c.id=$1",
        [sale],
      )
    ).rows[0];
    assert.equal(Number(paid.total_minor), 30000);
    assert.equal(Number(paid.amount_minor), 30000);
    assert.equal(Number(paid.fee_minor), fee);
    assert.equal(
      Number(paid.amount_minor) - Number(paid.fee_minor),
      code === "debit" ? 29340 : 28440,
    );
  }
  await pool.query(
    "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
    [f.orgA, f.users.ownerA],
  );
  await assert.rejects(save(initial, blocks, key), { code: "42501" }); // revoked actor cannot replay
  console.log(
    "PASS Weekly schedule: atomic intervals, preserved history, break, idempotency, stale edit, concurrent save, live revocation, tenant isolation, booking rollback and private team diagnostics",
  );
}
