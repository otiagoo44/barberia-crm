import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError, correlationId, fail, readJson, response } from "@/lib/http";
import {
  calendarAuthorization,
  calendarContext,
  calendarRequest,
  calendarSettings,
  calendarStateHash,
  decryptCalendarSecret,
  encryptCalendarSecret,
  googleOAuth,
  calendarScope,
} from "@/lib/google-calendar";
import { matchesSecret } from "@/lib/secret-auth";
import {
  calendarWorkerRpc,
  syncGoogleCalendar,
} from "@/services/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const payload = z.object({ org: z.uuid(), staff: z.uuid() }).strict();
type Attempt = {
  connection_id: string;
  organization: string;
  staff: string;
  profile: string;
  slug: string;
  name: string;
  timezone: string;
  verifier_cipher: string;
  exchange_key: string;
  calendar_id: string | null;
  google_subject: string | null;
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const id = correlationId(request),
    action = (await params).action;
  let callbackSlug: string | undefined;
  try {
    if (action === "status") {
      const { db } = await requireUser();
      const org = z.uuid().parse(new URL(request.url).searchParams.get("org"));
      const { data, error } = await db.rpc("calendar_user", {
        p_org: org,
        p_action: "status",
        p_data: {},
      });
      if (error) throw error;
      return response(
        {
          ...data,
          configured:
            calendarSettings().configured && data.transport_configured,
        },
        id,
      );
    }
    if (action !== "callback") throw new HttpError(404, "not_found");
    const { db, user } = await requireUser();
    const query = new URL(request.url).searchParams;
    const state = z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(query.get("state"));
    const { data, error } = await db.rpc("calendar_consume", {
      p_hash: calendarStateHash(state),
    });
    if (error) throw error;
    const attempt = data as Attempt;
    callbackSlug = attempt.slug;
    if (query.has("error"))
      throw new HttpError(400, "calendar_authorization_denied");
    const code = z.string().min(1).max(4096).parse(query.get("code"));
    const context = calendarContext(
      attempt.organization,
      attempt.staff,
      attempt.profile,
    );
    const oauth = googleOAuth();
    const { tokens } = await oauth.getToken({
      code,
      codeVerifier: decryptCalendarSecret(attempt.verifier_cipher, context),
      redirect_uri: calendarSettings().redirectUri,
    });
    if (
      !tokens.id_token ||
      !tokens.refresh_token ||
      !tokens.access_token ||
      !tokens.scope?.split(" ").includes(calendarScope)
    )
      throw new HttpError(400, "calendar_permission_required");
    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const google = ticket.getPayload();
    if (
      !google?.email_verified ||
      google.email?.toLowerCase() !== user.email?.toLowerCase() ||
      !google.sub
    )
      throw new HttpError(400, "calendar_email_mismatch");
    let calendarId =
      attempt.google_subject === google.sub ? attempt.calendar_id : null;
    if (calendarId) {
      const existing = await calendarRequest(
        `/calendars/${encodeURIComponent(calendarId)}`,
        tokens.access_token,
      );
      if ([404, 410].includes(existing.status)) calendarId = null;
      else if (!existing.ok)
        throw new HttpError(502, "calendar_provider_unavailable");
    }
    if (!calendarId) {
      const created = await calendarRequest("/calendars", tokens.access_token, {
        method: "POST",
        body: JSON.stringify({
          summary: `${attempt.name} · Barbería OS`,
          timeZone: attempt.timezone,
          description:
            "Turnos del CRM. Gestioná cambios y cancelaciones desde Barbería OS.",
        }),
      });
      if (!created.ok)
        throw new HttpError(502, "calendar_provider_unavailable");
      calendarId = z
        .string()
        .min(1)
        .max(1024)
        .parse((await created.json()).id);
    }
    await calendarWorkerRpc("authorize", {
      connection: attempt.connection_id,
      exchange_key: attempt.exchange_key,
      refresh_cipher: encryptCalendarSecret(tokens.refresh_token, context),
      calendar_id: calendarId,
      google_subject: google.sub,
      email: google.email,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL(
          `/${encodeURIComponent(attempt.slug)}/equipo?calendar=connected`,
          calendarSettings().origin,
        ).href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (action === "callback") {
      // OAuth errors may carry codes/tokens. Never serialize or log the error.
      const allowed =
        error instanceof HttpError &&
        [
          "calendar_email_mismatch",
          "calendar_authorization_denied",
          "calendar_permission_required",
        ].includes(error.code)
          ? error.code
          : "calendar_connect_failed";
      const destination = callbackSlug
        ? `/${encodeURIComponent(callbackSlug)}/equipo`
        : "/";
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL(
            `${destination}?calendar=${allowed}`,
            calendarSettings().origin,
          ).href,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    return fail(error, id);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const id = correlationId(request);
  try {
    const action = (await params).action;
    if (action === "worker") {
      if (
        !matchesSecret(
          process.env.GOOGLE_CALENDAR_WORKER_SECRET,
          request.headers.get("authorization")?.replace(/^Bearer /, ""),
        )
      )
        throw new HttpError(403, "forbidden");
      return response(await syncGoogleCalendar(), id);
    }
    if (!["connect", "disconnect", "retry"].includes(action))
      throw new HttpError(404, "not_found");
    const { db, user } = await requireUser();
    const p = payload.parse(await readJson(request));
    if (action === "connect" && !calendarSettings().configured)
      throw new HttpError(503, "calendar_not_configured");
    if (action === "connect") {
      const { data: status, error: statusError } = await db.rpc(
        "calendar_user",
        { p_org: p.org, p_action: "status", p_data: {} },
      );
      if (statusError) throw statusError;
      if (!status.transport_configured)
        throw new HttpError(503, "calendar_not_configured");
    }
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    const { error } = await db.rpc("calendar_user", {
      p_org: p.org,
      p_action: action === "connect" ? "begin" : action,
      p_data: {
        staff: p.staff,
        ...(action === "connect"
          ? {
              state_hash: calendarStateHash(state),
              verifier_cipher: encryptCalendarSecret(
                verifier,
                calendarContext(p.org, p.staff, user.id),
              ),
            }
          : {}),
      },
    });
    if (error) throw error;
    return response(
      action === "connect"
        ? { url: calendarAuthorization(state, verifier, user.email || "") }
        : { ok: true },
      id,
    );
  } catch (error) {
    return fail(error, id);
  }
}
