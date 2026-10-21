import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
export function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, "")) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw new Error("Invalid isolated TOTP fixture");
    bits += n.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function mfaFixture(role: string) {
  const f = JSON.parse(await readFile(".test-data/e2e/fixtures.json", "utf8"));
  return f.mfa?.[role] as { factor: string; secret: string } | undefined;
}
export async function verifyRequest(request: APIRequestContext, role: string) {
  const mfa = await mfaFixture(role);
  if (!mfa) return;
  const r = await request.post("/api/auth/mfa/verify", {
    headers: { Origin: "http://localhost:3000" },
    data: { factor: mfa.factor, code: totp(mfa.secret) },
  });
  if (!r.ok())
    throw new Error(`Real Auth MFA failed for isolated ${role}: ${r.status()}`);
}
export async function verifyClient(client: SupabaseClient, role: string) {
  const mfa = await mfaFixture(role);
  if (!mfa) return;
  const r = await client.auth.mfa.challengeAndVerify({
    factorId: mfa.factor,
    code: totp(mfa.secret),
  });
  if (r.error) throw new Error(`Real Auth MFA failed: ${r.error.code}`);
}
