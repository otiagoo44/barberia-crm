import "server-only";
import { gatewayClient } from "@/lib/supabase/server";
import {
  CalendarProviderError,
  calendarContext,
  calendarSettings,
  decryptCalendarSecret,
  googleOAuth,
  projectCalendarEvent,
  type CalendarSnapshot,
} from "@/lib/google-calendar";

export async function calendarWorkerRpc(
  action: string,
  data: Record<string, unknown> = {},
) {
  const { data: result, error } = await gatewayClient().rpc("calendar_worker", {
    p_secret: process.env.GOOGLE_CALENDAR_WORKER_SECRET,
    p_action: action,
    p_data: data,
  });
  if (error) throw error;
  return result;
}
export async function syncGoogleCalendar() {
  if (!calendarSettings().configured)
    return { configured: false, completed: 0, failed: 0 };
  const jobs = (await calendarWorkerRpc("claim")) as {
    connection_id: string;
    appointment_id: string;
    lease: string;
  }[];
  let completed = 0,
    failed = 0;
  for (const job of jobs) {
    const identity = {
      connection: job.connection_id,
      appointment: job.appointment_id,
      lease: job.lease,
    };
    let snapshot: CalendarSnapshot | undefined;
    try {
      snapshot = await calendarWorkerRpc("snapshot", identity);
      if (!snapshot) throw new CalendarProviderError(false);
      if (snapshot.disabled) {
        await calendarWorkerRpc("finish", {
          ...identity,
          revision: snapshot.revision,
          auth_version: snapshot.auth_version,
        });
        continue;
      }
      const oauth = googleOAuth();
      oauth.setCredentials({
        refresh_token: decryptCalendarSecret(
          snapshot.refresh_cipher,
          calendarContext(
            snapshot.organization,
            snapshot.staff,
            snapshot.profile,
          ),
        ),
      });
      const access = await oauth.getAccessToken();
      if (!access.token) throw new CalendarProviderError(true);
      await projectCalendarEvent(
        job.connection_id,
        snapshot,
        access.token,
        calendarSettings().origin,
      );
      await calendarWorkerRpc("finish", {
        ...identity,
        revision: snapshot.revision,
        auth_version: snapshot.auth_version,
      });
      completed++;
    } catch (error) {
      const invalidGrant =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error.response as { data?: { error?: string } })?.data?.error ===
          "invalid_grant";
      const authorization =
        invalidGrant ||
        (error instanceof CalendarProviderError && error.authorizationRequired);
      await calendarWorkerRpc("fail", {
        ...identity,
        auth_version: snapshot?.auth_version,
        code: authorization ? "authorization_required" : "provider_unavailable",
      });
      failed++;
      // Provider errors can contain tokens/request headers. Never log them.
    }
  }
  return { configured: true, completed, failed };
}
