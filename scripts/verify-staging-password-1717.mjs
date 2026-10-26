import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
const project = "zdogqqmitpbwjgohwcww",
  base = "http://localhost:3008";
const f = JSON.parse(
  await readFile(".test-data/staging-activation/fixtures.json", "utf8"),
);
const cli = (...args) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ["node_modules/supabase/dist/supabase.js", ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
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
const url = `https://${project}.supabase.co`;
const admin = createClient(url, keys.find((k) => k.type === "secret").api_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `initial-password-${randomUUID()}@fixture.invalid`,
  password = randomBytes(24).toString("base64url"),
  replacement = randomBytes(24).toString("base64url");
// generateLink does not send mail. Only this .invalid fixture consumes its token.
const generated = await admin.auth.admin.generateLink({
  type: "signup",
  email,
  password,
});
assert.equal(generated.error, null);
const user = generated.data.user.id;
const client = createClient(url, f.publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});
assert.equal(
  (await client.auth.signInWithPassword({ email, password })).error?.code,
  "email_not_confirmed",
);
await writeFile(
  ".test-data/staging-activation/password-fixture.sql",
  `begin;insert into app_private.required_password_changes(profile_id) values('${user}');insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values('${f.orgA}','${user}','organization_owner',true);commit;select true prepared;`,
  { mode: 0o600 },
);
cli(
  "db",
  "query",
  "--linked",
  "--project-ref",
  project,
  "--file",
  ".test-data/staging-activation/password-fixture.sql",
  "--output",
  "json",
);
function totp(secret) {
  let bits = "";
  for (const c of secret)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const b = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    b.push(parseInt(bits.slice(i, i + 8), 2));
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(b)).update(count).digest(),
    o = h[h.length - 1] & 15;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const browser = await chromium.launch();
const page = await browser.newPage();
const headers = { Origin: base };
try {
  await page.goto(
    base +
      "/auth/callback?type=signup&token_hash=" +
      encodeURIComponent(generated.data.properties.hashed_token),
  );
  await expect(page).toHaveURL(/\/mfa\?next=reset-password$/);
  const resource = `${base}/api/finance/summary?org=${f.orgA}&branch=${f.branches.a1}&from=2026-10-01&to=2026-10-26`;
  assert.equal((await page.request.get(resource)).status(), 403);
  const enrolled = await page.request.post(base + "/api/auth/mfa/enroll", {
    headers,
    data: { name: "Synthetic forced-password authenticator" },
  });
  assert.equal(enrolled.status(), 200);
  const factor = await enrolled.json();
  assert.equal(
    (
      await page.request.post(base + "/api/auth/mfa/verify", {
        headers,
        data: { factor: factor.id, code: totp(factor.secret) },
      })
    ).status(),
    200,
  );
  await page.goto(base + "/reset-password");
  await expect(
    page.getByText(/Tu cuenta usa una contraseña temporal/),
  ).toBeVisible();
  assert.equal((await page.request.get(resource)).status(), 403);
  assert.equal(
    (
      await page.request.post(base + "/api/auth/password", {
        headers,
        data: { password },
      })
    ).status(),
    400,
  );
  assert.equal((await page.request.get(resource)).status(), 403);
  assert.equal(
    (
      await page.request.post(base + "/api/auth/password", {
        headers,
        data: { password: replacement },
      })
    ).status(),
    200,
  );
  assert.equal((await page.request.get(resource)).status(), 200);
  assert.ok((await client.auth.signInWithPassword({ email, password })).error);
  assert.equal(
    (await client.auth.signInWithPassword({ email, password: replacement }))
      .error,
    null,
  );
  assert.deepEqual((await client.from("customers").select("id")).data, []);
  await page.screenshot({
    path: "docs/verification/activation-20261026/staging-browser/password-change-complete.png",
    fullPage: true,
  });
  await writeFile(
    "docs/verification/activation-20261026/initial-password-e2e.json",
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        project,
        migration: 42,
        synthetic_only: true,
        status: "PASSED",
        checks: [
          "unconfirmed email cannot sign in",
          "genuine signup token confirmed through application callback",
          "business HTTP denied before personal MFA",
          "business denied even at AAL2 before password replacement",
          "same temporary password rejected",
          "actual GoTrue password change clears private DB gate",
          "old temporary password rejected afterwards",
          "MFA still required in a new session",
          "no real owners confirmed or enrolled by test",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASSED: genuine staging confirmation → MFA → forced password replacement; HTTP and database gates verified.",
  );
} finally {
  await client.auth.signOut();
  await browser.close();
}
