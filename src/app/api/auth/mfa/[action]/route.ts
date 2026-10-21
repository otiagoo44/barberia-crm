import { z } from "zod";
import { requireIdentity } from "@/lib/auth";
import { correlationId, fail, HttpError, readJson, response } from "@/lib/http";

export const dynamic = "force-dynamic";
function providerFailure(
  error: { code?: string } | null,
  requestId: string,
): never {
  const code = error?.code;
  console.warn(
    JSON.stringify({
      level: "warn",
      request_id: requestId,
      event: "auth.mfa_failed",
      provider_code:
        code && /^[a-z0-9_]{1,60}$/i.test(code) ? code : "unavailable",
    }),
  );
  throw new HttpError(400, "mfa_failed");
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const id = correlationId(request);
  try {
    const raw = await readJson(request, 2048);
    const { action } = await params;
    const { db, security } = await requireIdentity();
    if (action === "enroll") {
      const p = z
        .object({ name: z.string().trim().min(1).max(60) })
        .strict()
        .parse(raw);
      const factors = await db.auth.mfa.listFactors();
      if (factors.error) providerFailure(factors.error, id);
      if (
        factors.data.all.some((f) => f.status === "verified") &&
        security.level !== "aal2"
      )
        throw new HttpError(403, "mfa_required");
      const { data, error } = await db.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: p.name,
        issuer: "Barbería OS",
      });
      if (error) providerFailure(error, id);
      return response(
        { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret },
        id,
      );
    }
    if (action === "verify") {
      const p = z
        .object({ factor: z.uuid(), code: z.string().regex(/^\d{6}$/) })
        .strict()
        .parse(raw);
      const { error } = await db.auth.mfa.challengeAndVerify({
        factorId: p.factor,
        code: p.code,
      });
      if (error) providerFailure(error, id);
      return response({ ok: true }, id);
    }
    if (action === "unenroll") {
      const p = z.object({ factor: z.uuid() }).strict().parse(raw);
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) providerFailure(error, id);
      const target = data.all.find((f) => f.id === p.factor);
      if (!target) throw new HttpError(404, "not_found");
      if (target.status === "verified") {
        if (security.level !== "aal2") throw new HttpError(403, "mfa_required");
        if (
          security.required &&
          data.all.filter((f) => f.status === "verified").length < 2
        )
          throw new HttpError(409, "mfa_last_factor");
      }
      const result = await db.auth.mfa.unenroll({ factorId: p.factor });
      if (result.error) providerFailure(result.error, id);
      return response({ ok: true }, id);
    }
    throw new HttpError(404, "not_found");
  } catch (error) {
    return fail(error, id);
  }
}
