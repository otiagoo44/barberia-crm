import { correlationId } from "@/lib/http";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError, fail } from "@/lib/http";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const requestId = correlationId(request);
  try {
    const { db } = await requireUser();
    const q = new URL(request.url).searchParams;
    const org = z.uuid().parse(q.get("org"));
    const branch = z.uuid().parse(q.get("branch"));
    const { data } = await db
      .from("branches")
      .select("id")
      .eq("organization_id", org)
      .eq("id", branch)
      .maybeSingle();
    if (!data) throw new HttpError(403, "forbidden");
    const { data: session } = await db.auth.getSession();
    if (!session.session) throw new HttpError(401, "unauthenticated");
    await db.realtime.setAuth(session.session.access_token);
    let cleanup = () => {};
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const send = (value: unknown) => {
          if (!closed)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(value)}\n\n`),
            );
        };
        controller.enqueue(encoder.encode("retry: 15000\n\n"));
        const channel = db.channel(`day:${org}:${branch}:${requestId}`);
        for (const table of [
          "appointments",
          "walk_in_entries",
          "staff_availability_rules",
          "staff_availability_exceptions",
          "staff_time_off",
          "branch_business_hours",
          "branch_closures",
        ])
          channel.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              filter: `organization_id=eq.${org}`,
            },
            (payload) => {
              const row = payload.new as { id?: string; branch_id?: string };
              const old = payload.old as { id?: string; branch_id?: string };
              if (row.branch_id && row.branch_id !== branch) {
                if (table === "appointments")
                  send({ table, id: row.id, type: "remove" });
                return;
              }
              send({ table, id: row.id ?? old.id, type: payload.eventType });
            },
          );
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") send({ type: "connected" });
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
            send({ type: "disconnected" });
        });
        const heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 25000);
        const timeout = setTimeout(() => cleanup(), 240000);
        cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          clearTimeout(timeout);
          void db.removeChannel(channel);
          request.signal.removeEventListener("abort", cleanup);
          try {
            controller.close();
          } catch {
            /* Already cancelled by the browser. */
          }
        };
        request.signal.addEventListener("abort", cleanup);
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-cache, no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
