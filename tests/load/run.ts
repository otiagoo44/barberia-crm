import { isolatedDatabase, asUser } from "../integration/database";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
const db = await isolatedDatabase();
const tenants: {
  org: string;
  branch: string;
  user: string;
  staff: string;
  service: string;
  customer: string;
}[] = [];
const reports: unknown[] = [];
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(
    sorted[
      Math.min(values.length - 1, Math.ceil(p * values.length) - 1)
    ].toFixed(2),
  );
};
const day = (delta: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
async function addTenant(index: number) {
  const pool = db.pool,
    user = randomUUID(),
    org = randomUUID(),
    branches = [randomUUID(), randomUUID()],
    staff = Array.from({ length: 5 }, () => randomUUID()),
    service = randomUUID();
  await pool.query("insert into auth.users(id,email) values($1,$2)", [
    user,
    `load-${index}@fixture.invalid`,
  ]);
  await pool.query(
    "insert into public.organizations(id,name,slug,timezone,currency) values($1,$2,$2,'Etc/UTC','USD')",
    [org, `load-${index}`],
  );
  await pool.query(
    "insert into public.organization_settings(organization_id,booking_lead_minutes,default_return_days) values($1,0,21)",
    [org],
  );
  await pool.query(
    "insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values($1,$2,'organization_owner',true)",
    [org, user],
  );
  for (let i = 0; i < 2; i++) {
    await pool.query(
      "insert into public.branches(id,organization_id,name,slug,timezone) values($1,$2,$3,$3,'Etc/UTC')",
      [branches[i], org, `branch-${i}`],
    );
    await pool.query(
      "insert into public.branch_settings(organization_id,branch_id) values($1,$2)",
      [org, branches[i]],
    );
    await pool.query(
      "insert into public.branch_business_hours(organization_id,branch_id,weekday,opens_at,closes_at) select $1,$2,d,'08:00','18:00' from generate_series(0,6) d",
      [org, branches[i]],
    );
  }
  await pool.query(
    "insert into public.services(id,organization_id,name,slug,default_duration_minutes) values($1,$2,'Corte','corte',40)",
    [service, org],
  );
  await pool.query(
    "insert into public.branch_services(organization_id,branch_id,service_id,price_minor) select $1,b,$3,2000 from unnest($2::uuid[]) b",
    [org, branches, service],
  );
  for (let i = 0; i < 5; i++) {
    const branch = branches[i < 3 ? 0 : 1];
    await pool.query(
      "insert into public.staff(id,organization_id,name,slug) values($1,$2,$3,$3)",
      [staff[i], org, `barber-${i}`],
    );
    await pool.query(
      "insert into public.staff_branch_assignments(organization_id,branch_id,staff_id) values($1,$2,$3)",
      [org, branch, staff[i]],
    );
    await pool.query(
      "insert into public.staff_service_capabilities(organization_id,staff_id,service_id) values($1,$2,$3)",
      [org, staff[i], service],
    );
    await pool.query(
      "insert into public.staff_availability_rules(organization_id,branch_id,staff_id,weekday,starts_at,ends_at) select $1,$2,$3,d,'08:00','18:00' from generate_series(0,6) d",
      [org, branch, staff[i]],
    );
  }
  const customers = (
    await pool.query(
      "insert into public.customers(organization_id,name,normalized_phone,home_branch_id,expected_return_at) select $1,'Cliente '||n,'+1202555'||lpad(n::text,4,'0'),$2,now()+make_interval(days=>n%30-15) from generate_series(1,100) n returning id",
      [org, branches[0]],
    )
  ).rows.map((r) => r.id);
  await pool.query(
    `insert into public.appointments(organization_id,branch_id,staff_id,customer_id,starts_at,ends_at,duration_minutes,status,currency,price_minor,completed_at)
    select $1,($2::uuid[])[case when n%5<3 then 1 else 2 end],($3::uuid[])[n%5+1],($4::uuid[])[n+1],t,t+interval '40 minutes',40,'completed','USD',2000,t+interval '40 minutes'
    from generate_series(0,99)n cross join lateral(select (current_date-1-n/20)::timestamp at time zone 'Etc/UTC'+interval '9 hours'+make_interval(mins=>40*((n%20)/5)) t)time`,
    [org, branches, staff, customers],
  );
  await pool.query(
    "insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) select $1,id,$2,'Corte',40,2000,'standalone' from public.appointments where organization_id=$1",
    [org, service],
  );
  for (const branch of branches)
    for (let d = -6; d <= 0; d++)
      await pool.query("select app_private.rebuild_metric_day($1,$2,$3)", [
        org,
        branch,
        day(d),
      ]);
  tenants.push({
    org,
    branch: branches[0],
    user,
    staff: staff[0],
    service,
    customer: customers[0],
  });
}
async function measure(
  name: string,
  run: (tenant: (typeof tenants)[number], index: number) => Promise<unknown>,
) {
  const timings: number[] = [];
  let errors = 0;
  const samples = 100,
    concurrency = 10;
  for (let start = 0; start < samples; start += concurrency)
    await Promise.all(
      Array.from({ length: concurrency }, async (_, offset) => {
        const index = start + offset;
        const t = tenants[index % tenants.length];
        const begin = performance.now();
        try {
          await run(t, index);
        } catch {
          errors++;
        } finally {
          timings.push(performance.now() - begin);
        }
      }),
    );
  return {
    name,
    samples,
    concurrency,
    p50_ms: percentile(timings, 0.5),
    p95_ms: percentile(timings, 0.95),
    p99_ms: percentile(timings, 0.99),
    errors,
  };
}
try {
  for (const size of [10, 50, 100]) {
    while (tenants.length < size) await addTenant(tenants.length + 1);
    await db.pool.query("analyze");
    const metrics = await Promise.all([
      measure("dashboard", (t) =>
        asUser(db.pool, t.user, "select public.dashboard($1,$2,null,$3,$4)", [
          t.org,
          t.branch,
          day(-6),
          day(0),
        ]),
      ),
      measure("agenda", (t) =>
        asUser(
          db.pool,
          t.user,
          "select public.list_agenda($1,$2,null,null,null,$3,$4)",
          [t.org, t.branch, day(-6) + "T00:00:00Z", day(1) + "T00:00:00Z"],
        ),
      ),
      measure("customer_search", (t) =>
        asUser(
          db.pool,
          t.user,
          "select public.list_customers($1,null,'Cliente 2',null,50,'all')",
          [t.org],
        ),
      ),
      measure("retention", (t) =>
        asUser(
          db.pool,
          t.user,
          "select public.list_customers($1,$2,'',null,50,'overdue')",
          [t.org, t.branch],
        ),
      ),
      measure("booking", (t, index) =>
        asUser(
          db.pool,
          t.user,
          "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null)",
          [
            t.org,
            t.branch,
            [t.service],
            t.staff,
            day(2 + Math.floor(size / 2) + Math.floor(index / size)) +
              "T09:00:00Z",
            t.customer,
            randomUUID(),
          ],
        ),
      ),
    ]);
    const plan = (
      await db.pool.query(
        "explain (analyze,buffers,format json) select id from public.customers where organization_id=$1 and normalized_phone like '+1202555%' order by normalized_phone limit 50",
        [tenants[0].org],
      )
    ).rows[0]["QUERY PLAN"];
    const counts = (
      await db.pool.query(
        "select (select count(*) from public.organizations) organizations,(select count(*) from public.branches) branches,(select count(*) from public.staff) staff,(select count(*) from public.customers) customers,(select count(*) from public.appointments) appointments",
      )
    ).rows[0];
    const report = {
      organizations: size,
      counts,
      metrics,
      phone_search_plan: plan,
      realtime: {
        status: "NOT_TESTED",
        reason:
          "Native PostgreSQL benchmark does not contain Supabase Realtime",
      },
    };
    reports.push(report);
    console.log(JSON.stringify({ organizations: size, counts, metrics }));
  }
  await mkdir("docs/verification", { recursive: true });
  await writeFile(
    "docs/verification/load-results.json",
    JSON.stringify(
      {
        executed_at: new Date().toISOString(),
        environment: {
          postgres: "17 embedded",
          platform: process.platform,
          node: process.version,
          cpu: os.cpus()[0].model,
          logical_cpus: os.cpus().length,
          ram_gib: Math.round(os.totalmem() / 1024 ** 3),
          scope:
            "SQL and PostgreSQL RLS only; not HTTP, managed network, or production capacity",
        },
        reports,
      },
      null,
      2,
    ),
  );
  if (
    reports.some((r) =>
      (r as { metrics: { errors: number }[] }).metrics.some((m) => m.errors),
    )
  )
    throw new Error("Load scenario contained errors; inspect report");
} finally {
  await db.stop();
}
