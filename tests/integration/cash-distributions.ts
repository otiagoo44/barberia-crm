import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { Pool } from "pg";
import { asUser } from "./database";
import { fixtures } from "./fixtures";

/** Isolated SQL fixtures only. No credentials or synthetic money reach cloud. */
export async function cashDistributionContracts(pool: Pool) {
  const f = await fixtures(pool, undefined, "cash-policy");
  const org = f.orgA,
    branch = f.branches.a1,
    owner = f.users.ownerA,
    second = randomUUID();
  await pool.query(
    "insert into auth.users(id,email) values($1,'second-cash-owner@fixture.invalid')",
    [second],
  );
  await pool.query(
    "insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values($1,$2,'organization_owner',true)",
    [org, second],
  );
  await pool.query(
    "update public.organizations set currency='PYG' where id=$1",
    [org],
  );
  await pool.query("update public.staff set profile_id=$2 where id=$1", [
    f.staff.a1,
    owner,
  ]);
  await pool.query("update public.staff set profile_id=$2 where id=$1", [
    f.staff.a2,
    second,
  ]);
  for (const user of [owner, second])
    await pool.query(
      "insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",
      [randomUUID(), user],
    );
  await asUser(
    pool,
    owner,
    "select public.finance_command($1,null,'configure_settings',$2,$3)",
    [
      org,
      {
        remuneration_model: "equal_profit_share",
        profit_share_staff_ids: [f.staff.a1, f.staff.a2],
      },
      randomUUID(),
    ],
  );
  const command = async (
    action: string,
    data: object,
    user = owner,
    key: string = randomUUID(),
  ) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        user,
        "select public.partner_distribution_command($1,$2,$3,$4,$5) r",
        [org, branch, action, data, key],
      )
    )[0].r.id;
  const finance = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        owner,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [org, branch, action, data, randomUUID()],
      )
    )[0].r.id;
  let count = 0;
  async function check(name: string, run: () => Promise<void>) {
    await run();
    count++;
    console.log(`PASS Cash policy: ${name}`);
  }
  const cashMethod = await finance("configure", {
    entity: "payment_methods",
    name: "Cash",
    code: "cash",
    type: "cash",
  });
  const cardMethod = await finance("configure", {
    entity: "payment_methods",
    name: "UPay debit",
    code: "debit",
    type: "card",
  });
  const bankMethod = await finance("configure", {
    entity: "payment_methods",
    name: "Bank",
    code: "bank",
    type: "bank",
  });
  const opCategory = await finance("configure", {
    entity: "expense_categories",
    name: "Paid operating",
    code: "operating",
    kind: "operating",
  });
  const advanceCategory = await finance("configure", {
    entity: "expense_categories",
    name: "Owner advance",
    code: "advance",
    kind: "advance",
  });
  const configure = {
    confirmed: true,
    recognition: "settled_collections_including_advances",
    first_month: "2026-01-01",
    initial_losses_confirmed_zero: true,
    reference:
      "Isolated owner agreement: settled receipts including eligible advances",
  };
  await pool.query(
    "update public.organizations set slug='1717-barberia' where id=$1",
    [org],
  );
  await assert.rejects(
    command("configure_cash", configure),
    /confirmed_1717_owner_identities_required/,
  );
  await pool.query(
    "update public.organizations set slug='cash-policy-a' where id=$1",
    [org],
  );
  await command("configure_cash", configure);
  await check(
    "policy is explicitly versioned and initially disabled",
    async () => {
      await assert.rejects(
        command("prepare", { from: "2026-01-01", to: "2026-01-31" }),
        /distribution_activation_gates_open/,
      );
      await assert.rejects(
        command("approve_activation", { gates: { smtp: "missing rest" } }),
        /external_gate_evidence_required/,
      );
    },
  );
  const gates = Object.fromEntries(
    [
      "owner_accounts",
      "smtp",
      "mfa",
      "pos_contract",
      "policy",
      "staging",
      "backup_restore",
      "alerts",
      "pilot",
    ].map((k) => [
      k,
      `Isolated verified ${k} evidence; never production evidence`,
    ]),
  );
  await command("approve_activation", { gates });
  await assert.rejects(
    command("prepare", { from: "2026-01-01", to: "2026-01-31" }),
    /distribution_activation_gates_open/,
  );
  await command("approve_activation", { gates }, second);
  // Source records use controlled historical dates. Actual command security,
  // dual approval, net reconciliation, losses and balances remain real SQL.
  const receipt = async (
    amount: number,
    date: string,
    method = cashMethod,
    direction = 1,
    original: string | null = null,
    checkout?: string,
  ) => {
    const id = randomUUID(),
      checkoutId = checkout ?? randomUUID();
    if (!checkout)
      await pool.query(
        "insert into public.checkouts(id,organization_id,branch_id,currency,total_minor,occurred_at) values($1,$2,$3,'PYG',$4,$5)",
        [checkoutId, org, branch, amount, date],
      );
    await pool.query(
      "insert into public.payments(id,organization_id,branch_id,checkout_id,payment_method_id,amount_minor,fee_minor,fee_status,method_name_snapshot,method_type_snapshot,direction,reversal_of_id,occurred_at) values($1,$2,$3,$4,$5,$6,null,'unknown','fixture',$7,$8,$9,$10)",
      [
        id,
        org,
        branch,
        checkoutId,
        method,
        amount,
        method === cardMethod ? "card" : "cash",
        direction,
        original,
        date,
      ],
    );
    return { id, checkout: checkoutId };
  };
  const reconcile = (
    id: string,
    date: string,
    net: number,
    fee = 0,
    eligibility = "earned",
  ) =>
    command("reconcile_payment", {
      payment: id,
      eligibility_confirmed: true,
      eligibility,
      eligible_at: date,
      settled_at: date,
      processing_cost_minor: fee,
      processing_credit_minor: 0,
      tax_minor: 0,
      withholding_minor: 0,
      other_cost_minor: 0,
      net_minor: String(net),
      reference: "Isolated reconciled processor/bank statement",
    });
  const expense = async (
    amount: number,
    date: string,
    category = opCategory,
    staff: string | null = null,
  ) => {
    const id = randomUUID();
    await pool.query(
      "insert into public.expenses(id,organization_id,branch_id,category_id,category_kind_snapshot,staff_id,description,amount_minor,payment_method_id,method_name_snapshot,method_type_snapshot,currency,occurred_at) values($1,$2,$3,$4,$5,$6,'Isolated paid expense',$7,$8,'Bank','bank','PYG',$9)",
      [
        id,
        org,
        branch,
        category,
        category === advanceCategory ? "advance" : "operating",
        staff,
        amount,
        bankMethod,
        date,
      ],
    );
    return id;
  };
  const read = async (period: string) =>
    (
      await pool.query(
        "select * from public.partner_distribution_periods where id=$1",
        [period],
      )
    ).rows[0];
  const approve = (period: string, user = owner, key?: string) =>
    command(
      "approve",
      {
        id: period,
        reconciled: true,
        reference: "Isolated approval of exact frozen snapshot",
      },
      user,
      key,
    );
  const prepare = (month: string, end: string) =>
    command("prepare", {
      from: `2026-${month}-01`,
      to: `2026-${month}-${end}`,
    });
  await expense(100000, "2026-01-10T12:00:00Z");
  const january = await prepare("01", "31");
  await check(
    "one approval cannot pay, the same identity cannot approve twice, external owner cannot approve",
    async () => {
      await approve(january);
      assert.equal((await read(january)).status, "draft");
      await assert.rejects(approve(january), { code: "23505" });
      await assert.rejects(approve(january, f.users.ownerB), { code: "42501" });
      await pool.query(
        "update public.organization_memberships set role='organization_owner',all_branches=true where organization_id=$1 and profile_id=$2",
        [org, f.users.receptionA],
      );
      await pool.query("update public.staff set profile_id=$2 where id=$1", [
        f.staff.a2,
        f.users.receptionA,
      ]);
      await assert.rejects(
        approve(january, f.users.receptionA),
        /partner_owner_required/,
      );
      await pool.query("update public.staff set profile_id=$2 where id=$1", [
        f.staff.a2,
        second,
      ]);
      await pool.query(
        "update public.organization_memberships set role='receptionist' where organization_id=$1 and profile_id=$2",
        [org, f.users.receptionA],
      );
      const allocation = (
        await pool.query(
          "select id from public.partner_distribution_allocations where period_id=$1 limit 1",
          [january],
        )
      ).rows[0].id;
      await assert.rejects(
        command("pay", {
          allocation,
          amount_minor: 1,
          confirmed: true,
          occurred_at: new Date().toISOString(),
          method: bankMethod,
          reference: "Fixture bank reference",
        }),
        /dual_approval_required/,
      );
    },
  );
  await approve(january, second);
  await check(
    "negative month pays zero and creates one auditable loss origin",
    async () => {
      const p = await read(january);
      assert.equal(p.status, "approved");
      assert.equal(p.result_minor, "0");
      assert.equal(p.snapshot.losses_remaining_minor, 100000);
      assert.equal(
        (
          await pool.query(
            "select sum(amount_minor)::text n from public.partner_loss_ledger",
          )
        ).rows[0].n,
        "100000",
      );
      await command("close", { id: january });
      await assert.rejects(
        pool.query(
          "update public.partner_distribution_periods set result_minor=1 where id=$1",
          [january],
        ),
        /immutable_distribution/,
      );
    },
  );
  const febReceipt = await receipt(300000, "2026-02-10T12:00:00Z");
  await reconcile(febReceipt.id, "2026-02-10T12:00:00Z", 300000);
  const february = await prepare("02", "28");
  await check(
    "300000 collected minus 100000 prior loss distributes 100000 per owner",
    async () => {
      const p = await read(february);
      assert.equal(p.snapshot.before_losses_minor, 300000);
      assert.equal(p.snapshot.distributable_minor, 200000);
      assert.equal(p.snapshot.per_partner_minor, 100000);
      const key = randomUUID();
      assert.equal(
        await approve(february, owner, key),
        await approve(february, owner, key),
      );
      await approve(february, second);
      assert.equal(
        (
          await pool.query(
            "select sum(amount_minor)::text n from public.partner_loss_ledger",
          )
        ).rows[0].n,
        "0",
      );
    },
  );
  const card = await receipt(30000, "2026-03-05T12:00:00Z", cardMethod);
  await check(
    "unknown POS and any settlement difference block the proposal",
    async () => {
      await assert.rejects(
        prepare("03", "31"),
        /incomplete_distribution_result/,
      );
      await assert.rejects(
        reconcile(card.id, "2026-03-06T12:00:00Z", 30000, 600),
        /settlement_difference/,
      );
      await reconcile(card.id, "2026-03-06T12:00:00Z", 29400, 600);
      const p = (
        await pool.query(
          "select amount_minor,fee_minor from public.payments where id=$1",
          [card.id],
        )
      ).rows[0];
      assert.equal(p.amount_minor, "30000");
      assert.equal(p.fee_minor, null); // Historical estimate is preserved.
      await assert.rejects(
        reconcile(card.id, "2026-03-06T12:00:00Z", 29400, 600),
        { code: "23505" },
      );
    },
  );
  const cash = await receipt(30000, "2026-03-05T12:00:00Z");
  await reconcile(cash.id, "2026-03-05T12:00:00Z", 30000);
  const draftPartial = await receipt(10000, "2026-03-07T12:00:00Z");
  await reconcile(
    draftPartial.id,
    "2026-03-07T12:00:00Z",
    10000,
    0,
    "advance_resolved",
  );
  await command("record_payable", {
    amount_minor: 999999,
    description: "Unpaid invoice does not reduce cash profit",
    due_on: "2026-03-20",
    reference: "Isolated unpaid invoice",
  });
  const advanceExpense = await expense(
    100000,
    "2026-03-01T12:00:00Z",
    advanceCategory,
    f.staff.a1,
  );
  const advance = randomUUID();
  await pool.query(
    "insert into public.staff_advances(id,organization_id,branch_id,staff_id,expense_id,deductible,amount_minor,occurred_at) values($1,$2,$3,$4,$5,false,100000,'2026-03-01')",
    [advance, org, branch, f.staff.a1, advanceExpense],
  );
  await assert.rejects(prepare("03", "31"), /incomplete_distribution_result/);
  await command("classify_withdrawal", {
    advance,
    treatment: "owner_withdrawal",
    reference: "Isolated owner withdrawal evidence, not employee compensation",
  });
  const march = await prepare("03", "31");
  await check(
    "cash, card net and draft partial advance count once; unpaid invoices and owner advances are not costs",
    async () => {
      const p = await read(march);
      assert.equal(p.snapshot.gross_collections_minor, 70000);
      assert.equal(p.snapshot.net_settled_minor, 69400);
      assert.equal(p.snapshot.paid_expenses_minor, 0);
      assert.equal(p.snapshot.per_partner_minor, 34700);
      await approve(march);
      await approve(march, second);
      const allocations = (
        await pool.query(
          "select staff_id,app_private.partner_balance($1,id)::text balance from public.partner_distribution_allocations where period_id=$2",
          [org, march],
        )
      ).rows;
      assert.equal(
        allocations.find((a) => a.staff_id === f.staff.a1).balance,
        "0",
      );
      assert.equal(
        allocations.find((a) => a.staff_id === f.staff.a2).balance,
        "34700",
      );
      assert.equal(
        (
          await pool.query(
            "select sum(amount_minor)::text n from public.partner_advance_applications where advance_id=$1",
            [advance],
          )
        ).rows[0].n,
        "34700",
      );
      await assert.rejects(
        pool.query(
          "update public.expenses set status='reversed',reversed_at=now() where id=$1",
          [advanceExpense],
        ),
        /allocated_advance_requires_adjustment/,
      );
    },
  );
  const balancePayment = await receipt(
    20000,
    "2026-04-02T12:00:00Z",
    cashMethod,
    1,
    null,
    draftPartial.checkout,
  );
  await reconcile(balancePayment.id, "2026-04-02T12:00:00Z", 20000);
  const refund = await receipt(
    30000,
    "2026-04-03T12:00:00Z",
    cardMethod,
    -1,
    card.id,
    card.checkout,
  );
  await reconcile(refund.id, "2026-04-03T12:00:00Z", -30000, 0, "refund");
  const april = await prepare("04", "30");
  await check(
    "later partial balance and refund affect the later month; original processing cost is not refunded or deducted twice",
    async () => {
      assert.equal((await read(april)).snapshot.net_settled_minor, -10000);
      await approve(april);
      await approve(april, second);
      assert.equal((await read(april)).snapshot.losses_remaining_minor, 10000);
      assert.equal((await read(march)).snapshot.net_settled_minor, 69400);
    },
  );
  const may = await receipt(3000, "2026-05-02T12:00:00Z");
  await reconcile(may.id, "2026-05-02T12:00:00Z", 3000);
  const mayPeriod = await prepare("05", "31");
  await approve(mayPeriod);
  await approve(mayPeriod, second);
  await check(
    "loss recovery carries the unpaid remainder into consecutive months",
    async () => {
      assert.equal(
        (await read(mayPeriod)).snapshot.losses_remaining_minor,
        7000,
      );
      assert.equal((await read(mayPeriod)).result_minor, "0");
    },
  );
  const june = await receipt(10001, "2026-06-02T12:00:00Z");
  await reconcile(june.id, "2026-06-02T12:00:00Z", 10001);
  const junePeriod = await prepare("06", "30");
  await check(
    "integer PYG rounding retains one guarani; concurrent owners transition once",
    async () => {
      assert.equal((await read(junePeriod)).snapshot.per_partner_minor, 1500);
      assert.equal((await read(junePeriod)).snapshot.remainder_minor, 1);
      await Promise.all([approve(junePeriod), approve(junePeriod, second)]);
      assert.equal((await read(junePeriod)).status, "approved");
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.partner_period_approvals where period_id=$1",
            [junePeriod],
          )
        ).rows[0].n,
        2,
      );
    },
  );
  const july = await receipt(40000, "2026-07-02T12:00:00Z");
  await reconcile(july.id, "2026-07-02T12:00:00Z", 40000);
  const julyPeriod = await prepare("07", "31");
  await approve(julyPeriod);
  await expense(1, "2026-07-03T12:00:00Z");
  await check(
    "material changes invalidate the original snapshot and approval; prepare a fresh proposal",
    async () => {
      await assert.rejects(
        approve(julyPeriod, second),
        /stale_distribution_snapshot/,
      );
      const replacement = await prepare("07", "31");
      await approve(replacement);
      await approve(replacement, second);
      assert.equal((await read(julyPeriod)).status, "draft");
    },
  );
  await check(
    "revocation, AAL1, cross-tenant reads and direct writes remain blocked",
    async () => {
      await pool.query(
        "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
        [org, second],
      );
      await assert.rejects(
        command(
          "record_payable",
          {
            amount_minor: 1,
            description: "blocked",
            due_on: "2026-08-01",
            reference: "blocked fixture",
          },
          second,
        ),
        { code: "42501" },
      );
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("set local role authenticated");
        await c.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
          [
            owner,
            JSON.stringify({ sub: owner, aal: "aal1", session_id: owner }),
          ],
        );
        await assert.rejects(
          c.query(
            "select public.partner_distribution_command($1,$2,'prepare',$3,$4)",
            [
              org,
              branch,
              { from: "2026-08-01", to: "2026-08-31" },
              randomUUID(),
            ],
          ),
          { code: "42501" },
        );
      } finally {
        await c.query("rollback");
        c.release();
      }
      assert.equal(
        (
          await asUser(
            pool,
            f.users.ownerB,
            "select * from public.payment_reconciliations where organization_id=$1",
            [org],
          )
        ).length,
        0,
      );
      await assert.rejects(
        asUser(pool, owner, "delete from public.partner_period_approvals"),
        { code: "42501" },
      );
    },
  );
  await check(
    "weekly diagnostics uses the authoritative engine and enforces tenant access",
    async () => {
      const result = (
        await asUser<{
          r: { people: { configured: boolean; effective: boolean }[] };
        }>(
          pool,
          owner,
          "select public.setup_availability($1,$2,'2026-08-03') r",
          [org, branch],
        )
      )[0].r;
      assert.ok(result.people.length > 0);
      assert.ok(result.people.some((p) => p.configured));
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerB,
          "select public.setup_availability($1,$2,'2026-08-03')",
          [org, branch],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "arrival after 15 minutes is manual and audited; in-service cannot become no-show",
    async () => {
      const appointment = randomUUID();
      await pool.query(
        "insert into public.appointments(id,organization_id,branch_id,staff_id,customer_id,starts_at,ends_at,duration_minutes,status,currency,price_minor) values($1,$2,$3,$4,$5,now()-interval '20 minutes',now()+interval '20 minutes',40,'scheduled','PYG',30000)",
        [appointment, org, branch, f.staff.a1, f.customers.a1],
      );
      await asUser(
        pool,
        owner,
        "select public.transition_booking($1,$2,'checked_in',$3,null)",
        [org, appointment, randomUUID()],
      );
      const audit = (
        await pool.query(
          "select metadata from public.audit_logs where organization_id=$1 and entity_id=$2 and action='appointment.checked_in' order by created_at desc limit 1",
          [org, appointment],
        )
      ).rows[0];
      assert.ok(audit.metadata.late_minutes >= 20);
      assert.equal(audit.metadata.manual, true);
      await asUser(
        pool,
        owner,
        "select public.transition_booking($1,$2,'in_service',$3,null)",
        [org, appointment, randomUUID()],
      );
      await assert.rejects(
        asUser(
          pool,
          owner,
          "select public.transition_booking($1,$2,'no_show',$3,null)",
          [org, appointment, randomUUID()],
        ),
        /invalid_transition/,
      );
    },
  );
  const plan = await pool.query(
    "explain (analyze,buffers,format json) select app_private.cash_distribution_snapshot($1,$2,'2026-07-01','2026-07-31')",
    [org, branch],
  );
  await mkdir("docs/verification/1717-20261024", { recursive: true });
  await writeFile(
    "docs/verification/1717-20261024/cash-explain.json",
    JSON.stringify(
      {
        scope: "isolated SQL fixtures; no production latency/SLA claim",
        plan: plan.rows[0]["QUERY PLAN"],
      },
      null,
      2,
    ),
  );
  return {
    passed: count,
    auth: "SQL sessions and MFA fixtures; real Auth tested separately",
  };
}
