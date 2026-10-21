import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { asUser } from "./database";
import { fixtures } from "./fixtures";
export async function productContracts(pool: Pool) {
  const f = await fixtures(pool);
  let passed = 0;
  async function check(name: string, fn: () => Promise<void>) {
    await fn();
    passed++;
    console.log(`PASS Product: ${name}`);
  }
  async function claims(
    user: string,
    level: string,
    sql: string,
    args: unknown[] = [],
    session = user,
  ) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [user, JSON.stringify({ sub: user, aal: level, session_id: session })],
      );
      const r = await c.query(sql, args);
      await c.query("commit");
      return r.rows;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  await check(
    "AAL1 owners, managers and platform have no commercial SELECT, RPC or platform grants",
    async () => {
      for (const user of [
        f.users.ownerA,
        f.users.managerA1,
        f.users.platform,
      ]) {
        assert.equal(
          (await claims(user, "aal1", "select id from public.customers"))
            .length,
          0,
        );
        assert.equal(
          (await claims(user, "aal1", "select public.security_context() s"))[0]
            .s.allowed,
          false,
        );
        await assert.rejects(
          claims(
            user,
            "aal1",
            "select public.finance_command($1,$2,'open_cash_session','{\"opening_amount_minor\":0}',$3)",
            [f.orgA, f.branches.a1, randomUUID()],
          ),
          { code: "42501" },
        );
      }
      assert.equal(
        (
          await claims(
            f.users.platform,
            "aal2",
            "select id from public.customers",
          )
        ).length,
        0,
      );
      assert.ok(
        (
          await claims(
            f.users.ownerA,
            "aal2",
            "select id from public.customers",
          )
        ).length > 0,
      );
    },
  );
  await check(
    "AAL1 reception operates while enrolled users require MFA, and forged session IDs fail closed",
    async () => {
      assert.ok(
        (
          await claims(
            f.users.receptionA,
            "aal1",
            "select id from public.customers",
          )
        ).length > 0,
      );
      await pool.query(
        "insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",
        [randomUUID(), f.users.receptionA],
      );
      assert.equal(
        (
          await claims(
            f.users.receptionA,
            "aal1",
            "select id from public.customers",
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await claims(
            f.users.ownerA,
            "aal2",
            "select id from public.customers",
            [],
            randomUUID(),
          )
        ).length,
        0,
      );
    },
  );
  await check(
    "Revoking a session denies signed-claim DB access immediately and after the tenant lock",
    async () => {
      const blocker = await pool.connect();
      await blocker.query("begin");
      await blocker.query("select app_private.lock_organization($1)", [f.orgA]);
      const pending = claims(
        f.users.ownerA,
        "aal2",
        "select public.finance_command($1,$2,'open_cash_session','{\"opening_amount_minor\":0}',$3)",
        [f.orgA, f.branches.a1, randomUUID()],
      );
      // Wait for the actual advisory lock waiter, never assume a fixed delay proves concurrency.
      for (let i = 0; i < 100; i++) {
        if (
          (
            await pool.query(
              "select count(*)::int n from pg_locks where locktype='advisory' and not granted",
            )
          ).rows[0].n > 0
        )
          break;
        await new Promise((r) => setTimeout(r, 10));
      }
      await blocker.query("delete from auth.sessions where id=$1", [
        f.users.ownerA,
      ]);
      await blocker.query("commit");
      blocker.release();
      await assert.rejects(pending, { code: "42501" });
      await assert.rejects(
        claims(f.users.ownerA, "aal2", "select public.security_context()"),
        { code: "42501" },
      );
      await pool.query("insert into auth.sessions(id,user_id) values($1,$1)", [
        f.users.ownerA,
      ]);
    },
  );
  await pool.query(
    "update public.organizations set currency='PYG' where id=$1",
    [f.orgA],
  );
  const finance = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [f.orgA, f.branches.a1, action, data, randomUUID()],
      )
    )[0].r.id;
  await finance("configure_settings", {
    remuneration_model: "equal_profit_share",
    profit_share_staff_ids: [f.staff.a1, f.staff.a2],
  });
  const bank = await finance("configure", {
    entity: "payment_methods",
    name: "Test bank",
    code: "product_bank",
    type: "bank",
  });
  const cash = await finance("configure", {
    entity: "payment_methods",
    name: "Test cash",
    code: "product_cash",
    type: "cash",
  });
  for (const payment_method_id of [bank, cash])
    await finance("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id,
      percentage_bps: 0,
      fixed_amount_minor: 0,
      effective_from: "2020-01-01T00:00:00Z",
      evidence_reference: "isolated fixture fee agreement",
    });
  const item = await finance("configure", {
    entity: "finance_items",
    name: "Test product",
    kind: "product",
    price_minor: 101,
  });
  const when = new Date(Date.now() - 86400000).toISOString(),
    day = when.slice(0, 10);
  // Historical ledger fixture through the existing transaction helpers; no real history is touched.
  const checkout = (
    await pool.query(
      "select app_private.finance_create_checkout($1,$2,$3,false,$4) id",
      [
        f.orgA,
        f.branches.a1,
        { lines: [{ item_id: item, quantity: 1 }] },
        when,
      ],
    )
  ).rows[0].id;
  await pool.query(
    "select app_private.finance_record_payment($1,$2,$3,false,$4)",
    [
      f.orgA,
      f.branches.a1,
      { checkout_id: checkout, payment_method_id: bank, amount_minor: 101 },
      when,
    ],
  );
  await pool.query("select app_private.finance_post_checkout($1,$2,$3,$4)", [
    f.orgA,
    f.branches.a1,
    checkout,
    when,
  ]);
  await pool.query("select app_private.finance_rebuild_day($1,$2,$3)", [
    f.orgA,
    f.branches.a1,
    day,
  ]);
  const command = async (
    action: string,
    data: object,
    key = randomUUID(),
    user = f.users.ownerA,
  ) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        user,
        "select public.partner_distribution_command($1,$2,$3,$4,$5) r",
        [f.orgA, f.branches.a1, action, data, key],
      )
    )[0].r.id;
  const read = async () =>
    (
      await asUser<{
        r: {
          periods: {
            id: string;
            allocations: {
              id: string;
              staff_id: string;
              amount_minor: number;
              balance_minor: number;
            }[];
          }[];
        };
      }>(
        pool,
        f.users.ownerA,
        "select public.partner_distributions($1,$2,$3,$3) r",
        [f.orgA, f.branches.a1, day],
      )
    )[0].r;
  await check(
    "Distribution stays blocked without owner-confirmed policy; operational roles cannot enable or read it",
    async () => {
      await assert.rejects(command("prepare", { from: day, to: day }), {
        code: "23514",
      });
      await assert.rejects(command("configure", { enabled: true }), {
        code: "42501",
      });
      await assert.rejects(
        command(
          "configure",
          { confirmed: true },
          randomUUID(),
          f.users.managerA1,
        ),
        { code: "42501" },
      );
      for (const user of [
        f.users.receptionA,
        f.users.barberA,
        f.users.platform,
        f.users.ownerB,
      ])
        assert.equal(
          (
            await asUser(
              pool,
              user,
              "select * from public.partner_distribution_periods",
            )
          ).length,
          0,
        );
    },
  );
  await command("configure", {
    confirmed: true,
    enabled: true,
    periodicity: "manual",
    approval_role: "owner",
    withdrawals_mode: "explicit_advance",
    evidence_reference: "isolated fixture agreement",
  });
  let period = "";
  let a = "";
  let b = "";
  await check(
    "Prepared 50/50 snapshot retains the odd guaraní and approval records no payment",
    async () => {
      period = await command("prepare", { from: day, to: day });
      const data = await read();
      const rows = data.periods.find((p) => p.id === period)!.allocations;
      assert.deepEqual(
        rows.map((x) => Number(x.amount_minor)),
        [50, 50],
      );
      a = rows.find((x) => x.staff_id === f.staff.a1)!.id;
      b = rows.find((x) => x.id !== a)!.id;
      const key = randomUUID(),
        body = {
          id: period,
          reconciled: true,
          reference: "all costs reviewed",
        };
      assert.equal(
        await command("approve", body, key),
        await command("approve", body, key),
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.partner_distribution_payments",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "select remainder_minor from public.partner_distribution_periods where id=$1",
              [period],
            )
          ).rows[0].remainder_minor,
        ),
        1,
      );
    },
  );
  await check(
    "Approved intervals cannot overlap and immutable evidence cannot be overwritten",
    async () => {
      const other = await command("prepare", { from: day, to: day });
      await assert.rejects(
        command("approve", {
          id: other,
          reconciled: true,
          reference: "overlap fixture",
        }),
        { code: "23P01" },
      );
      await assert.rejects(
        pool.query(
          "update public.partner_distribution_periods set result_minor=1 where id=$1",
          [period],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        pool.query(
          "delete from public.partner_distribution_allocations where id=$1",
          [a],
        ),
        { code: "42501" },
      );
    },
  );
  const pay = (
    allocation: string,
    amount_minor: number,
    key = randomUUID(),
    method = bank,
  ) =>
    command(
      "pay",
      {
        allocation,
        amount_minor,
        method,
        confirmed: true,
        occurred_at: new Date().toISOString(),
        reference: "actual isolated payment",
      },
      key,
    );
  let payment = "";
  await check(
    "Concurrent payments cannot exceed adjusted allocation; retries and reversals preserve history",
    async () => {
      const attempts = await Promise.allSettled([pay(a, 30), pay(a, 30)]);
      assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
      payment = (
        attempts.find(
          (x) => x.status === "fulfilled",
        ) as PromiseFulfilledResult<string>
      ).value;
      await assert.rejects(
        command("adjust", {
          allocation: a,
          amount_minor: -21,
          reason: "invalid reduction",
        }),
        { code: "23514" },
      );
      const key = randomUUID(),
        data = {
          allocation: a,
          payment,
          confirmed: true,
          occurred_at: new Date().toISOString(),
          reference: "actual return confirmed",
        };
      assert.equal(
        await command("reverse_payment", data, key),
        await command("reverse_payment", data, key),
      );
      await assert.rejects(command("reverse_payment", data), { code: "23505" });
      const body = {
        allocation: a,
        amount_minor: 30,
        method: bank,
        confirmed: true,
        occurred_at: new Date().toISOString(),
        reference: "actual retry transfer",
      };
      const retryKey = randomUUID();
      assert.equal(
        await command("pay", body, retryKey),
        await command("pay", body, retryKey),
      );
      assert.equal(
        Number(
          (await read()).periods
            .find((x) => x.id === period)!
            .allocations.find((x) => x.id === a)!.balance_minor,
        ),
        20,
      );
    },
  );
  await check(
    "Cash payments require open session and funds, create one cash entry, and preserve operating profit",
    async () => {
      await assert.rejects(pay(b, 50, randomUUID(), cash), { code: "23514" });
      const session = await finance("open_cash_session", {
        opening_amount_minor: 49,
      });
      const body = {
        allocation: b,
        amount_minor: 50,
        method: cash,
        session,
        confirmed: true,
        occurred_at: new Date().toISOString(),
        reference: "cash counted and delivered",
      };
      await assert.rejects(command("pay", body), { code: "23514" });
      await finance("record_cash_movement", {
        cash_session_id: session,
        amount_minor: 1,
        reason: "fixture funding",
      });
      const id = await command("pay", body);
      assert.equal(
        Number(
          (
            await pool.query(
              "select amount_minor from public.cash_movements where partner_payment_id=$1",
              [id],
            )
          ).rows[0].amount_minor,
        ),
        -50,
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "select result_minor from public.partner_distribution_periods where id=$1",
              [period],
            )
          ).rows[0].result_minor,
        ),
        101,
      );
    },
  );
  await check(
    "Identified withdrawal applies once without a new expense, and closing requires zero balances",
    async () => {
      const category = await finance("configure", {
        entity: "expense_categories",
        name: "Advance",
        code: "product_advance",
        kind: "advance",
      });
      const expense = await finance("record_staff_advance", {
        category_id: category,
        payment_method_id: bank,
        staff_id: f.staff.a1,
        amount_minor: 20,
        deductible: false,
        description: "Actual isolated advance",
      });
      const advance = (
        await pool.query(
          "select id from public.staff_advances where expense_id=$1",
          [expense],
        )
      ).rows[0].id;
      await assert.rejects(command("close", { id: period }), { code: "23514" });
      const before = (
        await pool.query("select count(*)::int n from public.expenses")
      ).rows[0].n;
      const data = {
        allocation: a,
        advance,
        reference: "explicit advance classification",
      };
      await command("apply_withdrawal", data);
      await assert.rejects(command("apply_withdrawal", data));
      assert.equal(
        (await pool.query("select count(*)::int n from public.expenses"))
          .rows[0].n,
        before,
      );
      await command("close", { id: period });
      await assert.rejects(
        command("adjust", {
          allocation: a,
          amount_minor: 1,
          reason: "late adjustment",
        }),
        { code: "23514" },
      );
    },
  );
  await check(
    "Financial graphs separate 101 sales from 101 collected and preserve scope/bounds",
    async () => {
      const rows = await asUser<{
        r: { days: { sales: string; collected: string; result: string }[] };
      }>(
        pool,
        f.users.ownerA,
        "select public.financial_series($1,$2,$3,$3) r",
        [f.orgA, f.branches.a1, day],
      );
      assert.equal(rows[0].r.days[0].sales, "101");
      assert.equal(rows[0].r.days[0].collected, "101");
      assert.equal(rows[0].r.days[0].result, "101");
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerB,
          "select public.financial_series($1,$2,$3,$3)",
          [f.orgA, f.branches.a1, day],
        ),
        { code: "42501" },
      );
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerA,
          "select public.financial_series($1,$2,null,null)",
          [f.orgA, f.branches.a1],
        ),
        { code: "22023" },
      );
    },
  );
  await check(
    "Operational monitor rejects invalid secrets and reports actual scheduler heartbeat",
    async () => {
      await assert.rejects(
        asUser(pool, null, "select public.operations_health('wrong')"),
        { code: "42501" },
      );
      await pool.query("select app_private.run_scheduled_jobs()");
      const r = await asUser<{
        r: { heartbeat_at: string; booking_constraint: boolean };
      }>(pool, null, "select public.operations_health($1) r", [f.workerSecret]);
      assert.ok(r[0].r.heartbeat_at);
      assert.equal(r[0].r.booking_constraint, true);
    },
  );
  return { passed };
}
