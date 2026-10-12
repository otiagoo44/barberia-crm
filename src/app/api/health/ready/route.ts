import { gatewayClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const secret = process.env.BOOKING_GATEWAY_SECRET;
    if (!secret) throw new Error("not_configured");
    const { data, error } = await gatewayClient().rpc("gateway_health", {
      p_secret: secret,
    });
    if (error || !data?.ready) throw new Error("not_ready");
    return Response.json(
      { ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
