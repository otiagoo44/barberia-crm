// Read-only production checks; no fixture, booking, claim, fee or financial write.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const project = "tbcfhagteyqufjkmbxzz";
const org = "db03ca0c-48cc-46d2-bcbe-86c6ba8525d4";
const branch = "1c10857c-c9da-442a-a1cb-46edd114832d";
const root = path.resolve(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/private-backups",
  project,
  "migration-20261026",
);
async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const file = path.join(root, "verification-read-only.sql");
  await writeFile(file, "begin read only;\n" + sql + ";\ncommit;", {
    mode: 0o600,
  });
  const raw = execFileSync(
    process.execPath,
    [
      "node_modules/supabase/dist/supabase.js",
      "db",
      "query",
      "--linked",
      "--project-ref",
      project,
      "--file",
      file,
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 },
  );
  return JSON.parse(raw).rows;
}
const manifest = JSON.parse(
  await readFile("config/onboarding/1717.json", "utf8"),
);
const services = await query<{
  slug: string;
  id: string;
  price_minor: string;
  duration_minutes: number;
  consultation_required: boolean;
}>(
  `select s.id,s.slug,bs.price_minor,bs.duration_minutes,s.consultation_required from public.services s join public.branch_services bs on bs.organization_id=s.organization_id and bs.service_id=s.id where s.organization_id='${org}' and bs.branch_id='${branch}' and s.active and bs.active order by s.slug`,
);
assert.equal(services.length, 8);
for (const item of manifest.services) {
  const row = services.find((s) => s.slug === item.slug)!;
  assert.ok(row);
  assert.equal(Number(row.price_minor), item.price_minor);
  assert.equal(row.duration_minutes, item.duration_minutes);
  assert.equal(row.consultation_required, item.consultation_required);
}
assert.equal(
  services.find((s) => s.slug === "tinte-global")!.id,
  "45c14d3a-7491-49a2-ad8d-1cd0f5b44be5",
);
const capabilities = await query<{ slug: string; n: number }>(
  `select s.slug,count(*)::int n from public.staff_service_capabilities c join public.staff s on s.id=c.staff_id where c.organization_id='${org}' group by s.slug order by s.slug`,
);
assert.deepEqual(capabilities, [
  { slug: "esteban", n: 8 },
  { slug: "jonatan", n: 8 },
]);
const weekly = await query(
  `select s.slug,r.weekday,r.starts_at::text,r.ends_at::text from public.staff_availability_rules r join public.staff s on s.id=r.staff_id where r.organization_id='${org}' and (r.valid_from is null or r.valid_from<='2026-10-26') and (r.valid_until is null or r.valid_until>='2026-10-26') order by s.slug,r.weekday,r.starts_at`,
);
assert.equal(weekly.length, 18);
const business = await query<{
  weekday: number;
  opens_at: string;
  closes_at: string;
}>(
  `select weekday,opens_at::text,closes_at::text from public.branch_business_hours where organization_id='${org}' and branch_id='${branch}' order by weekday`,
);
assert.deepEqual(
  business,
  Array.from({ length: 6 }, (_, i) => ({
    weekday: i + 1,
    opens_at: "09:00:00",
    closes_at: "21:00:00",
  })),
);
const availability = await query<{
  staff: string;
  day: string;
  slots: string[];
}>(
  `select s.slug staff,d.day::text,coalesce((select jsonb_agg(to_char(lower(r) at time zone 'America/Asuncion','HH24:MI')||'-'||to_char(upper(r) at time zone 'America/Asuncion','HH24:MI') order by lower(r)) from unnest(app_private.effective_availability('${org}','${branch}',s.id,d.day,true,null)) r),'[]') slots from public.staff s cross join(values(date '2026-10-26'),(date '2026-10-28'),(date '2026-10-31'),(date '2026-11-01'))d(day) where s.organization_id='${org}' order by s.slug,d.day`,
);
for (const row of availability) {
  const expected =
    row.day === "2026-11-01"
      ? []
      : row.staff === "jonatan"
        ? ["13:00-21:00"]
        : [
            "09:00-12:00",
            row.day === "2026-10-28" ? "12:30-13:00" : "12:30-19:00",
          ];
  assert.deepEqual(row.slots, expected);
}
const booking = (
  await query(
    `select s.booking_enabled organization,b.booking_enabled branch,s.booking_lead_minutes lead from public.organization_settings s join public.branch_settings b on b.organization_id=s.organization_id where s.organization_id='${org}' and b.branch_id='${branch}'`,
  )
)[0];
assert.deepEqual(booking, { organization: false, branch: false, lead: 0 });
const baseline = JSON.parse(
  await readFile(path.join(root, "before.json"), "utf8"),
);
const financialNames = new Set([
  "appointments",
  "appointment_services",
  "appointment_status_history",
  "checkouts",
  "checkout_lines",
  "payments",
  "expenses",
  "cash_sessions",
  "cash_movements",
  "settlements",
  "settlement_lines",
  "commission_accruals",
  "financial_adjustments",
  "financial_imports",
  "financial_import_rows",
  "partner_distributions",
  "partner_distribution_approvals",
  "partner_withdrawals",
  "payment_settlements",
]);
const tables = baseline.tables.filter(
  (t: { schema: string; table: string }) =>
    t.schema === "public" && financialNames.has(t.table),
);
assert.ok(tables.length >= 8);
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const current = await query(
  tables
    .map(
      (t: { schema: string; table: string; columns: string[] }) =>
        `select '${t.schema}.${t.table}' name,count(*)::int count,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C")::text,'[]')) fingerprint from(select ${t.columns.map(quote).join(",")} from ${quote(t.schema)}.${quote(t.table)})r`,
    )
    .join(" union all ") + " order by name",
);
const names = new Set(
  tables.map(
    (t: { schema: string; table: string }) => t.schema + "." + t.table,
  ),
);
assert.deepEqual(
  current,
  baseline.rows.filter((r: { name: string }) => names.has(r.name)),
  "Existing commercial/financial history changed unexpectedly",
);
const owners = await query(
  `select c.email,u.id,u.email_confirmed_at is not null confirmed,m.role,m.active membership_active,(select count(*)::int from auth.mfa_factors f where f.user_id=u.id and f.status='verified') verified_factors,s.slug linked_staff from(values('estebanras15@gmail.com'),('jonatanramos2005oviedo@gmail.com'))c(email) left join auth.users u on lower(u.email)=c.email left join public.organization_memberships m on m.profile_id=u.id and m.organization_id='${org}' left join public.staff s on s.profile_id=u.id and s.organization_id='${org}'`,
);
const fees = await query(
  `select m.code,m.active,coalesce(jsonb_agg(jsonb_build_object('bps',r.percentage_bps,'fixed',r.fixed_amount_minor)) filter(where r.id is not null),'[]') current_fee_rules from public.payment_methods m left join public.payment_method_fee_rules r on r.organization_id=m.organization_id and r.payment_method_id=m.id and r.active and r.effective_from<=now() and (r.effective_to is null or r.effective_to>now()) where m.organization_id='${org}' group by m.code,m.active order by m.code`,
);
const verification = {
  checked_at: new Date().toISOString(),
  project,
  status: "PASSED",
  services,
  capabilities,
  weekly,
  business,
  availability,
  booking,
  existing_financial_tables_unchanged: tables.map(
    (t: { table: string }) => t.table,
  ),
  owners,
  fees,
  card_without_fee_rule: "BLOCKED; do not fabricate fees",
  smtp_delivery_recovery: {
    confirmation:
      "user reported successful receipt, MFA and password recovery in own browser",
    status: "USER_CONFIRMED",
  },
};
await writeFile(
  "docs/verification/activation-20261026/production-configuration.json",
  JSON.stringify(verification, null, 2),
);
const receiptPath =
  "docs/verification/activation-20261026/operational-apply.json";
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
receipt.status = "PASSED";
receipt.readback_at = verification.checked_at;
receipt.verified = {
  services: 8,
  capabilities: 16,
  weekly_intervals: 18,
  availability: "Monday/Wednesday/Saturday/Sunday",
  financial_history_unchanged: true,
  booking: "CLOSED",
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
console.log(
  "PASSED: 8 services, 16 capabilities, 18 intervals; authoritative availability and unchanged financial history. Booking closed.",
);
