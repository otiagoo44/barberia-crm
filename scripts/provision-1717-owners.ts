// Explicitly requested real owner provisioning. Never confirms email, enrolls MFA,
// resets an existing person's password, creates platform_admin or prints secrets.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const project = "tbcfhagteyqufjkmbxzz",
  org = "db03ca0c-48cc-46d2-bcbe-86c6ba8525d4",
  branch = "1c10857c-c9da-442a-a1cb-46edd114832d";
const root = path.join(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/private-backups",
  project,
  "owner-provisioning-20261026",
);
await mkdir(root, { recursive: true });
const cli = (...args: string[]) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ["node_modules/supabase/dist/supabase.js", ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 },
    ),
  );
async function query(sql: string) {
  const file = path.join(root, "provision.sql");
  await writeFile(file, sql, { mode: 0o600 });
  return cli(
    "db",
    "query",
    "--linked",
    "--project-ref",
    project,
    "--file",
    file,
    "--output",
    "json",
  ).rows;
}
const proof = JSON.parse(
  await readFile(
    "docs/verification/activation-20261026/initial-password-e2e.json",
    "utf8",
  ),
);
assert.equal(proof.project, "zdogqqmitpbwjgohwcww");
assert.equal(proof.status, "PASSED");
assert.equal(
  (
    await query(
      "select count(*)::int n from supabase_migrations.schema_migrations where version='20261026203759'",
    )
  )[0].n,
  1,
  "Forced-password migration must be present before provisioning",
);
const password = process.env.TASK_OWNER_TEMP_PASSWORD!;
delete process.env.TASK_OWNER_TEMP_PASSWORD;
assert.ok(
  password?.length >= 12 && password.length <= 128,
  "A privately supplied temporary password is required",
);
const keys = cli(
  "projects",
  "api-keys",
  "--project-ref",
  project,
  "--reveal",
  "--output",
  "json",
);
const admin = createClient(
  `https://${project}.supabase.co`,
  keys.find((k: { type: string }) => k.type === "secret").api_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const owners = [
  {
    name: "Esteban",
    email: "estebanras15@gmail.com",
    staff: "7b161038-cc4c-49ef-8505-6f63a1cb8998",
  },
  {
    name: "Jonatan",
    email: "jonatanramos2005oviedo@gmail.com",
    staff: "a66354c2-2bdf-46cb-98e4-fd6389d8fd7c",
  },
];
const pendingFile = path.join(root, "created-identities.json");
type Created = { id: string; email: string; staff: string };
let created: Created[] = [];
try {
  created = JSON.parse(await readFile(pendingFile, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const existing = await query(
  "begin read only;select id,email from auth.users where lower(email) in('estebanras15@gmail.com','jonatanramos2005oviedo@gmail.com');commit;",
);
for (const owner of owners) {
  const prior = existing.find(
    (u: { email: string; id: string }) => u.email.toLowerCase() === owner.email,
  );
  if (prior) {
    assert.ok(
      created.some((c) => c.id === prior.id && c.email === owner.email),
      "An existing person's account must not be overwritten",
    );
    continue;
  }
  const response = await admin.auth.admin.createUser({
    email: owner.email,
    password,
    email_confirm: false,
    user_metadata: { full_name: owner.name },
  });
  assert.ok(
    !response.error && response.data.user,
    "Requested owner account creation failed; no passwords are logged",
  );
  assert.ok(!response.data.user.email_confirmed_at);
  created.push({
    id: response.data.user.id,
    email: owner.email,
    staff: owner.staff,
  });
  await writeFile(pendingFile, JSON.stringify(created), { mode: 0o600 });
}
assert.equal(created.length, 2);
const statements = created.map((c) => {
  assert.match(c.id, /^[a-f0-9-]{36}$/);
  return `do $owner$ begin
 if not exists(select 1 from auth.users where id='${c.id}' and lower(email)='${c.email}') then raise exception 'owner_identity_changed';end if;
 if exists(select 1 from public.staff where id='${c.staff}' and organization_id='${org}' and profile_id is not null and profile_id<>'${c.id}') then raise exception 'staff_already_linked';end if;
 if not exists(select 1 from app_private.required_password_changes where profile_id='${c.id}') then
  insert into app_private.required_password_changes(profile_id) values('${c.id}');
  insert into public.organization_memberships(organization_id,profile_id,role,all_branches,active) values('${org}','${c.id}','organization_owner',true,true)
  on conflict(organization_id,profile_id) do update set role='organization_owner',all_branches=true,active=true;
  update public.staff set profile_id='${c.id}' where id='${c.staff}' and organization_id='${org}';
  perform app_private.record_audit('${org}','${branch}','1717.owner_provisioned','profiles','${c.id}',jsonb_build_object('source','user-authorized Supabase management provisioning','email_confirmed',false,'must_change_password',true,'mfa','personal enrollment required','requested_by_profile','e6046c7c-bcbb-4a21-afe4-485a849148cd'),gen_random_uuid());
 end if;
 end $owner$;`;
});
await query(
  "begin;set local lock_timeout='5s';" +
    statements.join("\n") +
    "commit;select true applied;",
);
const verified =
  await query(`begin read only;select u.id,u.email,u.email_confirmed_at is not null email_confirmed,m.role,m.active,m.all_branches,s.slug staff,
exists(select 1 from app_private.required_password_changes r where r.profile_id=u.id and r.completed_at is null) must_change_password,
exists(select 1 from app_private.platform_admins p where p.profile_id=u.id) platform_admin,
(select count(*)::int from auth.mfa_factors f where f.user_id=u.id and f.status='verified') verified_factors
from auth.users u join public.organization_memberships m on m.profile_id=u.id and m.organization_id='${org}' join public.staff s on s.profile_id=u.id and s.organization_id='${org}' where lower(u.email) in('estebanras15@gmail.com','jonatanramos2005oviedo@gmail.com') order by u.email;commit;`);
assert.equal(verified.length, 2);
for (const owner of verified) {
  assert.equal(owner.role, "organization_owner");
  assert.equal(owner.platform_admin, false);
  assert.equal(owner.must_change_password, true);
  assert.equal(owner.email_confirmed, false);
  assert.equal(owner.verified_factors, 0);
}
await writeFile(
  "docs/verification/activation-20261026/owner-provisioning.json",
  JSON.stringify(
    {
      checked_at: new Date().toISOString(),
      project,
      status: "PREPARED_REQUIRES_PERSONAL_CONFIRMATION_MFA_AND_PASSWORD",
      owners: verified,
      temporary_password: "user-supplied; never stored in repository or logs",
      emails_sent: 0,
    },
    null,
    2,
  ),
);
console.log(
  "Both owners provisioned and linked. Email remains unconfirmed, MFA personal, temporary password change enforced. No existing user password was reset.",
);
