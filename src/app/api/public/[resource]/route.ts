import { createHmac } from "node:crypto";
import { z } from "zod";
import { gatewayClient } from "@/lib/supabase/server";
import { fail, response, readJson, HttpError, correlationId } from "@/lib/http";
import { slug, date, uuid, customerInput } from "@/lib/validation";
export const dynamic = "force-dynamic";
async function gateway(request: Request, write: boolean) {
  const secret = process.env.BOOKING_GATEWAY_SECRET;
  if (!secret) throw new HttpError(503, "booking_not_configured");
  const db = gatewayClient(correlationId(request));
  const trusted =
    process.env.VERCEL === "1" || process.env.TRUST_PROXY === "true";
  const ip = trusted
    ? (
        request.headers.get("x-vercel-forwarded-for") ??
        request.headers.get("x-forwarded-for") ??
        "unknown"
      )
        .split(",")[0]
        .trim()
    : "unknown";
  const hash = createHmac("sha256", secret).update(ip).digest("hex");
  const { error } = await db.rpc("public_rate_check", {
    p_secret: secret,
    p_client_hash: hash,
    p_write: write,
  });
  if (error) throw error;
  return { db, secret };
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const id = correlationId(request);
  try {
    const { resource } = await params;
    const q = new URL(request.url).searchParams;
    const org = slug.parse(q.get("organization"));
    const { db, secret } = await gateway(request, false);
    let name: string;
    let args: Record<string, unknown>;
    if (resource === "catalog") {
      name = "public_catalog";
      args = {
        p_secret: secret,
        p_slug: org,
        p_branch_slug: q.get("branch") ? slug.parse(q.get("branch")) : null,
      };
    } else if (resource === "availability") {
      name = "public_availability";
      args = {
        p_secret: secret,
        p_slug: org,
        p_branch_slug: slug.parse(q.get("branch")),
        p_services: z.array(slug).min(1).max(12).parse(q.getAll("service")),
        p_staff_slug: q.get("staff") ? slug.parse(q.get("staff")) : null,
        p_date: date.parse(q.get("date")),
      };
    } else throw new HttpError(404, "not_found");
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return response(data, id);
  } catch (error) {
    return fail(error, id);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const id = correlationId(request);
  try {
    if ((await params).resource !== "booking")
      throw new HttpError(404, "not_found");
    const p = z
      .object({
        organization: slug,
        branch: slug,
        services: z.array(slug).min(1).max(12),
        staff: slug.nullable(),
        starts_at: z.iso.datetime({ offset: true }),
        customer: customerInput,
        key: uuid,
        website: z.string().max(200),
        source: z.enum(["website"]).optional(),
      })
      .strict()
      .parse(await readJson(request, 4096));
    if (p.website) throw new HttpError(400, "invalid_request");
    const { db, secret } = await gateway(request, true);
    const { data, error } = await db.rpc("public_booking", {
      p_secret: secret,
      p_slug: p.organization,
      p_branch_slug: p.branch,
      p_services: p.services,
      p_staff_slug: p.staff,
      p_start: p.starts_at,
      p_customer_data: p.customer,
      p_key: p.key,
      p_honeypot: p.website,
      p_attribution: p.source ?? null,
    });
    if (error) throw error;
    return response(data, id, 201);
  } catch (error) {
    return fail(error, id);
  }
}
