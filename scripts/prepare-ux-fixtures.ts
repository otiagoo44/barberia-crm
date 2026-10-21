import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { fixtures } from "../tests/integration/fixtures";
import { asUser } from "../tests/integration/database";
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.LOCAL_DB_URL!).hostname,
  )
)
  throw Error("UX fixtures require isolated local Supabase");
const auth = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
const pool = new Pool({ connectionString: process.env.LOCAL_DB_URL });
try {
  const f = await fixtures(pool, auth.users, "ux");
  await asUser(
    pool,
    f.users.ownerA,
    "select public.manage_membership($1,'financeA@fixture.invalid','finance',false,$2,true)",
    [f.orgA, [f.branches.a1]],
  );
  await pool.query(
    "update public.organizations set name='Barbería de prueba · QA',currency='PYG',brand_color='#3e4095' where id=$1",
    [f.orgA],
  );
  await pool.query(
    "update public.branches set name=case when id=$2 then 'Centro · QA' else 'Segundo local · QA' end where organization_id=$1",
    [f.orgA, f.branches.a1],
  );
  await pool.query(
    "update public.branch_services set price_minor=40000 where organization_id=$1",
    [f.orgA],
  );
  await pool.query(
    "update public.staff set name=case when id=$2 then 'A · Profesional QA' else 'Profesional QA · '||slug end where organization_id=$1",
    [f.orgA, f.staff.a1],
  );
  await pool.query(
    "update public.customers set name='Cliente de prueba · QA',return_interval_days=21 where id=$1",
    [f.customers.a1],
  );
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    "update public.organization_settings set booking_enabled=false where organization_id=$1",
    [f.orgA],
  );
  await pool.query(
    "update public.customers set expected_return_at=$2::timestamptz+interval '20 days' where id=$1",
    [f.customers.a1, today + "T10:40:00Z"],
  );
  for (let offset = -6; offset <= 1; offset++) {
    const day = new Date(today + "T12:00:00Z");
    day.setUTCDate(day.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    await pool.query(
      "insert into public.staff_availability_exceptions(organization_id,branch_id,staff_id,local_date,starts_at,ends_at,available,reason) values($1,$2,$3,$4,'09:00','18:00',true,'Franja fixture QA'),($1,$2,$3,$4,'12:00','13:00',false,'Descanso fixture QA')",
      [f.orgA, f.branches.a1, f.staff.a1, date],
    );
    const start = date + "T10:00:00Z";
    // Historical fixture rows are explicitly synthetic. Financial payments below
    // still use the real transactional commands; browser reads use real Auth.
    const id = randomUUID();
    await pool.query(
      "insert into public.appointments(id,organization_id,branch_id,staff_id,customer_id,starts_at,ends_at,duration_minutes,status,currency,price_minor,completed_at) values($1,$2,$3,$4,$5,$6,$6::timestamptz+interval '40 minutes',40,$7,'PYG',40000,case when $7='completed' then $6::timestamptz+interval '40 minutes' else null end)",
      [
        id,
        f.orgA,
        f.branches.a1,
        f.staff.a1,
        f.customers.a1,
        start,
        offset < 0 ? "completed" : "confirmed",
      ],
    );
    await pool.query(
      "insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) values($1,$2,$3,'Corte de prueba',40,40000,'standalone')",
      [f.orgA, id, f.services.cut],
    );
    await pool.query("select app_private.rebuild_metric_day($1,$2,$3)", [
      f.orgA,
      f.branches.a1,
      date,
    ]);
  }
  const command = async (action: string, data: object) =>
    (
      await asUser<{ r: { id: string } }>(
        pool,
        f.users.ownerA,
        "select public.finance_command($1,$2,$3,$4,$5) r",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), randomUUID()],
      )
    )[0].r;
  const methods = [];
  for (const [name, type, bps] of [
    ["Efectivo", "cash", 0],
    ["Transferencia", "bank", 0],
    ["Débito", "card", 250],
    ["Crédito", "card", 450],
  ] as const) {
    const m = await command("configure", {
      entity: "payment_methods",
      name,
      code: "qa_" + type + "_" + bps,
      type,
    });
    methods.push(m.id);
    await command("configure", {
      entity: "payment_method_fee_rules",
      payment_method_id: m.id,
      percentage_bps: bps,
      fixed_amount_minor: 0,
    });
  }
  const session = await command("open_cash_session", {
    opening_amount_minor: 100000,
  });
  await command("configure", {
    entity: "commission_rules",
    staff_id: f.staff.a1,
    service_id: f.services.cut,
    rate_bps: 4000,
  });
  for (let i = 0; i < 4; i++) {
    const sale = await command("create_checkout", {
      lines: [
        { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
      ],
    });
    await command("record_payment", {
      checkout_id: sale.id,
      payment_method_id: methods[i],
      amount_minor: 40000,
      cash_session_id: session.id,
    });
    await command("post_checkout", { id: sale.id });
  }
  const checkout = await command("create_checkout", {
    lines: [{ service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 }],
  });
  await writeFile(
    ".test-data/e2e/ux-fixtures.json",
    JSON.stringify({
      ...f,
      password: auth.password,
      mfa: auth.mfa,
      today,
      checkout: checkout.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    "Prepared labeled UX tenant, recorded payments through financial RPCs; no production data.",
  );
} finally {
  await pool.end();
}
