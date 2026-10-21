import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { uuid, date, csvCell } from "@/lib/validation";
import { correlationId, fail, response, readJson, HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
const views = z.enum([
  "catalog",
  "checkout",
  "cash",
  "summary",
  "movements",
  "expenses",
  "settlements",
  "closures",
  "staff",
]);
const actions = z.enum([
  "configure",
  "configure_settings",
  "create_checkout",
  "record_payment",
  "post_checkout",
  "create_expense",
  "open_cash_session",
  "close_cash_session",
  "reopen_cash_session",
  "record_cash_movement",
  "record_staff_advance",
  "record_salary_payment",
  "create_staff_settlement",
  "review_staff_settlement",
  "pay_staff_settlement",
  "close_staff_settlement",
  "record_financial_adjustment",
  "reverse_financial_transaction",
]);
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const id = correlationId(request);
  try {
    const { db } = await requireUser();
    const resource = (await params).resource;
    const q = new URL(request.url).searchParams;
    const org = uuid.parse(q.get("org"));
    const branch = uuid.parse(q.get("branch"));
    const from = date.parse(q.get("from"));
    const to = date.parse(q.get("to"));
    if (["series", "partners", "partner_own"].includes(resource)) {
      const { data, error } = await db.rpc(
        resource === "series"
          ? "financial_series"
          : resource === "partner_own"
            ? "partner_own_distributions"
            : "partner_distributions",
        { p_org: org, p_branch: branch, p_from: from, p_to: to },
      );
      if (error) throw error;
      return response(data, id);
    }
    if (resource === "export") {
      const view = z
        .enum(["movements", "expenses", "settlements", "closures"])
        .parse(q.get("view"));
      const { data, error } = await db.rpc("financial_export", {
        p_org: org,
        p_branch: branch,
        p_view: view,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      const csv = [
        columns.map(csvCell).join(","),
        ...rows.map((row) =>
          columns
            .map((c) =>
              csvCell(
                typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c],
              ),
            )
            .join(","),
        ),
      ].join("\r\n");
      return new Response("\ufeff" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${view}-${from}-${to}.csv"`,
          "Cache-Control": "private, no-store",
          "X-Request-Id": id,
        },
      });
    }
    const { data, error } = await db.rpc("finance_read", {
      p_org: org,
      p_branch: branch,
      p_view: views.parse(resource),
      p_from: from,
      p_to: to,
      p_limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(q.get("limit") ?? 50),
      p_offset: z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(q.get("offset") ?? 0),
      p_query: z
        .string()
        .max(80)
        .parse(q.get("q") ?? ""),
      p_id: q.get("id") ? uuid.parse(q.get("id")) : null,
    });
    if (error) throw error;
    return response(data, id);
  } catch (e) {
    return fail(e, id);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const id = correlationId(request);
  try {
    const resource = (await params).resource;
    if (resource !== "command" && resource !== "partners")
      throw new HttpError(404, "not_found");
    const { db } = await requireUser();
    const p = z
      .object({
        org: uuid,
        branch: uuid.nullable(),
        action:
          resource === "partners"
            ? z.enum([
                "configure",
                "prepare",
                "approve",
                "pay",
                "reverse_payment",
                "adjust",
                "apply_withdrawal",
                "close",
              ])
            : actions,
        data: z.record(z.string(), z.unknown()),
        key: uuid,
      })
      .strict()
      .parse(await readJson(request, 65536));
    const { data, error } = await db.rpc(
      resource === "partners"
        ? "partner_distribution_command"
        : "finance_command",
      {
        p_org: p.org,
        p_branch: p.branch,
        p_action: p.action,
        p_data: p.data,
        p_key: p.key,
      },
    );
    if (error) throw error;
    return response(data, id, 201);
  } catch (e) {
    return fail(e, id);
  }
}
