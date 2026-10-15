import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { asUser } from "./database";
import { fixtures } from "./fixtures";

export async function financeContracts(pool: Pool) {
  const f = await fixtures(pool);
  let passed = 0;
  async function test(name: string, fn: () => Promise<void>) {
    await fn();
    passed++;
    console.log(`PASS Finance: ${name}`);
  }
  async function command(
    action: string,
    data: object,
    user = f.users.ownerA,
    branch = f.branches.a1,
    key = randomUUID(),
  ) {
    const rows = await asUser<{
      result: { id: string; [key: string]: unknown };
    }>(pool, user, "select public.finance_command($1,$2,$3,$4,$5) result", [
      f.orgA,
      branch,
      action,
      JSON.stringify(data),
      key,
    ]);
    return rows[0].result;
  }
  const methods: Record<string, string> = {};
  for (const [name, type, bps] of [
    ["cash", "cash", 0],
    ["transfer", "bank", 0],
    ["debit", "card", 300],
    ["credit", "card", 500],
  ] as const) {
    methods[name] = (
      await command("configure", {
        entity: "payment_methods",
        name,
        code: name,
        type,
      })
    ).id;
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: methods[name],
      percentage_bps: bps,
      fixed_amount_minor: 0,
    });
  }
  await pool.query(
    "update public.branch_services set price_minor=100000 where organization_id=$1 and service_id=$2",
    [f.orgA, f.services.cut],
  );
  await command("configure", {
    entity: "commission_rules",
    staff_id: f.staff.a1,
    service_id: f.services.cut,
    rate_bps: 4000,
  });
  const categories: Record<string, string> = {};
  for (const kind of ["operating", "advance", "salary", "commission_payment"])
    categories[kind] = (
      await command("configure", {
        entity: "expense_categories",
        name: kind,
        code: kind,
        kind,
      })
    ).id;
  const session = (
    await command("open_cash_session", { opening_amount_minor: 10000 })
  ).id;
  const sale = () =>
    command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
  const checkout = (await sale()).id;
  const pay = (
    id: string,
    method: string,
    amount: number,
    key = randomUUID(),
  ) =>
    command(
      "record_payment",
      {
        checkout_id: id,
        payment_method_id: methods[method],
        amount_minor: amount,
        cash_session_id: session,
      },
      f.users.ownerA,
      f.branches.a1,
      key,
    );
  await test("partial payment cannot post and overpayment is rejected", async () => {
    await pay(checkout, "cash", 60000);
    await assert.rejects(() => command("post_checkout", { id: checkout }));
    await assert.rejects(() => pay(checkout, "transfer", 40001));
    await pay(checkout, "transfer", 40000);
  });
  await test("concurrent posting succeeds exactly once", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        command("post_checkout", { id: checkout }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rows = await pool.query(
      "select amount_minor from public.commission_entries where checkout_id=$1",
      [checkout],
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(Number(rows.rows[0].amount_minor), 40000);
  });
  await test("idempotent retry returns the same payment, zero cash/transfer fee", async () => {
    const id = (await sale()).id;
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(id, "transfer", 100000, key)),
    );
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    await command("post_checkout", { id });
    const fees = await pool.query(
      "select fee_minor from public.payments where checkout_id=$1",
      [checkout],
    );
    assert.ok(fees.rows.every((r) => Number(r.fee_minor) === 0));
  });
  for (const [method, fee] of [
    ["debit", 3000],
    ["credit", 5000],
  ] as const)
    await test(`${method} exact POS snapshot`, async () => {
      const id = (await sale()).id;
      await pay(id, method, 100000);
      await command("post_checkout", { id });
      const rows = await pool.query(
        "select fee_minor from public.payments where checkout_id=$1",
        [id],
      );
      assert.equal(Number(rows.rows[0].fee_minor), fee);
    });
  await test("rule changes preserve historical fees and commission", async () => {
    await command("configure", {
      entity: "commission_rules",
      staff_id: f.staff.a1,
      service_id: f.services.cut,
      rate_bps: 5000,
    });
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: methods.debit,
      percentage_bps: 400,
      fixed_amount_minor: 0,
    });
    const r = await pool.query(
      "select amount_minor from public.commission_entries where checkout_id=$1",
      [checkout],
    );
    assert.equal(Number(r.rows[0].amount_minor), 40000);
    await assert.rejects(() =>
      pool.query(
        "update public.commission_entries set amount_minor=1 where checkout_id=$1",
        [checkout],
      ),
    );
    await assert.rejects(() =>
      pool.query("update public.checkouts set total_minor=1 where id=$1", [
        checkout,
      ]),
    );
    await assert.rejects(() =>
      pool.query("update public.checkouts set status='draft' where id=$1", [
        checkout,
      ]),
    );
  });
  await test("negative and float money rejected", async () => {
    await assert.rejects(() => pay(checkout, "cash", -1));
    await assert.rejects(() =>
      command("create_expense", {
        category_id: categories.operating,
        payment_method_id: methods.cash,
        amount_minor: 1.5,
        description: "Invalid",
        cash_session_id: session,
      }),
    );
  });
  const expense = (kind: string, amount: number) =>
    command(
      kind === "advance"
        ? "record_staff_advance"
        : kind === "salary"
          ? "record_salary_payment"
          : "create_expense",
      {
        category_id: categories[kind],
        payment_method_id: methods.cash,
        amount_minor: amount,
        description: kind,
        cash_session_id: session,
        staff_id: kind === "operating" ? null : f.staff.a1,
        deductible: true,
      },
    );
  await test("expense, deductible advance and independent salary", async () => {
    await expense("operating", 5000);
    await expense("advance", 10000);
    await expense("salary", 2000);
    const r = await pool.query(
      "select (select count(*) from public.staff_advances) advances,(select count(*) from public.salary_payments) salaries",
    );
    assert.equal(Number(r.rows[0].advances), 1);
    assert.equal(Number(r.rows[0].salaries), 1);
  });
  await test("RLS isolates tenant, branch and own staff; reception has no commissions", async () => {
    assert.equal(
      (await asUser(pool, f.users.ownerB, "select id from public.checkouts"))
        .length,
      0,
    );
    assert.equal(
      (
        await asUser(
          pool,
          f.users.receptionA,
          "select id from public.commission_entries",
        )
      ).length,
      0,
    );
    const own = await asUser<{ staff_id: string }>(
      pool,
      f.users.barberA,
      "select staff_id from public.commission_entries",
    );
    assert.ok(own.length > 0);
    assert.ok(own.every((r) => r.staff_id === f.staff.a1));
    await assert.rejects(() =>
      command(
        "open_cash_session",
        { opening_amount_minor: 0 },
        f.users.managerA1,
        f.branches.a2,
      ),
    );
    await assert.rejects(() =>
      command(
        "configure",
        {
          entity: "payment_methods",
          name: "Forbidden",
          code: "forbidden",
          type: "other",
        },
        f.users.receptionA,
      ),
    );
    await assert.rejects(() =>
      asUser(pool, null, "select id from public.payments"),
    );
    await assert.rejects(() =>
      asUser(
        pool,
        f.users.ownerA,
        "insert into public.payments(organization_id) values($1)",
        [f.orgA],
      ),
    );
    await assert.rejects(() =>
      pool.query(
        "insert into public.checkouts(organization_id,branch_id,currency,customer_id) values($1,$2,$3,$4)",
        [f.orgA, f.branches.a1, "USD", f.customers.b1],
      ),
    );
  });
  await test("settlement reserves accrued commission and advance once; salary excluded", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const id = (
      await command("create_staff_settlement", {
        staff_id: f.staff.a1,
        period_start: date,
        period_end: date,
      })
    ).id;
    const r = await pool.query(
      "select * from public.staff_settlements where id=$1",
      [id],
    );
    assert.equal(Number(r.rows[0].commission_accrued_minor), 160000);
    assert.equal(Number(r.rows[0].advances_applied_minor), 10000);
    assert.equal(Number(r.rows[0].remaining_balance_minor), 150000);
    await command("review_staff_settlement", { id });
    await command("pay_staff_settlement", {
      id,
      category_id: categories.commission_payment,
      payment_method_id: methods.transfer,
    });
    await command("close_staff_settlement", { id });
    await assert.rejects(() =>
      pool.query(
        "update public.staff_settlements set adjustments_minor=1 where id=$1",
        [id],
      ),
    );
    const other = (
      await command("create_staff_settlement", {
        staff_id: f.staff.a1,
        period_start: date,
        period_end: date,
      })
    ).id;
    assert.equal(
      Number(
        (
          await pool.query(
            "select commission_accrued_minor from public.staff_settlements where id=$1",
            [other],
          )
        ).rows[0].commission_accrued_minor,
      ),
      0,
    );
  });
  await test("cash close computes expected amount, requires variance reason, seals once", async () => {
    await assert.rejects(() =>
      command("close_cash_session", { id: session, actual_cash_minor: 53001 }),
    );
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        command(
          "close_cash_session",
          { id: session, actual_cash_minor: 53000 },
          f.users.ownerA,
          f.branches.a1,
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const r = await pool.query(
      "select expected_cash_minor,snapshot from public.cash_sessions where id=$1",
      [session],
    );
    assert.equal(Number(r.rows[0].expected_cash_minor), 53000);
    assert.equal(r.rows[0].snapshot.financial, undefined);
    const fresh = (
      await command(
        "reopen_cash_session",
        {
          id: session,
          opening_amount_minor: 53000,
          reason: "Corrected closing count",
        },
        f.users.ownerA,
        f.branches.a1,
        key,
      )
    ).id;
    assert.notEqual(fresh, session);
    assert.equal(
      (
        await command(
          "reopen_cash_session",
          {
            id: session,
            opening_amount_minor: 53000,
            reason: "Corrected closing count",
          },
          f.users.ownerA,
          f.branches.a1,
          key,
        )
      ).id,
      fresh,
    );
  });
  await test("refund reverses original sale and commissions without editing history", async () => {
    const r = await pool.query(
      "select c.id from public.checkouts c join public.payments p on p.checkout_id=c.id where p.payment_method_id=$1 and c.status='posted' limit 1",
      [methods.credit],
    );
    const id = r.rows[0].id;
    await command("reverse_financial_transaction", {
      entity_type: "checkout",
      id,
      reason: "Service refunded",
    });
    assert.equal(
      (
        await pool.query("select status from public.checkouts where id=$1", [
          id,
        ])
      ).rows[0].status,
      "reversed",
    );
    const p = await pool.query(
      "select sum(amount_minor*direction) amount from public.payments where checkout_id=$1",
      [id],
    );
    assert.equal(Number(p.rows[0].amount), 0);
    await assert.rejects(() =>
      command("reverse_financial_transaction", {
        entity_type: "checkout",
        id,
        reason: "Retry with wrong key",
      }),
    );
  });
  await test("financial aggregates and exports obey authorization", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const r = await asUser<{
      result: {
        totals: { gross_revenue_minor: number; paid_checkouts: number };
      };
    }>(
      pool,
      f.users.ownerA,
      "select public.finance_read($1,$2,$3,$4,$4) result",
      [f.orgA, f.branches.a1, "summary", date],
    );
    assert.equal(r[0].result.totals.gross_revenue_minor, 300000);
    assert.equal(r[0].result.totals.paid_checkouts, 4);
    await assert.rejects(() =>
      asUser(
        pool,
        f.users.receptionA,
        "select public.financial_export($1,$2,$3,$4,$4)",
        [f.orgA, f.branches.a1, "movements", date],
      ),
    );
  });
  await test("historical preview blocks anomalies; confirmed rows retain provenance and unknown calculations", async () => {
    const sha = "a".repeat(64);
    const date = "2026-04-06";
    const row = {
      source_sheet: "Registro Diario",
      source_row: 2,
      raw_values: [{ value: "anonymized" }],
      normalized: {
        date,
        type: "income",
        staff_id: f.staff.a1,
        service_id: f.services.cut,
        payment_method_id: methods.debit,
        amount_minor: 75000,
        person_label: "Anonymous historical label",
        concept: "cut",
      },
      anomalies: ["NEEDS_MAPPING"],
      review_status: "NEEDS_REVIEW",
    };
    const invoke = async (action: string, data: object, key = randomUUID()) =>
      (
        await asUser<{
          result: { id: string; preview_hash: string; imported_rows: number };
        }>(
          pool,
          f.users.ownerA,
          "select public.finance_import($1,$2,$3,$4,$5) result",
          [f.orgA, f.branches.a1, action, JSON.stringify(data), key],
        )
      )[0].result;
    let preview = await invoke("preview", {
      source_file: "anonymous.xlsx",
      source_sha256: sha,
      mapping: {},
      rows: [row],
    });
    await assert.rejects(() =>
      invoke("confirm", { id: preview.id, preview_hash: preview.preview_hash }),
    );
    preview = await invoke("preview", {
      source_file: "anonymous.xlsx",
      source_sha256: sha,
      mapping: {},
      rows: [{ ...row, anomalies: [], review_status: "READY" }],
    });
    const key = randomUUID();
    const imported = await invoke(
      "confirm",
      { id: preview.id, preview_hash: preview.preview_hash },
      key,
    );
    assert.equal(imported.imported_rows, 1);
    assert.equal(
      (
        await invoke(
          "confirm",
          { id: preview.id, preview_hash: preview.preview_hash },
          key,
        )
      ).id,
      imported.id,
    );
    const result = await pool.query(
      "select c.total_minor,p.fee_status,ce.calculation_status,r.raw_values from public.finance_import_rows r join public.checkouts c on c.id=r.checkout_id join public.payments p on p.checkout_id=c.id join public.commission_entries ce on ce.checkout_id=c.id where r.batch_id=$1",
      [preview.id],
    );
    assert.equal(Number(result.rows[0].total_minor), 75000);
    assert.equal(result.rows[0].fee_status, "unknown");
    assert.equal(result.rows[0].calculation_status, "unknown");
    assert.ok(result.rows[0].raw_values);
    await assert.rejects(() =>
      invoke("preview", {
        source_file: "anonymous.xlsx",
        source_sha256: sha,
        mapping: {},
        rows: [row],
      }),
    );
  });
  await test("finance role operates finances and cannot grant user/security privileges", async () => {
    const id = randomUUID();
    await pool.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      "finance@fixture.invalid",
    ]);
    await asUser(
      pool,
      f.users.ownerA,
      "select public.manage_membership($1,'finance@fixture.invalid','finance',true,'{}',true)",
      [f.orgA],
    );
    await command(
      "configure",
      {
        entity: "expense_categories",
        name: "Finance category",
        code: "finance_category",
        kind: "operating",
      },
      id,
    );
    const audit = await asUser<{ organization_id: string; action: string }>(
      pool,
      id,
      "select organization_id,action from public.audit_logs",
    );
    assert.ok(audit.length > 0);
    assert.ok(
      audit.every(
        (row) =>
          row.organization_id === f.orgA && row.action.startsWith("finance."),
      ),
    );
    assert.equal(
      (
        await asUser(
          pool,
          f.users.receptionA,
          "select id from public.audit_logs",
        )
      ).length,
      0,
    );
    await assert.rejects(() =>
      asUser(
        pool,
        id,
        "select public.manage_membership($1,'barberA@fixture.invalid','organization_owner',true,'{}',true)",
        [f.orgA],
      ),
    );
    assert.equal(
      (
        await asUser(
          pool,
          id,
          "select id from public.checkouts where organization_id=$1",
          [f.orgB],
        )
      ).length,
      0,
    );
  });
  await test("manual unknown-price sale takes authorized snapshot; atomic split rollback", async () => {
    const item = (
      await command("configure", {
        entity: "finance_items",
        name: "Authorized price item",
        kind: "product",
        price_minor: null,
      })
    ).id;
    const id = (
      await command("create_checkout", {
        lines: [
          {
            item_id: item,
            price_minor: 12345,
            reason: "Owner-approved price",
            quantity: 1,
          },
        ],
      })
    ).id;
    await assert.rejects(() =>
      command("post_checkout", {
        id,
        payments: [
          { payment_method_id: methods.transfer, amount_minor: 10000 },
          { payment_method_id: methods.transfer, amount_minor: 3000 },
        ],
      }),
    );
    assert.equal(
      Number(
        (
          await pool.query(
            "select count(*) from public.payments where checkout_id=$1",
            [id],
          )
        ).rows[0].count,
      ),
      0,
    );
    await command("post_checkout", {
      id,
      payments: [{ payment_method_id: methods.transfer, amount_minor: 12345 }],
    });
  });
  await test("adjustments cannot be allocated twice; cash expense reversal creates compensating movement", async () => {
    await command("record_financial_adjustment", {
      staff_id: f.staff.a1,
      amount_minor: 1000,
      reason: "Confirmed correction",
    });
    const date = new Date().toISOString().slice(0, 10);
    const a = (
      await command("create_staff_settlement", {
        staff_id: f.staff.a1,
        period_start: date,
        period_end: date,
      })
    ).id;
    const b = (
      await command("create_staff_settlement", {
        staff_id: f.staff.a1,
        period_start: date,
        period_end: date,
      })
    ).id;
    assert.equal(
      Number(
        (
          await pool.query(
            "select adjustments_minor from public.staff_settlements where id=$1",
            [a],
          )
        ).rows[0].adjustments_minor,
      ),
      1000,
    );
    assert.equal(
      Number(
        (
          await pool.query(
            "select adjustments_minor from public.staff_settlements where id=$1",
            [b],
          )
        ).rows[0].adjustments_minor,
      ),
      0,
    );
    const current = (
      await pool.query(
        "select id from public.cash_sessions where status='open' and organization_id=$1",
        [f.orgA],
      )
    ).rows[0].id;
    const expense = (
      await command("create_expense", {
        category_id: categories.operating,
        payment_method_id: methods.cash,
        amount_minor: 1000,
        description: "Correctable expense",
        cash_session_id: current,
      })
    ).id;
    await command("reverse_financial_transaction", {
      entity_type: "expense",
      id: expense,
      reason: "Incorrect expense reversed",
      cash_session_id: current,
    });
    assert.equal(
      Number(
        (
          await pool.query(
            "select sum(amount_minor) amount from public.cash_movements where expense_id=$1",
            [expense],
          )
        ).rows[0].amount,
      ),
      0,
    );
  });
  await test("posted database balance and booking website consultation boundary are enforced", async () => {
    const id = (await sale()).id;
    await assert.rejects(() =>
      pool.query(
        "update public.checkouts set status='posted',posted_at=now() where id=$1",
        [id],
      ),
    );
    await pool.query(
      "update public.services set consultation_required=true,website_category='rulos' where id=$1",
      [f.services.curl],
    );
    await assert.rejects(() =>
      asUser(
        pool,
        null,
        "select public.public_availability($1,$2,$3,$4,null,current_date+1)",
        [f.bookingSecret, "fixture-a", "a1", ["curl"]],
      ),
    );
    const catalog = await asUser<{
      result: { website_booking_version: number };
    }>(pool, null, "select public.public_catalog($1,$2,$3) result", [
      f.bookingSecret,
      "fixture-a",
      "a1",
    ]);
    assert.equal(catalog[0].result.website_booking_version, 1);
  });
  await test("posting retries and concurrent commission rule edits produce one consistent snapshot", async () => {
    const id = (await sale()).id;
    await command("record_payment", {
      checkout_id: id,
      payment_method_id: methods.transfer,
      amount_minor: 100000,
    });
    const key = randomUUID();
    await Promise.all([
      command("post_checkout", { id }, f.users.ownerA, f.branches.a1, key),
      command("configure", {
        entity: "commission_rules",
        staff_id: f.staff.a1,
        service_id: f.services.cut,
        rate_bps: 6000,
      }),
    ]);
    const retry = await command(
      "post_checkout",
      { id },
      f.users.ownerA,
      f.branches.a1,
      key,
    );
    assert.equal(retry.id, id);
    const rows = await pool.query(
      "select rate_bps,amount_minor,snapshot from public.commission_entries where checkout_id=$1",
      [id],
    );
    assert.equal(rows.rows.length, 1);
    assert.ok([5000, 6000].includes(rows.rows[0].rate_bps));
    assert.equal(
      Number(rows.rows[0].amount_minor),
      Number(rows.rows[0].rate_bps) * 10,
    );
    assert.equal(rows.rows[0].snapshot.rule.rate_bps, rows.rows[0].rate_bps);
  });
  return { passed };
}
