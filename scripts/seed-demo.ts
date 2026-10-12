import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { fixtures, type FixtureUsers } from "../tests/integration/fixtures";
const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const connection = process.env.LOCAL_DB_URL!;
if (
  !api ||
  !connection ||
  !["localhost", "127.0.0.1"].includes(new URL(api).hostname) ||
  !["localhost", "127.0.0.1"].includes(new URL(connection).hostname)
)
  throw new Error(
    "Demo seed only accepts localhost. Remote targets are blocked.",
  );
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
  throw new Error(
    "Set DEMO_PASSWORD with at least 12 characters; no default password exists.",
  );
const admin = createClient(api, process.env.LOCAL_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const users = {} as FixtureUsers;
for (const name of [
  "ownerA",
  "ownerB",
  "barberA",
  "managerA1",
  "receptionA",
  "platform",
] as const) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${name}@fixture.invalid`,
    password: process.env.DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user)
    throw new Error("Use a fresh local database for demo seed");
  users[name] = data.user.id;
}
const pool = new Pool({ connectionString: connection });
try {
  const f = await fixtures(pool, users);
  await pool.query(
    "update public.organizations set name='Barbería Demo',slug='barberia-demo',timezone='America/Asuncion',currency='PYG' where id=$1",
    [f.orgA],
  );
  await pool.query(
    "update public.branches set name=case when id=$2 then 'Centro' else 'Norte' end,timezone='America/Asuncion' where organization_id=$1",
    [f.orgA, f.branches.a1],
  );
  for (const [id, name] of [
    [f.staff.a1, "Mario"],
    [f.staff.a2, "Lucas"],
    [f.staff.a3, "Juan"],
  ])
    await pool.query("update public.staff set name=$1 where id=$2", [name, id]);
  for (const name of ["Alex", "Nico"]) {
    const id = randomUUID();
    await pool.query(
      "insert into public.staff(id,organization_id,name,slug) values($1,$2,$3,lower($3))",
      [id, f.orgA, name],
    );
    await pool.query(
      "insert into public.staff_branch_assignments(organization_id,branch_id,staff_id) values($1,$2,$3)",
      [f.orgA, f.branches.a2, id],
    );
    await pool.query(
      "insert into public.staff_availability_rules(organization_id,branch_id,staff_id,weekday,starts_at,ends_at) select $1,$2,$3,d,'09:00','18:00' from generate_series(0,6)d",
      [f.orgA, f.branches.a2, id],
    );
    await pool.query(
      "insert into public.staff_service_capabilities(organization_id,staff_id,service_id) select $1,$2,id from public.services where organization_id=$1",
      [f.orgA, id],
    );
  }
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(13, 0, 0, 0);
  await pool.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users.ownerA,
  ]);
  for (const [i, staff] of [f.staff.a1, f.staff.a2, f.staff.a3].entries())
    await pool.query(
      "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null)",
      [
        f.orgA,
        f.branches.a1,
        [i === 2 ? f.services.curl : f.services.cut],
        staff,
        tomorrow.toISOString(),
        f.customers.a1,
        randomUUID(),
      ],
    );
  console.log(
    "DEMO LOCAL creada: /book/barberia-demo. Login ownerA@fixture.invalid; usar tu DEMO_PASSWORD. Tenant B de aislamiento disponible por separado.",
  );
} finally {
  await pool.end();
}
