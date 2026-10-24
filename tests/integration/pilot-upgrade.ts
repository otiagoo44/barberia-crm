import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolatedDatabase, asUser } from "./database";
import { fixtures } from "./fixtures";

/** Exact current cloud baseline; all identities and money are isolated fixtures. */
export async function pilotUpgradeContracts() {
  const db = await isolatedDatabase(34);
  try {
    const f = await fixtures(db.pool);
    const command = async (action: string, data: object) =>
      (
        await asUser<{ r: { id: string } }>(
          db.pool,
          f.users.ownerA,
          "select public.finance_command($1,$2,$3,$4,$5) r",
          [f.orgA, f.branches.a1, action, JSON.stringify(data), randomUUID()],
        )
      )[0].r.id;
    const method = await command("configure", {
      entity: "payment_methods",
      name: "Legacy transfer",
      code: "legacy_transfer",
      type: "bank",
    });
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: method,
      percentage_bps: 0,
      fixed_amount_minor: 0,
    });
    const sale = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    await command("post_checkout", {
      id: sale,
      payments: [{ payment_method_id: method, amount_minor: 2000 }],
    });
    const snapshot = async () => {
      const tables = [
        "checkouts",
        "checkout_lines",
        "payments",
        "expenses",
        "cash_sessions",
        "staff_availability_rules",
        "staff_availability_exceptions",
      ];
      return Promise.all(
        tables.map(
          async (table) =>
            (
              await db.pool.query(
                `select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') rows from public.${table} x where organization_id=$1`,
                [f.orgA],
              )
            ).rows[0].rows,
        ),
      );
    };
    const before = await snapshot();
    await db.migrate();
    assert.deepEqual(await snapshot(), before);
    const counts = await db.pool.query(
      "select (select count(*) from public.payment_reconciliations)::int reconciliations,(select count(*) from public.partner_cash_policies)::int policies,(select count(*) from public.partner_period_approvals)::int approvals",
    );
    assert.deepEqual(counts.rows[0], {
      reconciliations: 0,
      policies: 0,
      approvals: 0,
    });
    console.log(
      "PASS Upgrade exact cloud baseline 34 to candidate: existing sale, payment, fee snapshots, weekly rules and exceptions unchanged; no tenant policies, reconciliations or approvals seeded",
    );
  } finally {
    await db.stop();
  }
}
