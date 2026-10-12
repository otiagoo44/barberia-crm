type LinkedService = {
  slug: string;
  composition_mode: string;
  base_service_slug: string | null;
  consultation_required?: boolean;
};
export function preselectedServices(
  requested: string | undefined,
  catalog: LinkedService[],
): string[] {
  const selected = catalog.find(
    (s) => s.slug === requested && !s.consultation_required,
  );
  if (!selected) return [];
  if (
    selected.composition_mode === "included" ||
    selected.composition_mode === "override"
  ) {
    const base = catalog.find(
      (s) => s.slug === selected.base_service_slug && !s.consultation_required,
    );
    return base ? [base.slug, selected.slug] : [];
  }
  return [selected.slug];
}
