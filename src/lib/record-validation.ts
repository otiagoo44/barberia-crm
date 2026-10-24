import { z } from "zod";

const optionalText = z.string().max(1000).nullable().optional();
const serviceFields = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del servicio.").max(120),
    slug: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{1,62}$/,
        "Usá entre 2 y 63 letras minúsculas, números o guiones.",
      ),
    description: optionalText,
    website_category: z
      .enum(
        ["corte", "rulos", "tinte", "barba", "infantil", "cejas", "lavado"],
        { error: "Elegí una sección válida del sitio." },
      )
      .nullable()
      .optional(),
    consultation_required: z.boolean().optional(),
    default_duration_minutes: z
      .number()
      .int("La duración debe ser un número entero.")
      .min(1, "Ingresá una duración mayor que cero.")
      .max(480, "La duración máxima es de 480 minutos."),
    composition_mode: z
      .enum(["standalone", "additive", "included", "override"])
      .optional(),
    base_service_id: z.uuid().nullable().optional(),
    suggested_return_days: z
      .number()
      .int()
      .min(1)
      .max(730)
      .nullable()
      .optional(),
    requires_maintenance: z.boolean().optional(),
    category: z
      .string()
      .max(80, "La categoría admite hasta 80 caracteres.")
      .nullable()
      .optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Elegí un color válido.")
      .optional(),
    active: z.boolean().optional(),
  })
  .strict();

/** Shared form/API validation. SQL remains the authority for scope and conflicts. */
export function validateRecord(
  entity: string,
  data: Record<string, unknown>,
  creating: boolean,
) {
  if (entity !== "services")
    return { data, fields: {} as Record<string, string> };
  const normalized = { ...data };
  // Legacy UI sent `otro`, which has never been a public catalog category.
  if (
    normalized.website_category === "otro" ||
    normalized.website_category === ""
  )
    normalized.website_category = null;
  const result = (creating ? serviceFields : serviceFields.partial()).safeParse(
    normalized,
  );
  const fields: Record<string, string> = {};
  if (!result.success)
    for (const issue of result.error.issues) {
      fields[String(issue.path[0] ?? "form")] = issue.message;
    }
  if (
    normalized.website_category === "rulos" &&
    normalized.consultation_required === false
  )
    fields.consultation_required = "Rulos requiere consulta previa.";
  if (
    normalized.composition_mode &&
    ["included", "override"].includes(String(normalized.composition_mode)) &&
    !normalized.base_service_id &&
    creating
  )
    fields.base_service_id = "Elegí el servicio principal asociado.";
  return { data: normalized, fields };
}
