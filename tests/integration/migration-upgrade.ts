import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isolatedDatabase, asUser } from "./database";
import { fixtures, type FixtureUsers } from "./fixtures";
import type { Pool } from "pg";

export async function migrationUpgradeContracts(external?: {
  pool: Pool;
  migrate: () => Promise<void>;
  users: FixtureUsers;
}) {
  const isolated = external ? undefined : await isolatedDatabase(27);
  const db = external ?? isolated!;
  try {
    const f = await fixtures(db.pool, external?.users);
    const command = async (action: string, data: object, key = randomUUID()) =>
      (
        await asUser<{ r: { id: string } }>(
          db.pool,
          f.users.ownerA,
          "select public.finance_command($1,$2,$3,$4,$5) r",
          [f.orgA, f.branches.a1, action, data, key],
        )
      )[0].r.id;
    const method = await command("configure", {
      entity: "payment_methods",
      name: "Upgrade cash",
      code: "upgrade_cash",
      type: "cash",
    });
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: method,
      percentage_bps: 0,
      fixed_amount_minor: 0,
    });
    const item = await command("configure", {
      entity: "finance_items",
      name: "Legacy product",
      kind: "product",
      price_minor: 10000,
    });
    const session = await command("open_cash_session", {
      opening_amount_minor: 1000,
    });
    const checkout = await command("create_checkout", {
      lines: [{ item_id: item, quantity: 1 }],
    });
    await command("post_checkout", {
      id: checkout,
      payments: [
        {
          payment_method_id: method,
          amount_minor: 10000,
          cash_session_id: session,
        },
      ],
    });
    const category = await command("configure", {
      entity: "expense_categories",
      name: "Legacy rent",
      code: "upgrade_rent",
      kind: "operating",
    });
    const expenseData = {
      category_id: category,
      payment_method_id: method,
      cash_session_id: session,
      amount_minor: 100,
      description: "Legacy expense survives upgrade",
    };
    const expenseKey = randomUUID();
    const expense = await command("create_expense", expenseData, expenseKey);
    await command("close_cash_session", {
      id: session,
      actual_cash_minor: 10900,
    });

    // Compare every existing column and row, including events, Auth identities,
    // memberships, immutable finance snapshots and durable dedupe keys.
    const tables = (
      await db.pool.query<{
        schema: string;
        table: string;
        columns: string[];
      }>(`
          select table_schema schema,table_name "table",array_agg(column_name::text order by ordinal_position) columns
      from information_schema.columns where table_schema in ('public','app_private','auth')
      and table_name in (select tablename from pg_tables where schemaname in ('public','app_private','auth'))
      group by table_schema,table_name order by table_schema,table_name`)
    ).rows;
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    async function fingerprints() {
      const hashes: Record<string, string> = {};
      for (const table of tables) {
        const name = `${quote(table.schema)}.${quote(table.table)}`;
        const columns = table.columns.map(quote).join(",");
        const result = await db.pool.query(
          `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from (select ${columns} from ${name}) t`,
        );
        hashes[`${table.schema}.${table.table}`] = createHash("sha256")
          .update(JSON.stringify(result.rows[0].value))
          .digest("hex");
      }
      return hashes;
    }
    const before = await fingerprints();
    await db.migrate();
    assert.deepEqual(await fingerprints(), before);
    assert.equal(
      await command("create_expense", expenseData, expenseKey),
      expense,
    );
    const cash = (
      await asUser<{ r: { session: { expected_cash_minor: number } } }>(
        db.pool,
        f.users.ownerA,
        "select public.finance_read($1,$2,'cash',current_date,current_date) r",
        [f.orgA, f.branches.a1],
      )
    )[0].r;
    assert.equal(Number(cash.session.expected_cash_minor), 10900);
    assert.equal(
      (
        await db.pool.query(
          "select count(*)::int n from public.partner_distribution_policies",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.pool.query(
          "select count(*)::int n from pg_constraint where connamespace in ('public'::regnamespace,'app_private'::regnamespace) and not convalidated",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.pool.query(
          "select count(*)::int n from pg_tables t join pg_class c on c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass where t.schemaname in ('public','app_private') and not c.relrowsecurity",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await asUser(
          db.pool,
          f.users.ownerB,
          "select id from public.payments where organization_id=$1",
          [f.orgA],
        )
      ).length,
      0,
    );
    await mkdir("docs/verification", { recursive: true });
    await writeFile(
      "docs/verification/migration-upgrade.json",
      JSON.stringify(
        {
          from: 27,
          existingTablesCompared: tables.length,
          identicalHistoricalRows: true,
          financialRetryPreserved: true,
          expectedCashMinor: "10900",
          policiesEnabled: 0,
          unvalidatedConstraints: 0,
          unprotectedBusinessTables: 0,
          auth: "SQL fixture; real Auth separately in CI",
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS Upgrade: 27 → current, ${tables.length} existing tables identical; exact cash, dedupe, RLS and FKs preserved`,
    );
  } finally {
    await isolated?.stop();
  }
}
