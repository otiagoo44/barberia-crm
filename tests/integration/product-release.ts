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
  await check(
    "new organization brand defaults to gold without changing configured brands",
    async () => {
      const column = await pool.query(
        "select column_default from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='brand_color'",
      );
      assert.match(column.rows[0].column_default, /#D7B56D/);
      await pool.query(
        "update public.organizations set brand_color='#336699' where id=$1",
        [f.orgA],
      );
      assert.equal(
        (
          await pool.query(
            "select brand_color from public.organizations where id=$1",
            [f.orgA],
          )
        ).rows[0].brand_color,
        "#336699",
      );
    },
  );
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
    "customer list enriches the authorized page without leaking another branch's history or money",
    async () => {
      const g = await fixtures(
        pool,
        f.users,
        "projection-" + randomUUID().slice(0, 8),
      );
      for (const [branch, days, label] of [
        [g.branches.a1, 2, "Corte Centro"],
        [g.branches.a2, 1, "Servicio otro local"],
      ] as const) {
        const id = randomUUID();
        await pool.query(
          "insert into public.appointments(id,organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,status,currency,price_minor,completed_at) values($1,$2,$3,$4,$5,now()-make_interval(days=>$6),now()-make_interval(days=>$6)+interval '40 minutes',40,'completed','USD',2000,now()-make_interval(days=>$6)+interval '40 minutes')",
          [id, g.orgA, branch, g.customers.a1, g.staff.a1, days],
        );
        await pool.query(
          "insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) values($1,$2,$3,$4,40,2000,'standalone')",
          [g.orgA, id, g.services.cut, label],
        );
      }
      const sql = "select public.customer_list_view($1,$2,'',null,50,'all') r";
      for (const [user, label] of [
        [g.users.ownerA, "Servicio otro local"],
        [g.users.managerA1, "Corte Centro"],
        [g.users.barberA, "Corte Centro"],
        [g.users.receptionA, "Servicio otro local"],
      ]) {
        const page = (
          await asUser<{
            r: { items: { id: string; [key: string]: unknown }[] };
          }>(pool, user, sql, [g.orgA, null])
        )[0].r;
        const customer = page.items.find(
          (c: { id: string }) => c.id === g.customers.a1,
        );
        assert(customer);
        assert.equal(customer.last_service_name, label);
        assert.equal(typeof customer.last_visit_at, "string");
        for (const key of Object.keys(customer))
          assert(!/commission|profit|revenue|payment|price_minor/.test(key));
      }
      await assert.rejects(asUser(pool, g.users.ownerB, sql, [g.orgA, null]), {
        code: "42501",
      });
      await assert.rejects(
        asUser(pool, g.users.managerA1, sql, [g.orgA, g.branches.a2]),
        { code: "42501" },
      );
      await assert.rejects(
        claims(g.users.ownerA, "aal1", sql, [g.orgA, null]),
        { code: "42501" },
      );
    },
  );
  await check(
    "report categories and current retention preserve branch, staff and tenant scopes",
    async () => {
      const g = await fixtures(
        pool,
        f.users,
        "analytics-" + randomUUID().slice(0, 8),
      );
      await pool.query(
        "update public.customers set expected_return_at=now()-interval '5 days' where organization_id=$1",
        [g.orgA],
      );
      const readDashboard = async (
        user: string,
        branch: string | null = null,
        staff: string | null = null,
      ) =>
        (
          await asUser<{
            r: {
              by_category: { name: string; completed: number }[];
              by_staff: { staff_id: string; completed_minutes: number }[];
              retention_now: { overdue: number; lapsed: number };
            };
          }>(
            pool,
            user,
            "select public.dashboard($1,$2,$3,current_date,current_date) r",
            [g.orgA, branch, staff],
          )
        )[0].r;
      const all = await readDashboard(g.users.ownerA);
      assert.equal(all.retention_now.overdue, 2);
      assert.equal(all.retention_now.lapsed, 0);
      const manager = await readDashboard(g.users.managerA1, g.branches.a1);
      assert.equal(manager.retention_now.overdue, 1);
      const barber = await readDashboard(
        g.users.barberA,
        g.branches.a1,
        g.staff.a1,
      );
      assert.equal(barber.retention_now.overdue, 0);
      assert(barber.by_staff.every((s) => s.staff_id === g.staff.a1));
      assert(all.by_staff.every((s) => s.completed_minutes !== undefined));
      const visit = randomUUID();
      await pool.query(
        "update public.services set category='Cortes QA' where id=$1",
        [g.services.cut],
      );
      await pool.query(
        "insert into public.appointments(id,organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,status,currency,completed_at) values($1,$2,$3,$4,$5,current_date+interval '10 hours',current_date+interval '10 hours 40 minutes',40,'completed','USD',current_date+interval '10 hours 40 minutes')",
        [visit, g.orgA, g.branches.a1, g.customers.a1, g.staff.a1],
      );
      await pool.query(
        "insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,composition_mode) values($1,$2,$3,'Corte QA',40,'standalone')",
        [g.orgA, visit, g.services.cut],
      );
      const completed = await readDashboard(g.users.ownerA, g.branches.a1);
      assert.deepEqual(completed.by_category, [
        { name: "Cortes QA", completed: 1 },
      ]);
      assert.equal(
        completed.by_staff.find((s) => s.staff_id === g.staff.a1)!
          .completed_minutes,
        40,
      );
      await pool.query(
        "update public.customers set do_not_contact=true where id=$1",
        [g.customers.a1],
      );
      assert.equal(
        (await readDashboard(g.users.ownerA)).retention_now.overdue,
        1,
      );
      for (const user of [g.users.ownerB, g.users.receptionA])
        await assert.rejects(readDashboard(user), { code: "42501" });
      await pool.query(
        "update public.organization_memberships set role='finance' where organization_id=$1 and profile_id=$2",
        [g.orgA, g.users.receptionA],
      );
      await assert.rejects(readDashboard(g.users.receptionA), {
        code: "42501",
      });
      // Restore the shared profile's role; finance correctly requires MFA
      // across all memberships belonging to that session.
      await pool.query(
        "update public.organization_memberships set role='receptionist' where organization_id=$1 and profile_id=$2",
        [g.orgA, g.users.receptionA],
      );
      await assert.rejects(readDashboard(g.users.managerA1, g.branches.a2), {
        code: "42501",
      });
      await assert.rejects(
        claims(
          g.users.ownerA,
          "aal1",
          "select public.dashboard($1,null,null,current_date,current_date)",
          [g.orgA],
        ),
        { code: "42501" },
      );
      assert(Array.isArray(all.by_category));
    },
  );
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
    "Auth storage refuses last-factor retirement and serializes concurrent removals",
    async () => {
      const factors = [randomUUID(), randomUUID()];
      for (const id of factors)
        await pool.query(
          "insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",
          [id, f.users.ownerB],
        );
      const results = await Promise.allSettled(
        factors.map((id) =>
          pool.query("delete from auth.mfa_factors where id=$1", [id]),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
          .reason.code,
        "23514",
      );
      const remaining = (
        await pool.query("select id from auth.mfa_factors where user_id=$1", [
          f.users.ownerB,
        ])
      ).rows;
      assert.equal(remaining.length, 1);
      await assert.rejects(
        pool.query(
          "update auth.mfa_factors set status='unverified' where id=$1",
          [remaining[0].id],
        ),
        { code: "23514" },
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
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        if (
          (
            await pool.query(
              "select count(*)::int n from pg_locks where locktype='advisory' and not granted",
            )
          ).rows[0].n > 0
        ) {
          waiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.equal(
        waiting,
        true,
        "session revocation must race a proven lock waiter",
      );
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
            result_minor: string;
            allocations: {
              id: string;
              staff_id: string;
              amount_minor: string;
              balance_minor: string;
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
        command("configure", {
          confirmed: true,
          enabled: true,
          periodicity: "manual",
          approval_role: "owner",
          withdrawals_mode: "explicit_advance",
          evidence_reference: "isolated agreement without losses decision",
        }),
        { code: "23514" },
      );
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
    losses_reference: "isolated fixture: prior losses reconciled manually",
  });
  let period = "";
  let a = "";
  let b = "";
  await check(
    "Prepared 50/50 snapshot retains the odd guaraní and approval records no payment",
    async () => {
      period = await command("prepare", { from: day, to: day });
      const data = await read();
      assert.equal(
        data.periods.find((p) => p.id === period)!.result_minor,
        "101",
      );
      const rows = data.periods.find((p) => p.id === period)!.allocations;
      assert.equal(typeof rows[0].amount_minor, "string");
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
      await assert.rejects(
        finance("reverse_financial_transaction", {
          entity_type: "expense",
          id: expense,
          reason: "Cannot reverse an already distributed withdrawal",
        }),
        { code: "23514" },
      );
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
    "Partner barber projection contains only their approved assignment and no peer balances",
    async () => {
      const rows = await asUser<{ r: { items: Record<string, unknown>[] } }>(
        pool,
        f.users.barberA,
        "select public.partner_own_distributions($1,$2,$3,$3) r",
        [f.orgA, f.branches.a1, day],
      );
      assert.equal(rows[0].r.items.length, 1);
      assert.deepEqual(
        Object.keys(rows[0].r.items[0]).sort(),
        [
          "period_start",
          "period_end",
          "currency",
          "status",
          "assigned_minor",
          "balance_minor",
        ].sort(),
      );
      assert.equal(Number(rows[0].r.items[0].assigned_minor), 50);
      assert.equal(Number(rows[0].r.items[0].balance_minor), 0);
    },
  );
  await check(
    "New policy versions preserve closed-period snapshots, allocations and payments",
    async () => {
      const before = (
        await pool.query(
          "select to_jsonb(p) value from public.partner_distribution_periods p where id=$1",
          [period],
        )
      ).rows;
      const payments = (
        await pool.query(
          "select count(*)::int n from public.partner_distribution_payments",
        )
      ).rows[0].n;
      await command("configure", {
        confirmed: true,
        enabled: false,
        periodicity: "monthly",
        approval_role: "owner_or_finance",
        withdrawals_mode: "blocked",
        evidence_reference: "isolated changed agreement",
        losses_reference: "isolated manually reconciled prior losses",
      });
      assert.deepEqual(
        (
          await pool.query(
            "select to_jsonb(p) value from public.partner_distribution_periods p where id=$1",
            [period],
          )
        ).rows,
        before,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.partner_distribution_payments",
          )
        ).rows[0].n,
        payments,
      );
      assert.equal(
        (
          await pool.query(
            "select version from public.partner_distribution_policies order by version desc limit 1",
          )
        ).rows[0].version,
        2,
      );
      await assert.rejects(command("prepare", { from: day, to: day }), {
        code: "23514",
      });
    },
  );
  await check(
    "Financial graphs separate 101 sales from 101 collected and preserve scope/bounds",
    async () => {
      const rows = await asUser<{
        r: {
          days: {
            sales: string;
            collected: string;
            result: string;
            fees: string | null;
            commissions: string | null;
            expenses: string;
          }[];
        };
      }>(
        pool,
        f.users.ownerA,
        "select public.financial_series($1,$2,$3,$3) r",
        [f.orgA, f.branches.a1, day],
      );
      assert.equal(rows[0].r.days[0].sales, "101");
      assert.equal(rows[0].r.days[0].collected, "101");
      assert.equal(rows[0].r.days[0].result, "101");
      const first = rows[0].r.days[0];
      assert.equal(
        BigInt(first.sales) -
          BigInt(first.fees!) -
          BigInt(first.expenses) -
          BigInt(first.commissions!),
        BigInt(first.result),
      );
      assert.equal(typeof first.fees, "string");
      assert.equal(typeof first.commissions, "string");
      await pool.query(
        "update public.daily_financial_metrics set unknown_fees=1,unknown_commissions=1 where organization_id=$1 and branch_id=$2 and local_date=$3",
        [f.orgA, f.branches.a1, day],
      );
      const unknown = (
        await asUser<{
          r: { days: { fees: null; commissions: null; result: null }[] };
        }>(
          pool,
          f.users.ownerA,
          "select public.financial_series($1,$2,$3,$3) r",
          [f.orgA, f.branches.a1, day],
        )
      )[0].r.days[0];
      assert.equal(unknown.fees, null);
      assert.equal(unknown.commissions, null);
      assert.equal(unknown.result, null);
      await pool.query(
        "update public.daily_financial_metrics set unknown_fees=0,unknown_commissions=0 where organization_id=$1 and branch_id=$2 and local_date=$3",
        [f.orgA, f.branches.a1, day],
      );
      for (const user of [f.users.receptionA, f.users.barberA, f.users.ownerB])
        await assert.rejects(
          asUser(pool, user, "select public.financial_series($1,$2,$3,$3)", [
            f.orgA,
            f.branches.a1,
            day,
          ]),
          { code: "42501" },
        );
      const exact = (
        await pool.query(
          'select app_private.exact_financial_json(\'{"result_minor":9007199254740993,"nested":[{"amount_minor":-9007199254740993}],"count":1}\'::jsonb) r',
        )
      ).rows[0].r;
      assert.equal(exact.result_minor, "9007199254740993");
      assert.equal(exact.nested[0].amount_minor, "-9007199254740993");
      assert.equal(exact.count, 1);
      const summary = await asUser<{
        r: { totals: { gross_revenue_minor: string } };
      }>(
        pool,
        f.users.ownerA,
        "select public.finance_read_exact($1,$2,'summary',$3,$3) r",
        [f.orgA, f.branches.a1, day],
      );
      assert.equal(summary[0].r.totals.gross_revenue_minor, "101");
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
  await check(
    "Daily blocks validate the complete transaction, retain existing bookings and retry without duplicates",
    async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const target = tomorrow.toISOString().slice(0, 10);
      for (const hour of ["09:00", "16:00"])
        await asUser(
          pool,
          f.users.ownerA,
          "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null)",
          [
            f.orgA,
            f.branches.a1,
            [f.services.cut],
            f.staff.a1,
            `${target}T${hour}:00Z`,
            f.customers.a1,
            randomUUID(),
          ],
        );
      const blocks = [
        { starts_at: "09:00", ends_at: "12:00", available: true },
        { starts_at: "15:00", ends_at: "18:00", available: true },
        { starts_at: "12:00", ends_at: "15:00", available: false },
      ];
      const args = [
        f.orgA,
        f.branches.a1,
        f.staff.a1,
        target,
        JSON.stringify(blocks),
        randomUUID(),
      ];
      const sql = "select public.save_daily_blocks($1,$2,$3,$4,$5,$6) r";
      const first = await asUser(pool, f.users.ownerA, sql, args);
      assert.deepEqual(await asUser(pool, f.users.ownerA, sql, args), first);
      // A duplicate payload still needs write permission; it must not become
      // an unauthorized successful operation just because no INSERT is needed.
      await assert.rejects(
        asUser(pool, f.users.receptionA, sql, [
          ...args.slice(0, 5),
          randomUUID(),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        asUser(pool, f.users.ownerA, sql, [
          f.orgA,
          f.branches.a2,
          f.staff.a3,
          ...args.slice(3, 5),
          randomUUID(),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        asUser(pool, f.users.ownerA, sql, [
          f.orgA,
          f.branches.a1,
          f.staff.b1,
          ...args.slice(3, 5),
          randomUUID(),
        ]),
        { code: "42501" },
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.staff_availability_exceptions where organization_id=$1 and local_date=$2",
            [f.orgA, target],
          )
        ).rows[0].n,
        3,
      );
      const slots = (
        await asUser<{ r: { starts_at: string; ends_at: string }[] }>(
          pool,
          f.users.ownerA,
          "select public.list_availability($1,$2,$3,$4,$5) r",
          [f.orgA, f.branches.a1, [f.services.cut], target, f.staff.a1],
        )
      )[0].r;
      assert.ok(slots.length > 0);
      for (const slot of slots) {
        const start =
          new Date(slot.starts_at).getUTCHours() * 60 +
          new Date(slot.starts_at).getUTCMinutes();
        const end = start + 40;
        assert.ok(
          (start >= 9 * 60 && end <= 12 * 60) ||
            (start >= 15 * 60 && end <= 18 * 60),
          "the full service duration must fit a block without crossing a break",
        );
      }
      const invalid = [
        { starts_at: "18:00", ends_at: "19:00", available: true },
        { starts_at: "16:00", ends_at: "17:00", available: false },
      ];
      await assert.rejects(
        asUser(pool, f.users.ownerA, sql, [
          ...args.slice(0, 4),
          JSON.stringify(invalid),
          randomUUID(),
        ]),
        { code: "23514" },
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.staff_availability_exceptions where organization_id=$1 and local_date=$2",
            [f.orgA, target],
          )
        ).rows[0].n,
        3,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.appointments where organization_id=$1 and starts_at::date=$2",
            [f.orgA, target],
          )
        ).rows[0].n,
        2,
      );
      await assert.rejects(
        asUser(pool, f.users.ownerB, sql, [...args.slice(0, 5), randomUUID()]),
        { code: "42501" },
      );
      await assert.rejects(
        asUser(pool, f.users.receptionA, sql, [
          ...args.slice(0, 4),
          JSON.stringify(invalid.slice(0, 1)),
          randomUUID(),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerA,
          "select app_private.manage_record_core($1,'staff_availability_exceptions',null,$2,'{}',true)",
          [f.orgA, f.branches.a1],
        ),
        { code: "42501" },
      );
    },
  );
  return { passed };
}
