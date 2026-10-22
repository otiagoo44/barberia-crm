"use client";
import { useState, type FormEvent } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl, api } from "@/lib/client";
import { definitions, type FieldDefinition } from "./definitions";
import { Modal, Field, Notice, Empty, Loading } from "@/components/ui";
import { DataTable } from "@/components/workspace-ui";
import type { DataRow, Page, Json } from "@/lib/types";
export function currencyScale(currency: string) {
  return (
    10 **
    (new Intl.NumberFormat("es", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2)
  );
}
export function RecordManager({
  entity,
  readOnly = false,
}: {
  entity: string;
  readOnly?: boolean;
}) {
  const w = useWorkspace();
  const def = definitions[entity];
  const [cursor, setCursor] = useState<string | null>(null);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const r = useResource<Page<DataRow>>(
    resourceUrl(entity, {
      org: w.organization.id,
      branch: def.branch ? w.branchId : null,
      staff: w.role === "barber" ? w.staffId : null,
      cursor,
    }),
  );
  const tableMode = [
    "services",
    "staff",
    "branches",
    "branch_services",
  ].includes(entity);
  const visibleRows =
    r.data?.items.filter(
      (row) =>
        (!query ||
          String(row.name ?? row.service_name ?? row.staff_name ?? "")
            .toLocaleLowerCase("es")
            .includes(query.toLocaleLowerCase("es"))) &&
        (!category || row.category === category),
    ) ?? [];
  const columns = def.fields
    .filter(
      (f) =>
        !["name", "slug", "color", "description", "profile_id"].includes(
          f.key,
        ) && f.type !== "reference",
    )
    .slice(0, 6);
  if (def.branch && !w.branchId)
    return <Empty title="Primero creá una sucursal" />;
  return (
    <section className="stack">
      <div className="row between wrap">
        <h2>{def.title}</h2>
        {!readOnly &&
          !(entity.endsWith("_settings") && r.data?.items.length) && (
            <button className="primary" onClick={() => setEditor("new")}>
              Agregar {def.singular}
            </button>
          )}
      </div>
      {error && <Notice error>{error}</Notice>}
      {r.error && <Notice error>{r.error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {r.data && !r.data.items.length && (
        <Empty title={`Todavía no hay ${def.title.toLowerCase()}`}>
          Agregá la información real del negocio para habilitar su operación.
        </Empty>
      )}
      {tableMode && r.data?.items.length ? (
        <>
          <div className="toolbar">
            <input
              aria-label={`Buscar en ${def.title}`}
              placeholder="Filtrar esta página…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {entity === "services" && (
              <select
                aria-label="Filtrar categoría de servicio"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {[
                  ...new Set(
                    r.data.items
                      .map((row) => String(row.category ?? ""))
                      .filter(Boolean),
                  ),
                ]
                  .sort()
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            )}
            <small>
              {visibleRows.length} registros visibles
              {r.data.has_more ? " · hay más páginas" : ""}
            </small>
          </div>
          <DataTable label={def.title}>
            <thead>
              <tr>
                <th scope="col">{def.singular}</th>
                {columns.map((f) => (
                  <th scope="col" key={f.key}>
                    {f.label}
                  </th>
                ))}
                {!readOnly && <th scope="col">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {String(
                      row.name ??
                        row.service_name ??
                        row.staff_name ??
                        def.singular,
                    )}
                    {entity === "services" && row.consultation_required && (
                      <small style={{ display: "block" }}>
                        Consulta previa · sin reserva pública
                      </small>
                    )}
                  </th>
                  {columns.map((f) => (
                    <td key={f.key}>
                      {f.type === "checkbox"
                        ? row[f.key]
                          ? "Sí"
                          : "No"
                        : f.type === "money"
                          ? row[f.key] === null || row[f.key] === undefined
                            ? "Sin precio"
                            : new Intl.NumberFormat("es-PY", {
                                style: "currency",
                                currency: w.organization.currency,
                              }).format(
                                Number(row[f.key]) /
                                  currencyScale(w.organization.currency),
                              )
                          : f.options
                            ? (f.options.find(
                                ([v]) => v === String(row[f.key]),
                              )?.[1] ?? String(row[f.key] ?? "—"))
                            : String(row[f.key] ?? "—")}
                    </td>
                  ))}
                  {!readOnly && (
                    <td>
                      <button onClick={() => setEditor(row)}>Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      ) : (
        <div className="record-grid">
          {r.data?.items.map((row) => (
            <article className="record-card" key={row.id}>
              <h3>
                {String(
                  row.name ??
                    row.staff_name ??
                    row.service_name ??
                    def.singular,
                )}
              </h3>
              <dl>
                {def.fields
                  .filter(
                    (f) =>
                      f.type !== "reference" &&
                      f.key !== "name" &&
                      f.key !== "slug" &&
                      f.key !== "color" &&
                      row[f.key] !== null &&
                      row[f.key] !== undefined,
                  )
                  .map((f) => (
                    <div style={{ display: "contents" }} key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.type === "checkbox"
                          ? row[f.key]
                            ? "Sí"
                            : "No"
                          : f.type === "money"
                            ? new Intl.NumberFormat("es", {
                                style: "currency",
                                currency: w.organization.currency,
                              }).format(
                                Number(row[f.key]) /
                                  currencyScale(w.organization.currency),
                              )
                            : f.options
                              ? (f.options.find(
                                  ([v]) => v === String(row[f.key]),
                                )?.[1] ?? String(row[f.key]))
                              : f.type === "datetime"
                                ? formatInTimeZone(
                                    String(row[f.key]),
                                    w.branches.find((b) => b.id === w.branchId)
                                      ?.timezone ?? w.organization.timezone,
                                    "dd/MM/yyyy HH:mm",
                                  )
                                : String(row[f.key])}
                      </dd>
                    </div>
                  ))}
              </dl>
              {!readOnly && (
                <div className="row wrap">
                  <button onClick={() => setEditor(row)}>Editar</button>
                  {[
                    "branch_business_hours",
                    "staff_availability_rules",
                    "staff_availability_exceptions",
                    "staff_service_capabilities",
                  ].includes(entity) && (
                    <button
                      className="danger"
                      onClick={async () => {
                        setError("");
                        try {
                          await api("/api/workspace/remove_schedule", {
                            org: w.organization.id,
                            entity,
                            id: row.id,
                          });
                          r.reload();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Error");
                        }
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {r.data?.has_more && (
        <div className="pagination">
          <button
            onClick={() => setCursor(JSON.stringify(r.data?.next_cursor))}
          >
            Ver siguientes
          </button>
          {cursor && (
            <button onClick={() => setCursor(null)}>Volver al inicio</button>
          )}
        </div>
      )}
      {editor && (
        <RecordEditor
          entity={entity}
          row={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            r.reload();
          }}
        />
      )}
    </section>
  );
}
function RecordEditor({
  entity,
  row,
  onClose,
  onSaved,
}: {
  entity: string;
  row: DataRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const def = definitions[entity];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allLocations, setAllLocations] = useState(
    (entity === "goals" && !row?.branch_id) ||
      (entity === "staff_time_off" && row?.branch_id === null),
  );
  const tz = allLocations
    ? w.organization.timezone
    : (w.branches.find((b) => b.id === w.branchId)?.timezone ??
      w.organization.timezone);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const data: Record<string, Json> = {};
    for (const f of def.fields) {
      if (entity === "branches" && w.role === "manager" && f.key === "active")
        continue;
      const raw = String(form.get(f.key) ?? "");
      if (f.type === "checkbox") data[f.key] = form.has(f.key);
      else if (raw === "") data[f.key] = null;
      else if (f.type === "number" || f.key === "weekday")
        data[f.key] = Number(raw);
      else if (f.type === "money")
        data[f.key] = Math.round(
          Number(raw) * currencyScale(w.organization.currency),
        );
      else if (entity === "goals" && f.type === "date") {
        const day = new Date(raw + "T12:00:00Z");
        if (f.key === "ends_at") day.setUTCDate(day.getUTCDate() + 1);
        data[f.key] = fromZonedTime(
          day.toISOString().slice(0, 10) + "T00:00:00",
          tz,
        ).toISOString();
      } else if (f.type === "datetime")
        data[f.key] = fromZonedTime(raw, tz).toISOString();
      else data[f.key] = raw;
    }
    if (entity === "goals" && data.metric === "production_value")
      data.target_value = Math.round(
        Number(data.target_value) * currencyScale(w.organization.currency),
      );
    try {
      await api("/api/workspace/record", {
        org: w.organization.id,
        entity,
        id: row?.id ?? null,
        branch: def.branch && !allLocations ? w.branchId : null,
        data,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${row ? "Editar" : "Agregar"} ${def.singular}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          {def.fields
            .filter(
              (f) =>
                !(
                  entity === "branches" &&
                  w.role === "manager" &&
                  f.key === "active"
                ),
            )
            .map((f) => {
              let initial = row?.[f.key] ?? f.default ?? "";
              if (entity === "branches" && f.key === "timezone" && !initial)
                initial = w.organization.timezone;
              if (entity === "goals" && f.type === "date" && initial)
                initial = formatInTimeZone(
                  new Date(
                    new Date(String(initial)).getTime() -
                      (f.key === "ends_at" ? 1 : 0),
                  ),
                  tz,
                  "yyyy-MM-dd",
                );
              if (
                entity === "goals" &&
                f.key === "target_value" &&
                row?.metric === "production_value"
              )
                initial =
                  Number(initial) / currencyScale(w.organization.currency);
              if (f.type === "money" && initial !== "")
                initial =
                  Number(initial) / currencyScale(w.organization.currency);
              if (f.type === "datetime" && initial)
                initial = formatInTimeZone(
                  String(initial),
                  tz,
                  "yyyy-MM-dd'T'HH:mm",
                );
              if (f.type === "checkbox")
                return (
                  <label className="check-label" key={f.key}>
                    <input
                      type="checkbox"
                      name={f.key}
                      defaultChecked={!!initial}
                    />
                    {f.label}
                  </label>
                );
              if (f.type === "reference")
                return (
                  <ReferenceField
                    key={f.key}
                    field={f}
                    initial={String(initial)}
                    ownStaff={w.role === "barber" ? w.staffId : null}
                  />
                );
              return (
                <Field key={f.key} label={f.label}>
                  {f.type === "select" ? (
                    <select
                      name={f.key}
                      defaultValue={String(initial)}
                      required={f.required}
                    >
                      {f.options?.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={f.key}
                      type={
                        f.type === "datetime"
                          ? "datetime-local"
                          : f.type === "money"
                            ? "number"
                            : f.type === "number"
                              ? "number"
                              : (f.type ?? "text")
                      }
                      step={
                        f.type === "money"
                          ? 1 / currencyScale(w.organization.currency)
                          : f.type === "number"
                            ? "any"
                            : undefined
                      }
                      min={
                        f.type === "number" || f.type === "money"
                          ? 0
                          : undefined
                      }
                      defaultValue={String(initial)}
                      required={f.required}
                      maxLength={f.key === "slug" ? 63 : 1000}
                    />
                  )}
                </Field>
              );
            })}
        </div>
        {(entity === "goals" || entity === "staff_time_off") &&
          w.role === "organization_owner" && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={allLocations}
                onChange={(e) => setAllLocations(e.target.checked)}
              />
              Aplicar a toda la organización
            </label>
          )}
        <small>
          Zona horaria: {tz}. Los horarios nocturnos se configuran en dos
          intervalos separados por medianoche.
        </small>
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ReferenceField({
  field,
  initial,
  ownStaff,
}: {
  field: FieldDefinition;
  initial: string;
  ownStaff: string | null;
}) {
  const w = useWorkspace();
  const r = useResource<Page<DataRow>>(
    resourceUrl(field.reference!, { org: w.organization.id }),
  );
  const options = (r.data?.items ?? []).filter((row) =>
    field.reference === "staff"
      ? (!ownStaff || row.id === ownStaff) && row.active !== false
      : field.reference === "organization_memberships"
        ? row.role === "barber" && row.active !== false
        : row.active !== false,
  );
  return (
    <Field label={field.label}>
      <select
        name={field.key}
        defaultValue={ownStaff && field.key === "staff_id" ? ownStaff : initial}
        required={field.required}
      >
        <option value="">
          {field.required ? "Seleccioná…" : "Sin asignar"}
        </option>
        {options.map((row) => (
          <option
            key={row.id}
            value={field.key === "profile_id" ? String(row.profile_id) : row.id}
          >
            {String(
              row.name ?? row.profile_name ?? row.email ?? "Cuenta registrada",
            )}
          </option>
        ))}
      </select>
      {r.error && <small>{r.error}</small>}
      {r.data?.has_more && (
        <small>
          La lista muestra los primeros 100 registros. Ajustá la selección por
          sucursal.
        </small>
      )}
    </Field>
  );
}
