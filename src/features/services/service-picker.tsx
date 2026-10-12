"use client";
export type PickableService = {
  id: string;
  name: string;
  composition_mode: string;
  base_service_id: string | null;
};
export function nextServiceSelection(
  current: string[],
  service: PickableService,
  all: PickableService[],
): string[] {
  if (current.includes(service.id))
    return current.filter(
      (id) =>
        id !== service.id &&
        all.find((s) => s.id === id)?.base_service_id !== service.id,
    );
  if (service.composition_mode === "standalone")
    return [
      ...current.filter((id) => {
        const s = all.find((s) => s.id === id);
        return s?.composition_mode === "additive" && !s.base_service_id;
      }),
      service.id,
    ];
  if (service.base_service_id && !current.includes(service.base_service_id)) {
    const base = all.find((s) => s.id === service.base_service_id);
    return base
      ? [...nextServiceSelection(current, base, all), service.id]
      : current;
  }
  if (service.composition_mode === "override")
    current = current.filter((id) => {
      const s = all.find((s) => s.id === id);
      return (
        s?.composition_mode !== "override" ||
        s.base_service_id !== service.base_service_id
      );
    });
  return [...current, service.id];
}
export function ServicePicker({
  services,
  selected,
  onChange,
}: {
  services: PickableService[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ marginBottom: 12 }}>Servicios</legend>
      <div className="service-options">
        {services.map((s) => (
          <label className="check-label service-option" key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={() =>
                onChange(nextServiceSelection(selected, s, services))
              }
            />
            <span>
              {s.name}
              {s.composition_mode !== "standalone" && (
                <small>
                  {s.composition_mode === "included"
                    ? "Incluido"
                    : s.composition_mode === "override"
                      ? "Cambia la duración"
                      : "Adicional"}
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
