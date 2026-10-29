import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { OAuth2Client } from "google-auth-library";

export const calendarScope =
  "https://www.googleapis.com/auth/calendar.app.created";
export function calendarSettings(env: NodeJS.ProcessEnv = process.env) {
  const origin = new URL(env.APP_URL || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1"].includes(origin.hostname);
  if (
    (!local && origin.protocol !== "https:") ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("invalid_calendar_origin");
  const key = env.GOOGLE_CALENDAR_ENCRYPTION_KEY || "";
  const configured = Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    /^[0-9a-f]{64}$/i.test(key) &&
    env.GOOGLE_CALENDAR_WORKER_SECRET &&
    env.GOOGLE_CALENDAR_WORKER_SECRET.length >= 32,
  );
  return {
    configured,
    origin: origin.origin,
    redirectUri: origin.origin + "/api/calendar/callback",
    key,
  };
}
export function calendarContext(org: string, staff: string, profile: string) {
  return `google-calendar:v1:${org}:${staff}:${profile}`;
}
export function encryptCalendarSecret(
  value: string,
  context: string,
  key = calendarSettings().key,
) {
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error("calendar_not_configured");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptCalendarSecret(
  value: string,
  context: string,
  key = calendarSettings().key,
) {
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error("calendar_not_configured");
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra)
    throw new Error("invalid_calendar_cipher");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export const calendarStateHash = (state: string) =>
  createHash("sha256").update(state).digest("hex");
export function googleOAuth() {
  if (!calendarSettings().configured)
    throw new Error("calendar_not_configured");
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: calendarSettings().redirectUri,
    transporterOptions: { timeout: 8000, retry: false },
  });
}
export function calendarAuthorization(
  state: string,
  verifier: string,
  loginHint: string,
) {
  return googleOAuth().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", calendarScope],
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method:
      "S256" as import("google-auth-library").CodeChallengeMethod,
    login_hint: loginHint,
  });
}
export class CalendarProviderError extends Error {
  constructor(public authorizationRequired: boolean) {
    super(
      authorizationRequired ? "authorization_required" : "provider_unavailable",
    );
  }
}
async function providerFailure(response: Response) {
  const detail = await response.json().catch(() => null);
  const reasons: string[] = detail?.error?.errors?.map((error: { reason?: string }) => error.reason) ?? [];
  // Google also returns 403 for quota/rate limits: retry without revoking consent.
  const denied = response.status === 401 || (response.status === 403 && reasons.some(reason => ["insufficientPermissions", "forbidden", "authError"].includes(reason)));
  return new CalendarProviderError(denied);
}
export async function calendarRequest(
  path: string,
  token: string,
  init: RequestInit = {},
  request: typeof fetch = fetch,
): Promise<Response> {
  const response = await request(
    "https://www.googleapis.com/calendar/v3" + path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    },
  );
  if (response.status === 401) throw new CalendarProviderError(true);
  return response;
}
export type CalendarSnapshot = {
  organization: string;
  staff: string;
  profile: string;
  auth_version: string;
  calendar_id: string;
  refresh_cipher: string;
  appointment: string;
  revision: number;
  remove: boolean;
  starts_at: string;
  ends_at: string;
  status: string;
  services: string | null;
  slug: string;
  timezone: string;
  location: string | null;
  disabled?: boolean;
};
// Google's IDs allow base32hex characters; hex hashes satisfy that alphabet.
export function calendarEventId(
  connection: string,
  calendar: string,
  appointment: string,
) {
  return (
    "b" +
    createHash("sha256")
      .update(`${connection}:${calendar}:${appointment}`)
      .digest("hex")
  );
}
export function calendarEvent(snapshot: CalendarSnapshot, origin: string) {
  const status = (
    { completed: "Completado", no_show: "No asistió" } as Record<string, string>
  )[snapshot.status];
  const link = new URL(`/${encodeURIComponent(snapshot.slug)}/agenda`, origin);
  link.searchParams.set(
    "date",
    new Intl.DateTimeFormat("en-CA", { timeZone: snapshot.timezone }).format(
      new Date(snapshot.starts_at),
    ),
  );
  // Calendar is a projection for the professional. Contact data and private
  // notes remain behind the authenticated CRM link.
  return {
    summary: [snapshot.services || "Turno de barbería", status]
      .filter(Boolean)
      .join(" · "),
    description: `Turno registrado en Barbería OS. Gestioná los cambios desde el CRM: ${link.href}`,
    location: snapshot.location || "",
    start: { dateTime: snapshot.starts_at, timeZone: snapshot.timezone },
    end: { dateTime: snapshot.ends_at, timeZone: snapshot.timezone },
    visibility: "private",
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        barberiaAppointment: snapshot.appointment,
        barberiaOrganization: snapshot.organization,
      },
    },
  };
}
export async function projectCalendarEvent(
  connection: string,
  snapshot: CalendarSnapshot,
  token: string,
  origin: string,
  request: typeof fetch = fetch,
) {
  const id = calendarEventId(
    connection,
    snapshot.calendar_id,
    snapshot.appointment,
  );
  const root = `/calendars/${encodeURIComponent(snapshot.calendar_id)}/events`;
  const path = `${root}/${id}`;
  const existing = await calendarRequest(path, token, {}, request);
  const missing = [404, 410].includes(existing.status);
  if (!missing) {
    if (!existing.ok) throw await providerFailure(existing);
    const event = await existing.json();
    if (
      event.extendedProperties?.private?.barberiaAppointment !==
        snapshot.appointment ||
      event.extendedProperties?.private?.barberiaOrganization !==
        snapshot.organization
    )
      throw new CalendarProviderError(false);
  }
  if (snapshot.remove) {
    if (missing) return;
    const removed = await calendarRequest(
      path + "?sendUpdates=none",
      token,
      { method: "DELETE" },
      request,
    );
    if (!removed.ok && ![404, 410].includes(removed.status))
      throw await providerFailure(removed);
    return;
  }
  const body = JSON.stringify({ ...calendarEvent(snapshot, origin), id });
  const saved = await calendarRequest(
    (missing ? root : path) + "?sendUpdates=none",
    token,
    { method: missing ? "POST" : "PUT", body },
    request,
  );
  if (saved.status === 409 && missing) {
    // Retry after an ambiguous network failure: verify ownership before update.
    const conflict = await calendarRequest(path, token, {}, request);
    if (!conflict.ok) throw new CalendarProviderError(false);
    const event = await conflict.json();
    if (
      event.extendedProperties?.private?.barberiaAppointment !==
        snapshot.appointment ||
      event.extendedProperties?.private?.barberiaOrganization !==
        snapshot.organization
    )
      throw new CalendarProviderError(false);
    const updated = await calendarRequest(
      path + "?sendUpdates=none",
      token,
      { method: "PUT", body },
      request,
    );
    if (!updated.ok) throw await providerFailure(updated);
  } else if (!saved.ok) throw await providerFailure(saved);
}
