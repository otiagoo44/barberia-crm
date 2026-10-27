import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isolatedDatabase, asUser } from "./database";
import { fixtures } from "./fixtures";

export async function daybookUpgradeContracts() {
  const db = await isolatedDatabase(42);
  try {
    const f = await fixtures(db.pool);
    const command = async (
      action: string,
      data: object,
      user = f.users.ownerA,
      branch = f.branches.a1,
      key = randomUUID(),
    ) =>
      (
        await asUser<{ result: { id: string } }>(
          db.pool,
          user,
          "select public.finance_command($1,$2,$3,$4,$5) result",
          [f.orgA, branch, action, JSON.stringify(data), key],
        )
      )[0].result;
    const card = (
      await command("configure", {
        entity: "payment_methods",
        name: "Debit test",
        code: "testdebit",
        type: "card",
      })
    ).id;
    const cash = (
      await command("configure", {
        entity: "payment_methods",
        name: "Cash test",
        code: "testcash",
        type: "cash",
      })
    ).id;
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: cash,
      percentage_bps: 0,
      fixed_amount_minor: 0,
    });
    await command("configure", {
      entity: "commission_rules",
      staff_id: f.staff.a1,
      service_id: f.services.cut,
      rate_bps: 0,
    });
    const previous = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    const before = (
      await db.pool.query(
        "select to_jsonb(c) value from public.checkouts c where id=$1",
        [previous.id],
      )
    ).rows[0].value;
    await db.pool.query(
      await readFile(
        "supabase/migrations/20261026212415_simple_finance_daybook.sql",
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await db.pool.query(
          "select to_jsonb(c) value from public.checkouts c where id=$1",
          [previous.id],
        )
      ).rows[0].value,
      before,
    );
    const price = String(
      (
        await db.pool.query(
          "select price_minor from public.branch_services where organization_id=$1 and branch_id=$2 and service_id=$3",
          [f.orgA, f.branches.a1, f.services.cut],
        )
      ).rows[0].price_minor,
    );
    const data = {
      service_id: f.services.cut,
      staff_id: f.staff.a1,
      amount_minor: Number(price),
      payment_method_id: card,
      person_label: "Synthetic visitor",
    };
    const key = randomUUID();
    const income = await command(
      "record_income",
      data,
      f.users.ownerA,
      f.branches.a1,
      key,
    );
    assert.deepEqual(
      await command("record_income", data, f.users.ownerA, f.branches.a1, key),
      income,
    );
    const p = (
      await db.pool.query(
        "select fee_minor,fee_status from public.payments where checkout_id=$1",
        [income.id],
      )
    ).rows;
    assert.equal(p.length, 1);
    assert.equal(p[0].fee_minor, null);
    assert.equal(p[0].fee_status, "unknown");
    const date = new Date().toISOString().slice(0, 10);
    const read = async (user = f.users.ownerA, branch = f.branches.a1) =>
      (
        await asUser<{
          result: {
            totals: Record<string, string | null>;
            items: { person: string }[];
          };
        }>(
          db.pool,
          user,
          "select public.finance_read_exact($1,$2,'daybook',$3::date,$3::date) result",
          [f.orgA, branch, date],
        )
      )[0].result;
    const book = await read();
    assert.equal(String(book.totals.income_minor), price);
    assert.equal(book.totals.net_minor, null);
    assert.equal(book.items[0].person, "Synthetic visitor");
    const count = Number(
      (await db.pool.query("select count(*) from public.checkouts")).rows[0]
        .count,
    );
    await assert.rejects(() =>
      command("record_income", { ...data, payment_method_id: cash }),
    );
    await assert.rejects(() =>
      command("record_income", { ...data, amount_minor: Number(price) + 1 }),
    );
    await assert.rejects(() =>
      command("record_income", { ...data, amount_minor: 0 }),
    );
    await assert.rejects(() => command("record_income", data, f.users.ownerB));
    await assert.rejects(() => command("record_income", data, f.users.barberA));
    await assert.rejects(() => read(f.users.ownerB));
    await assert.rejects(() => read(f.users.managerA1, f.branches.a2));
    await assert.rejects(() =>
      asUser(
        db.pool,
        f.users.ownerA,
        "select app_private.finance_record_income($1,$2,$3)",
        [f.orgA, f.branches.a1, JSON.stringify(data)],
      ),
    );
    assert.equal(
      Number(
        (await db.pool.query("select count(*) from public.checkouts")).rows[0]
          .count,
      ),
      count,
    );
    await command("record_income", {
      ...data,
      amount_minor: Number(price) + 1,
      reason: "Price agreed with visitor",
    });
    const summary = (
      await asUser<{ result: { totals: { operating_result_minor: null } } }>(
        db.pool,
        f.users.ownerA,
        "select public.finance_read_exact($1,$2,'summary',$3::date,$3::date) result",
        [f.orgA, f.branches.a1, date],
      )
    )[0].result;
    assert.equal(summary.totals.operating_result_minor, null);
    const category = (
      await command("configure", {
        entity: "expense_categories",
        name: "Utilities test",
        code: "testutilities",
        kind: "operating",
      })
    ).id;
    const bank = (
      await command("configure", {
        entity: "payment_methods",
        name: "Bank test",
        code: "testbank",
        type: "bank",
      })
    ).id;
    const expense = await command("create_expense", {
      category_id: category,
      payment_method_id: bank,
      amount_minor: 1234,
      description: "Synthetic utility",
    });
    assert.equal(String((await read()).totals.expense_minor), "1234");
    await command("reverse_financial_transaction", {
      entity_type: "expense",
      id: expense.id,
      reason: "Synthetic correction",
    });
    assert.equal(String((await read()).totals.expense_minor), "0");
    console.log(
      "PASS Daybook: upgrade 42→43 preserves history; atomic income, pending card fees, exact totals, reversals, idempotency and tenant/branch/role isolation",
    );
  } finally {
    await db.stop();
  }
}
