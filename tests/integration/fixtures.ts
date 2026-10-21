import { randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
export type FixtureUsers = Record<
  "ownerA" | "managerA1" | "receptionA" | "barberA" | "ownerB" | "platform",
  string
>;
export async function fixtures(
  pool: Pool,
  registeredUsers?: FixtureUsers,
  namespace = "fixture",
) {
  const users = registeredUsers ?? {
    ownerA: randomUUID(),
    managerA1: randomUUID(),
    receptionA: randomUUID(),
    barberA: randomUUID(),
    ownerB: randomUUID(),
    platform: randomUUID(),
  };
  if (!registeredUsers)
    for (const [key, id] of Object.entries(users))
      await pool.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
        [id, `${key}@fixture.invalid`, JSON.stringify({ full_name: key })],
      );
  const orgA = randomUUID(),
    orgB = randomUUID();
  // Only isolated SQL fixtures use synthetic sessions. Browser/HTTP tests sign in
  // through GoTrue and prove enforcement using genuine signed AAL1/AAL2 tokens.
  if (registeredUsers)
    for (const id of Object.values(users))
      await pool.query(
        "insert into auth.sessions(id,user_id) values($1,$1) on conflict do nothing",
        [id],
      );
  for (const [id, slug] of [
    [orgA, `${namespace}-a`],
    [orgB, `${namespace}-b`],
  ]) {
    await pool.query(
      "insert into public.organizations(id,name,slug,timezone,currency) values($1,$2,$2,'Etc/UTC','USD')",
      [id, slug],
    );
    await pool.query(
      "insert into public.organization_settings(organization_id,booking_enabled,booking_lead_minutes,default_return_days) values($1,true,0,21)",
      [id],
    );
  }
  const branches = { a1: randomUUID(), a2: randomUUID(), b1: randomUUID() };
  for (const [name, id] of Object.entries(branches)) {
    const org = name === "b1" ? orgB : orgA;
    await pool.query(
      "insert into public.branches(id,organization_id,name,slug,timezone) values($1,$2,$3,$3,'Etc/UTC')",
      [id, org, name],
    );
    await pool.query(
      "insert into public.branch_settings(organization_id,branch_id,booking_enabled) values($1,$2,true)",
      [org, id],
    );
    for (let weekday = 0; weekday < 7; weekday++)
      await pool.query(
        "insert into public.branch_business_hours(organization_id,branch_id,weekday,opens_at,closes_at) values($1,$2,$3,'00:00','24:00')",
        [org, id, weekday],
      );
  }
  const memberIds: Record<string, string> = {};
  for (const [name, id] of Object.entries(users)) {
    if (name === "platform") continue;
    const role = name.startsWith("owner")
      ? "organization_owner"
      : name === "managerA1"
        ? "manager"
        : name === "receptionA"
          ? "receptionist"
          : "barber";
    const org = name === "ownerB" ? orgB : orgA;
    const all = role === "organization_owner" || role === "receptionist";
    const member = randomUUID();
    memberIds[name] = member;
    await pool.query(
      "insert into public.organization_memberships(id,organization_id,profile_id,role,all_branches) values($1,$2,$3,$4,$5)",
      [member, org, id, role, all],
    );
    if (!all)
      await pool.query(
        "insert into public.membership_branch_access(organization_id,membership_id,branch_id) values($1,$2,$3)",
        [org, member, branches.a1],
      );
  }
  await pool.query(
    "insert into app_private.platform_admins(profile_id) values($1) on conflict do nothing",
    [users.platform],
  );
  const staff = {
    a1: randomUUID(),
    a2: randomUUID(),
    a3: randomUUID(),
    b1: randomUUID(),
  };
  for (const [name, id] of Object.entries(staff)) {
    const org = name === "b1" ? orgB : orgA;
    const branch = name === "b1" ? branches.b1 : branches.a1;
    await pool.query(
      "insert into public.staff(id,organization_id,name,slug,profile_id) values($1,$2,$3,$3,$4)",
      [id, org, name, name === "a1" ? users.barberA : null],
    );
    await pool.query(
      "insert into public.staff_branch_assignments(organization_id,branch_id,staff_id) values($1,$2,$3)",
      [org, branch, id],
    );
    for (let weekday = 0; weekday < 7; weekday++)
      await pool.query(
        "insert into public.staff_availability_rules(organization_id,branch_id,staff_id,weekday,starts_at,ends_at) values($1,$2,$3,$4,'00:00','24:00')",
        [org, branch, id, weekday],
      );
  }
  await pool.query(
    "insert into public.staff_branch_assignments(organization_id,branch_id,staff_id) values($1,$2,$3)",
    [orgA, branches.a2, staff.a1],
  );
  const services = {
    cut: randomUUID(),
    curl: randomUUID(),
    wash: randomUUID(),
    design: randomUUID(),
    override: randomUUID(),
    bcut: randomUUID(),
  };
  const defs = [
    ["cut", 40, "standalone", null],
    ["curl", 120, "standalone", null],
    ["wash", 10, "additive", null],
    ["design", 10, "included", services.cut],
    ["override", 50, "override", services.cut],
    ["bcut", 40, "standalone", null],
  ] as const;
  for (const [key, duration, mode, base] of defs) {
    const org = key === "bcut" ? orgB : orgA;
    const service = services[key];
    await pool.query(
      "insert into public.services(id,organization_id,name,slug,default_duration_minutes,composition_mode,base_service_id,suggested_return_days) values($1,$2,$3,$3,$4,$5,$6,21)",
      [service, org, key, duration, mode, base],
    );
    for (const branch of org === orgA
      ? [branches.a1, branches.a2]
      : [branches.b1])
      await pool.query(
        "insert into public.branch_services(organization_id,branch_id,service_id,price_minor) values($1,$2,$3,2000)",
        [org, branch, service],
      );
    for (const [staffKey, staffId] of Object.entries(staff)) {
      if ((staffKey === "b1") === (org === orgB))
        await pool.query(
          "insert into public.staff_service_capabilities(organization_id,staff_id,service_id) values($1,$2,$3)",
          [org, staffId, service],
        );
    }
  }
  const customers = { a1: randomUUID(), a2: randomUUID(), b1: randomUUID() };
  for (const [key, id] of Object.entries(customers)) {
    const org = key === "b1" ? orgB : orgA;
    await pool.query(
      "insert into public.customers(id,organization_id,name,normalized_phone,home_branch_id) values($1,$2,$3,$4,$5)",
      [
        id,
        org,
        `Customer ${key}`,
        key === "a2" ? "+12025550102" : "+12025550101",
        branches[key as keyof typeof branches],
      ],
    );
  }
  const bookingSecret = "test-booking-secret-".repeat(4);
  const workerSecret = "test-worker-secret-".repeat(4);
  for (const [name, value] of [
    ["booking", bookingSecret],
    ["worker", workerSecret],
  ])
    await pool.query(
      "insert into app_private.gateway_credentials(name,secret_hash) values($1,$2) on conflict do nothing",
      [name, createHash("sha256").update(value).digest("hex")],
    );
  return {
    users,
    memberIds,
    orgA,
    orgB,
    branches,
    staff,
    services,
    customers,
    bookingSecret,
    workerSecret,
  };
}
