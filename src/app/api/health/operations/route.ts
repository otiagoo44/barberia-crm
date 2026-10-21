import { gatewayClient } from "@/lib/supabase/server";
import { matchesSecret } from "@/lib/secret-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !matchesSecret(
      process.env.CRON_SECRET,
      request.headers.get("authorization")?.replace(/^Bearer /, ""),
    )
  )
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  const started = performance.now();
  try {
    const { data, error } = await gatewayClient().rpc("operations_health", {
      p_secret: process.env.WORKER_SECRET,
    });
    if (error || !data) throw new Error("unavailable");
    const healthy =
      data.heartbeat_age_seconds !== null &&
      data.heartbeat_age_seconds <= 180 &&
      data.dead === 0 &&
      data.expired_leases === 0 &&
      data.anomalous_leases === 0 &&
      data.oldest_lock_wait_seconds <= 60 &&
      data.oldest_due_seconds <= 300 &&
      data.booking_constraint;
    return Response.json(
      {
        ...data,
        healthy,
        database_roundtrip_ms: Math.round(performance.now() - started),
        http_error_rate: null,
        http_p95_ms: null,
        incident_channel: "not_configured",
        alerts_delivery: "not_configured",
      },
      { status: healthy ? 200 : 503, headers },
    );
  } catch {
    return Response.json(
      { healthy: false, database: false },
      { status: 503, headers },
    );
  }
}
