import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { correlationId, fail, response, readJson, HttpError } from "@/lib/http";
import { uuid } from "@/lib/validation";
import {
  parseCsv,
  parseXlsx,
  normalizeRows,
  sourceHash,
  type ImportCatalog,
  type ImportMapping,
} from "@/features/finance/import-parser";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const id = correlationId(request);
  try {
    const { db } = await requireUser();
    const p = z
      .object({
        org: uuid,
        branch: uuid,
        key: uuid,
        action: z.enum(["preview", "confirm"]),
        filename: z.string().min(1).max(250).optional(),
        content: z
          .string()
          .max(12 * 1024 * 1024)
          .optional(),
        mapping: z.record(z.string(), z.record(z.string(), uuid)).optional(),
        excluded_rows: z
          .array(z.number().int().min(2).max(2000))
          .max(2000)
          .optional(),
        id: uuid.optional(),
        preview_hash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        dry_run: z.boolean().optional(),
      })
      .strict()
      .parse(await readJson(request, 12 * 1024 * 1024));
    if (p.action === "confirm") {
      const { data, error } = await db.rpc("finance_import", {
        p_org: p.org,
        p_branch: p.branch,
        p_action: "confirm",
        p_data: {
          id: uuid.parse(p.id),
          preview_hash: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(p.preview_hash),
        },
        p_key: p.key,
      });
      if (error) throw error;
      return response(data, id);
    }
    // Verify the privileged role before parsing a potentially large upload.
    const { data: members } = await db.rpc("session_context");
    const { data: member } = await db
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", p.org)
      .eq(
        "profile_id",
        members?.profile?.id ?? (await db.auth.getUser()).data.user?.id,
      )
      .eq("active", true)
      .maybeSingle();
    if (
      !["organization_owner", "finance"].includes(member?.role ?? "") &&
      !members?.platform_admin
    )
      throw new HttpError(403, "forbidden");
    const filename = z
      .string()
      .regex(/\.(xlsx|csv)$/i)
      .parse(p.filename);
    const content = z.string().min(1).parse(p.content);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content))
      throw new HttpError(400, "invalid_file_encoding");
    const bytes = Buffer.from(content, "base64");
    const today = new Date().toISOString().slice(0, 10);
    const { data: catalog, error: catalogError } = await db.rpc(
      "finance_read",
      {
        p_org: p.org,
        p_branch: p.branch,
        p_view: "catalog",
        p_from: today,
        p_to: today,
      },
    );
    if (catalogError) throw catalogError;
    const rows = normalizeRows(
      filename.toLowerCase().endsWith(".csv")
        ? parseCsv(bytes.toString("utf8"))
        : parseXlsx(bytes),
      catalog as ImportCatalog,
      (p.mapping ?? {}) as ImportMapping,
      p.excluded_rows ?? [],
    );
    const preview = {
      source_file: filename.replace(/^.*[\\/]/, ""),
      source_sha256: sourceHash(bytes),
      mapping: p.mapping ?? {},
      rows,
    };
    if (p.dry_run) return response({ ...preview, dry_run: true }, id);
    const { data, error } = await db.rpc("finance_import", {
      p_org: p.org,
      p_branch: p.branch,
      p_action: "preview",
      p_data: preview,
      p_key: p.key,
    });
    if (error) throw error;
    return response(data, id);
  } catch (e) {
    return fail(e, id);
  }
}
