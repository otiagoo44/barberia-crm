import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, HttpError, correlationId } from "@/lib/http";
import { csvCell } from "@/lib/validation";
import type { Page, DataRow } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = correlationId(request);
  try {
    const { db } = await requireUser();
    const q = new URL(request.url).searchParams;
    const org = z.uuid().parse(q.get("org"));
    const branch = q.get("branch") ? z.uuid().parse(q.get("branch")) : null;
    const { error: authorize } = await db.rpc("record_export", {
      p_org: org,
      p_branch: branch,
      p_count: 0,
      p_request: id,
    });
    if (authorize) throw authorize;
    let cursor = null;
    const rows: DataRow[] = [];
    while (rows.length < 10000) {
      const { data, error } = await db.rpc("list_customers", {
        p_org: org,
        p_branch: branch,
        p_query: "",
        p_cursor: cursor,
        p_limit: 100,
        p_retention: "all",
      });
      if (error) throw error;
      const page = data as Page<DataRow>;
      rows.push(...page.items);
      if (!page.has_more) break;
      cursor = page.next_cursor;
    }
    if (rows.length >= 10000) throw new HttpError(400, "export_too_large");
    const { error } = await db.rpc("record_export", {
      p_org: org,
      p_branch: branch,
      p_count: rows.length,
      p_request: id,
    });
    if (error) throw error;
    const csv =
      "\uFEFF" +
      [
        "Nombre,Teléfono,Email,Próximo regreso",
        ...rows.map((r) =>
          [r.name, r.normalized_phone, r.email, r.expected_return_at]
            .map(csvCell)
            .join(","),
        ),
      ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="clientes.csv"',
        "Cache-Control": "private, no-store",
        "X-Request-Id": id,
      },
    });
  } catch (error) {
    return fail(error, id);
  }
}
