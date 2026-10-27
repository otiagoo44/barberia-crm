import reference from "../../../config/onboarding/1717-finance-import.json";
import type { ImportCorrections } from "./import-parser";

export function confirmedImportCorrections(
  slug: string,
  hash: string,
  requested: ImportCorrections = {},
): ImportCorrections {
  const confirmed: ImportCorrections =
    slug === reference.organization_slug && hash === reference.source_sha256
      ? reference.corrections
      : {};
  const result = { ...confirmed };
  for (const [row, correction] of Object.entries(requested))
    result[row] = {
      cells: { ...confirmed[row]?.cells, ...correction.cells },
      reason: correction.reason,
    };
  return result;
}
