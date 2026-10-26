// Supplies only claims from a newly signed, verified, genuine owner AAL2 session.
// No invented sub/aal/session, service-role business permission or stored password.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { confirmed1717Sql } from "./configure-confirmed-1717.mjs";

const project = "tbcfhagteyqufjkmbxzz";
const email = "ortegatiago733@gmail.com";
const org = "db03ca0c-48cc-46d2-bcbe-86c6ba8525d4";
const branch = "1c10857c-c9da-442a-a1cb-46edd114832d";
const root = path.resolve(
  process.env.LOCALAPPDATA!,
  "BarberiaOS/private-backups",
  project,
  "activation-20261026",
);
await mkdir(root, { recursive: true });
const options = {
  projectRef: project,
  organizationId: org,
  branchId: branch,
  estebanId: "7b161038-cc4c-49ef-8505-6f63a1cb8998",
  jonatanId: "a66354c2-2bdf-46cb-98e4-fd6389d8fd7c",
  effectiveDate: formatInTimeZone(new Date(), "America/Asuncion", "yyyy-MM-dd"),
};
const plan = await confirmed1717Sql(options);
await writeFile(path.join(root, "reviewed-plan.sql"), plan, { mode: 0o600 });
if (process.env.TASK_ACTIVATION_ACTION === "Plan") {
  console.log(
    JSON.stringify({
      project,
      effective_date: options.effectiveDate,
      plan: path.join(root, "reviewed-plan.sql"),
      intended: {
        services: 8,
        capabilities: 16,
        weekly_intervals: 18,
        booking: false,
      },
      applied: false,
    }),
  );
} else {
  assert.equal(process.env.TASK_ACTIVATION_ACTION, "Apply");
  const migrations = JSON.parse(
    await readFile(
      "docs/verification/activation-20261026/production-migrations.json",
      "utf8",
    ),
  );
  assert.equal(migrations.status, "PASSED");
  assert.equal(migrations.project, project);
  const client = createClient(
    `https://${project}.supabase.co`,
    "sb_publishable_W3EqFwWaas4YZXdOjhCgMg_I8ENjme6",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const password = process.env.TASK_ACTIVATION_PASSWORD!;
  const code = process.env.TASK_ACTIVATION_TOTP!;
  delete process.env.TASK_ACTIVATION_PASSWORD;
  delete process.env.TASK_ACTIVATION_TOTP;
  const privateSql = path.join(root, "authenticated-apply.sql");
  try {
    const signed = await client.auth.signInWithPassword({ email, password });
    assert.ok(
      !signed.error && signed.data.user?.email_confirmed_at,
      "Owner sign-in and confirmed email required",
    );
    assert.equal(signed.data.user.id, "e6046c7c-bcbb-4a21-afe4-485a849148cd");
    const factors = await client.auth.mfa.listFactors();
    assert.equal(factors.error, null);
    const factor = factors.data!.totp.find((f) => f.status === "verified");
    assert.ok(factor, "Existing verified personal TOTP required");
    const mfa = await client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    assert.equal(mfa.error, null, "Personal MFA verification failed");
    const identity = await client.auth.getUser();
    assert.equal(identity.data.user?.id, signed.data.user.id);
    const verified = await client.auth.getClaims();
    assert.equal(verified.error, null);
    const claims = verified.data!.claims;
    assert.equal(claims.sub, signed.data.user.id);
    assert.equal(claims.aal, "aal2");
    assert.ok(typeof claims.session_id === "string");
    const membership = await client
      .from("organization_memberships")
      .select("role,active,all_branches")
      .eq("organization_id", org)
      .eq("profile_id", claims.sub)
      .single();
    assert.equal(membership.error, null);
    assert.equal(membership.data!.role, "organization_owner");
    assert.equal(membership.data!.active, true);
    const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
    // The exact verified token claims are passed unchanged to maintenance SQL.
    // Database current_profile/security checks still validate the live Auth session.
    const context = `begin;\nselect set_config('request.jwt.claims',${literal(JSON.stringify(claims))},true);\nselect set_config('request.jwt.claim.sub',${literal(claims.sub)},true);\n`;
    const closeGate = `select public.manage_record('${org}','organization_settings',(select id from public.organization_settings where organization_id='${org}'),null,'{"booking_enabled":false}'::jsonb) where exists(select 1 from public.organization_settings where organization_id='${org}' and booking_enabled);\n`;
    const sql = plan.replace("begin;", context + closeGate);
    await writeFile(privateSql, sql, { mode: 0o600 });
    try {
      execFileSync(
        process.execPath,
        [
          "node_modules/supabase/dist/supabase.js",
          "db",
          "query",
          "--linked",
          "--project-ref",
          project,
          "--file",
          privateSql,
          "--output",
          "json",
        ],
        { stdio: ["ignore", "pipe", "pipe"], timeout: 180000 },
      );
    } catch {
      throw new Error(
        "Authorized configuration transaction failed; no partial plan is accepted",
      );
    }
    await writeFile(
      "docs/verification/activation-20261026/operational-apply.json",
      JSON.stringify(
        {
          checked_at: new Date().toISOString(),
          project,
          actor: claims.sub,
          authentication:
            "genuine GoTrue sign-in + personal TOTP + verified token claims + live owner membership",
          effective_date: options.effectiveDate,
          status: "APPLIED_REQUIRES_READBACK",
        },
        null,
        2,
      ),
    );
    console.log(
      "Plan confirmado aplicado en una transaccion con tu sesion owner AAL2 real. Codex debe reconsultar catalogo, horarios e integridad.",
    );
  } catch {
    console.error(
      "Configuracion NO aprobada. No se imprimen credenciales, claims ni errores SQL privados.",
    );
    process.exitCode = 1;
  } finally {
    await client.auth.signOut({ scope: "local" });
    await unlink(privateSql).catch(() => {});
  }
}
