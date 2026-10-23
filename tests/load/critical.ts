import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { isolatedDatabase, asUser } from "../integration/database";
import { fixtures } from "../integration/fixtures";
const before = process.env.SQL_BASELINE === "1";
const db = await isolatedDatabase(before ? 34 : Infinity);
try {
  const f = await fixtures(db.pool);
  const day = new Date().toISOString().slice(0, 10);
  const command = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        db.pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), randomUUID()],
      )
    )[0].r;
  const method = await command("configure", {
    entity: "payment_methods",
    name: "QA bank",
    code: "qa_bank",
    type: "bank",
  });
  await command("configure", {
    entity: "payment_method_fee_rules",
    payment_method_id: method.id,
    percentage_bps: 0,
    fixed_amount_minor: 0,
  });
  await db.pool.query(
    "insert into public.customers(organization_id,name,normalized_phone,home_branch_id) select $1,'QA customer '||n,'+1202666'||lpad(n::text,4,'0'),$2 from generate_series(1,2000)n",
    [f.orgA, f.branches.a1],
  );
  for (let i = 0; i < 250; i++) {
    const checkout = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    const total = (
      await asUser<{ r: { total_minor: number } }>(
        db.pool,
        f.users.ownerA,
        "select public.finance_read_exact($1,$2,'checkout',$3,$3,50,0,'',$4) r",
        [f.orgA, f.branches.a1, day, checkout.id],
      )
    )[0].r.total_minor;
    await command("post_checkout", {
      id: checkout.id,
      payments: [{ payment_method_id: method.id, amount_minor: Number(total) }],
    });
  }
  await db.pool.query("analyze");
  const cases: {
    name: string;
    sql: string;
    params: unknown[];
    user?: string | null;
  }[] = [
    {
      name: "dashboard",
      sql: "select public.dashboard($1,$2,null,$3,$3)",
      params: [f.orgA, f.branches.a1, day],
    },
    {
      name: "agenda",
      sql: "select public.list_agenda($1,$2,null,null,null,$3,$4)",
      params: [f.orgA, f.branches.a1, day + "T00:00:00Z", day + "T23:59:59Z"],
    },
    {
      name: "availability",
      sql: "select public.list_availability($1,$2,$3,$4,$5)",
      params: [f.orgA, f.branches.a1, [f.services.cut], day, f.staff.a1],
    },
    {
      name: "customers",
      sql: "select public.customer_list_view($1,$2,$3,null,50,'all')",
      params: [f.orgA, f.branches.a1, "QA customer 19"],
    },
    ...["cash", "movements", "summary", "expenses", "closures"].map((view) => ({
      name: view,
      sql: "select public.finance_read_exact($1,$2,$3,$4,$4,50,0,'',null)",
      params: [f.orgA, f.branches.a1, view, day],
    })),
    {
      name: "reports",
      sql: "select public.financial_series($1,$2,$3,$3)",
      params: [f.orgA, f.branches.a1, day],
    },
    {
      name: "distributions_disabled",
      sql: "select public.partner_distributions($1,$2,$3,$3)",
      params: [f.orgA, f.branches.a1, day],
    },
    {
      name: "public_catalog",
      sql: "select public.public_catalog($1,$2,null)",
      params: [f.bookingSecret, "fixture-a"],
      user: null,
    },
  ];
  const reports = [];
  for (const c of cases) {
    const times: number[] = [];
    for (let n = 0; n < 20; n++) {
      const start = performance.now();
      await asUser(
        db.pool,
        c.user === undefined ? f.users.ownerA : c.user,
        c.sql,
        c.params,
      );
      times.push(performance.now() - start);
    }
    const sorted = times.sort((a, b) => a - b);
    const plan = await asUser(
      db.pool,
      c.user === undefined ? f.users.ownerA : c.user,
      "explain (analyze,buffers,format json) " + c.sql,
      c.params,
    );
    reports.push({
      name: c.name,
      samples: 20,
      p50_ms: sorted[9],
      p95_ms: sorted[18],
      p99_ms: sorted[19],
      plan,
    });
  }
  const scans = [];
  for (const [name, sql, params] of [
    [
      "customer_index",
      "select id from public.customers where organization_id=$1 and normalized_phone like '+1202666%' order by normalized_phone limit 50",
      [f.orgA],
    ],
    [
      "agenda_range",
      "select id from public.appointments where organization_id=$1 and branch_id=$2 and starts_at>=$3::date and starts_at<$3::date+interval '1 day' order by starts_at limit 100",
      [f.orgA, f.branches.a1, day],
    ],
    [
      "financial_movements",
      "select id from public.payments where organization_id=$1 and branch_id=$2 order by occurred_at desc,id desc limit 50",
      [f.orgA, f.branches.a1],
    ],
  ] as const) {
    scans.push({
      name,
      plan: await asUser(
        db.pool,
        f.users.ownerA,
        "explain (analyze,buffers,format json) " + sql,
        [...params],
      ),
    });
  }
  const counts = (
    await db.pool.query(
      "select (select count(*) from public.customers) customers,(select count(*) from public.checkouts) checkouts,(select count(*) from public.payments) payments",
    )
  ).rows[0];
  assert.equal(Number(counts.payments), 250);
  await mkdir("docs/verification/definitive", { recursive: true });
  await writeFile(
    `docs/verification/definitive/sql-${before ? "before" : "after"}.json`,
    JSON.stringify(
      {
        phase: before ? "before" : "after",
        migrations: before ? 34 : 36,
        environment: {
          postgres: "17 embedded",
          node: process.version,
          cpu: os.cpus()[0].model,
          logical_cpus: os.cpus().length,
        },
        counts,
        reports,
        scans,
        limits:
          "Synthetic isolated SQL only, 20 serial samples; no network/HTTP/Auth-provider cost. Function plans are opaque Result nodes; complementary RLS table plans are included. Disabled distributions are measured as disabled, never activated to improve benchmark.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      suite: "critical-query-plans",
      phase: before ? "before" : "after",
      counts,
      queries: reports.map(({ name, p50_ms, p95_ms, p99_ms }) => ({
        name,
        p50_ms,
        p95_ms,
        p99_ms,
      })),
    }),
  );
} finally {
  await db.stop();
}
