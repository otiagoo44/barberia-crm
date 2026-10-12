import { timingSafeEqual } from "node:crypto";
import { gatewayClient } from "@/lib/supabase/server";
import { response, fail, HttpError, correlationId } from "@/lib/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const id = correlationId(request);
  try {
    const expected = process.env.CRON_SECRET;
    const supplied = request.headers
      .get("authorization")
      ?.replace(/^Bearer /, "");
    if (
      !expected ||
      !supplied ||
      expected.length !== supplied.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    )
      throw new HttpError(403, "forbidden");
    const secret = process.env.WORKER_SECRET;
    if (!secret) throw new HttpError(503, "worker_not_configured");
    const db = gatewayClient(id);
    const { error: tickError } = await db.rpc("worker_tick", {
      p_secret: secret,
    });
    if (tickError) throw tickError;
    const { data, error } = await db.rpc("claim_jobs", {
      p_secret: secret,
      p_limit: 10,
    });
    if (error) throw error;
    let completed = 0;
    let failed = 0;
    let awaiting = 0;
    for (const job of (data ?? []) as { id: string; lease_token: string }[]) {
      const { data: result, error: jobError } = await db.rpc("process_job", {
        p_secret: secret,
        p_id: job.id,
        p_lease: job.lease_token,
      });
      if (jobError) {
        failed++;
        console.error(
          JSON.stringify({
            level: "error",
            request_id: id,
            code: "job_failed",
            job_id: job.id,
          }),
        );
        await db.rpc("fail_job", {
          p_secret: secret,
          p_id: job.id,
          p_lease: job.lease_token,
        });
      } else if (result?.status === "awaiting_configuration") awaiting++;
      else completed++;
    }
    return response(
      { completed, failed, awaiting_configuration: awaiting },
      id,
    );
  } catch (error) {
    return fail(error, id);
  }
}
