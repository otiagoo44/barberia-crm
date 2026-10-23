import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { asUser } from "./database";
import { onboardingSql } from "../../scripts/onboard-1717.mjs";
import { confirmed1717Sql } from "../../scripts/configure-confirmed-1717.mjs";
import { pos1717Sql } from "../../scripts/prepare-1717-pos.mjs";

export async function confirmed1717Contracts(pool: Pool) {
  // SQL fixtures only. No real email, account, sale or payment is created in cloud.
  await pool.query(
    "alter table auth.users add column if not exists email_confirmed_at timestamptz",
  );
  const owner = randomUUID(),
    secondOwner = randomUUID(),
    outsider = randomUUID(),
    receptionist = randomUUID();
  for (const [id, name] of [
    [owner, "confirmed-owner"],
    [secondOwner, "confirmed-second"],
    [outsider, "confirmed-outsider"],
    [receptionist, "confirmed-reception"],
  ]) {
    await pool.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, `${name}@fixture.invalid`],
    );
  }
  await pool.query(await onboardingSql("confirmed-owner@fixture.invalid"));
  const {
    rows: [identity],
  } = await pool.query(`select o.id org,b.id branch,
    (select id from public.staff where organization_id=o.id and slug='esteban') esteban,
    (select id from public.staff where organization_id=o.id and slug='jonatan') jonatan,
    (now() at time zone 'America/Asuncion')::date::text today
    from public.organizations o join public.branches b on b.organization_id=o.id where o.slug='1717-barberia'`);
  const { org, branch, esteban, jonatan, today } = identity;
  await asUser(
    pool,
    owner,
    "select public.manage_membership($1,'confirmed-second@fixture.invalid','organization_owner',true,'{}',true)",
    [org],
  );
  await asUser(
    pool,
    owner,
    "select public.manage_membership($1,'confirmed-reception@fixture.invalid','receptionist',true,'{}',true)",
    [org],
  );
  for (const [staff, profile] of [
    [esteban, owner],
    [jonatan, secondOwner],
  ]) {
    await asUser(
      pool,
      owner,
      "select public.manage_record($1,'staff',$2,null,jsonb_build_object('profile_id',$3::uuid))",
      [org, staff, profile],
    );
  }
  assert.equal(
    (
      await asUser<{ role: string }>(
        pool,
        secondOwner,
        "select role from public.organization_memberships where organization_id=$1 and profile_id=$2",
        [org, secondOwner],
      )
    )[0].role,
    "organization_owner",
  );
  for (const profile of [outsider, receptionist]) {
    await assert.rejects(
      asUser(
        pool,
        owner,
        "select public.manage_record($1,'staff',$2,null,jsonb_build_object('profile_id',$3::uuid))",
        [org, esteban, profile],
      ),
      { code: "23514" },
    );
  }
  await assert.rejects(
    asUser(
      pool,
      outsider,
      "select public.manage_record($1,'staff',$2,null,jsonb_build_object('profile_id',$3::uuid))",
      [org, esteban, outsider],
    ),
    { code: "42501" },
  );
  await pool.query(
    "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
    [org, secondOwner],
  );
  await assert.rejects(
    asUser(
      pool,
      owner,
      "select public.manage_record($1,'staff',$2,null,jsonb_build_object('profile_id',$3::uuid))",
      [org, jonatan, secondOwner],
    ),
    { code: "23514" },
  );
  await pool.query(
    "update public.organization_memberships set active=true where organization_id=$1 and profile_id=$2",
    [org, secondOwner],
  );
  const sql = await confirmed1717Sql({
    projectRef: "tbcfhagteyqufjkmbxzz",
    organizationId: org,
    branchId: branch,
    estebanId: esteban,
    jonatanId: jonatan,
    effectiveDate: today,
  });
  const {
    rows: [historicalRule],
  } = await pool.query(
    "insert into public.staff_availability_rules(organization_id,branch_id,staff_id,weekday,starts_at,ends_at,valid_from) values($1,$2,$3,1,'13:00','20:00',$4::date-7) returning id",
    [org, branch, jonatan, today],
  );
  const client = await pool.connect();
  // Only this isolated test manufactures fixture claims. The operator generator
  // requires an already authenticated, verified owner and never creates claims.
  await client.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [owner, JSON.stringify({ sub: owner, aal: "aal2", session_id: owner })],
  );
  try {
    const businessHours = (
      await client.query(
        "select * from public.branch_business_hours where organization_id=$1 order by id",
        [org],
      )
    ).rows;
    await client.query(sql);
    const {
      rows: [beforeRetry],
    } = await client.query(
      `select
      (select count(*) from public.staff_availability_rules where organization_id=$1)::int rules,
      (select count(*) from public.audit_logs where organization_id=$1)::int audits`,
      [org],
    );
    await client.query(sql);
    const {
      rows: [afterRetry],
    } = await client.query(
      `select
      (select count(*) from public.staff_availability_rules where organization_id=$1)::int rules,
      (select count(*) from public.audit_logs where organization_id=$1)::int audits`,
      [org],
    );
    assert.deepEqual(afterRetry, beforeRetry);
    assert.equal(afterRetry.rules, 19); // 18 current + preserved previous version.
    const {
      rows: [retired],
    } = await client.query(
      "select starts_at::text,ends_at::text,valid_until::text from public.staff_availability_rules where id=$1",
      [historicalRule.id],
    );
    const {
      rows: [yesterday],
    } = await client.query("select ($1::date-1)::text date", [today]);
    assert.deepEqual(retired, {
      starts_at: "13:00:00",
      ends_at: "20:00:00",
      valid_until: yesterday.date,
    });
    assert.deepEqual(
      (
        await client.query(
          "select * from public.branch_business_hours where organization_id=$1 order by id",
          [org],
        )
      ).rows,
      businessHours,
    );
    const { rows: rules } = await client.query(
      "select staff_id,weekday,starts_at::text,ends_at::text from public.staff_availability_rules where organization_id=$1 and valid_until is null",
      [org],
    );
    assert.ok(rules.every((r) => r.weekday !== 0));
    assert.ok(
      rules
        .filter((r) => r.staff_id === jonatan)
        .every((r) => r.starts_at === "13:00:00" && r.ends_at === "21:00:00"),
    );
    assert.ok(
      rules
        .filter((r) => r.staff_id === esteban)
        .every((r) => r.ends_at === "12:00:00" || r.starts_at === "12:30:00"),
    );
    const manifest = JSON.parse(
      await readFile("config/onboarding/1717.json", "utf8"),
    );
    for (const service of manifest.services) {
      const {
        rows: [row],
      } = await client.query(
        "select s.id,s.consultation_required,bs.price_minor,bs.duration_minutes from public.services s join public.branch_services bs on bs.service_id=s.id and bs.organization_id=s.organization_id where s.organization_id=$1 and bs.branch_id=$2 and s.slug=$3",
        [org, branch, service.slug],
      );
      assert.equal(Number(row.price_minor), service.price_minor);
      assert.equal(row.duration_minutes, service.duration_minutes);
      assert.equal(row.consultation_required, service.consultation_required);
      const {
        rows: [plan],
      } = await client.query(
        "select app_private.service_plan($1,$2,$3) result",
        [org, branch, [row.id]],
      );
      assert.equal(plan.result.duration_minutes, service.duration_minutes);
      assert.equal(plan.result.price_minor, service.price_minor);
    }
    const {
      rows: [combo],
    } = await client.query(
      "select id from public.services where organization_id=$1 and slug='combo-rulos-y-corte'",
      [org],
    );
    const {
      rows: [cut],
    } = await client.query(
      "select id from public.services where organization_id=$1 and slug='corte-de-pelo'",
      [org],
    );
    await assert.rejects(
      client.query("select app_private.service_plan($1,$2,$3)", [
        org,
        branch,
        [combo.id, cut.id],
      ]),
      /one_primary_service_required/,
    );
    const {
      rows: [state],
    } = await client.query(
      `select
      (select booking_enabled from public.organization_settings where organization_id=$1) booking,
      (select booking_lead_minutes from public.organization_settings where organization_id=$1) lead,
      (select count(*) from public.payment_method_fee_rules r join public.payment_methods m on m.id=r.payment_method_id where r.organization_id=$1 and m.type='card')::int card_rules,
      (select count(*) from public.partner_distribution_periods where organization_id=$1)::int periods,
      (select count(*) from public.checkouts where organization_id=$1)::int checkouts,
      (select count(*) from app_private.platform_admins where profile_id=any($2::uuid[]))::int platform`,
      [org, [owner, secondOwner]],
    );
    assert.deepEqual(state, {
      booking: false,
      lead: 0,
      card_rules: 0,
      periods: 0,
      checkouts: 0,
      platform: 0,
    });
    // Provider evidence and zero fixed charges below are explicitly synthetic.
    // Validate actual temporal rules without activating any production fees.
    const since = new Date(Date.now() + 3600_000).toISOString();
    const posSql = pos1717Sql({
      projectRef: "tbcfhagteyqufjkmbxzz",
      organizationId: org,
      effectiveFrom: since,
      evidenceReference: "isolated provider evidence fixture",
      fixedAmountMinor: { debit: 0, credit: 0 },
    });
    await client.query(posSql);
    await client.query(posSql);
    const { rows: fees } = await client.query(
      "select m.code,r.percentage_bps,r.fixed_amount_minor,r.effective_from from public.payment_method_fee_rules r join public.payment_methods m on m.id=r.payment_method_id where r.organization_id=$1 and m.type='card' order by m.code",
      [org],
    );
    assert.equal(fees.length, 2);
    assert.deepEqual(
      fees.map((r) => [r.code, r.percentage_bps, Number(r.fixed_amount_minor)]),
      [
        ["credit", 500, 0],
        ["debit", 200, 0],
      ],
    );
    assert.ok(fees.every((r) => r.effective_from.toISOString() === since));
    const {
      rows: [day],
    } = await client.query(
      "select d::date::text monday from generate_series($1::date+1,$1::date+7,'1 day') d where extract(dow from d)=1",
      [today],
    );
    const contains = async (staff: string, time: string) =>
      (
        await client.query(
          "select app_private.effective_availability($1,$2,$3,$4,false,null) @> (($4::date+$5::time) at time zone 'America/Asuncion') available",
          [org, branch, staff, day.monday, time],
        )
      ).rows[0].available;
    assert.equal(await contains(esteban, "12:15"), false);
    assert.equal(await contains(esteban, "12:30"), true);
    assert.equal(await contains(jonatan, "13:00"), true);
    assert.equal(await contains(jonatan, "12:30"), false);
    await client.query(
      "insert into public.staff_availability_exceptions(organization_id,branch_id,staff_id,local_date,starts_at,ends_at,available,reason) values($1,$2,$3,$4,'14:00','15:00',false,'isolated unavailable exception')",
      [org, branch, jonatan, day.monday],
    );
    assert.equal(await contains(jonatan, "14:30"), false);
    assert.equal(await contains(esteban, "14:30"), true);
    await client.query(sql);
    assert.equal(await contains(jonatan, "14:30"), false);
    assert.equal(
      (
        await client.query(
          "select count(*)::int n from public.staff_availability_exceptions where organization_id=$1",
          [org],
        )
      ).rows[0].n,
      1,
    );
    await client.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: owner, aal: "aal1", session_id: owner }),
    ]);
    await assert.rejects(client.query(sql), /owner AAL2 session/);
    await client.query("rollback");
  } finally {
    try {
      await client.query("rollback");
      await client.query(
        "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','',false)",
      );
    } finally {
      client.release();
    }
  }
  console.log(
    "PASS Confirmed 17:17: owner/staff linkage, unauthorized/inactive rejection, AAL2, catalog, combo totals, 18 weekly intervals, break/Sunday, unchanged business hours, idempotency, public/distribution/POS gates",
  );
}
