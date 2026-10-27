"use client";
import { useState } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { api } from "@/lib/client";
import { Modal, Field, Notice } from "@/components/ui";
import { money, type FinanceCatalog } from "./client";
import type {
  PreviewRow,
  ImportMapping,
  ImportCorrections,
} from "./import-parser";
import {
  importColumns,
  importIssues,
  importTotals,
  importFingerprint,
} from "./import-review";
import { MAX_IMPORT_UPLOAD_BYTES } from "./import-limits";

type Preview = {
  id?: string;
  preview_hash?: string;
  rows: PreviewRow[];
  dry_run?: boolean;
  corrections?: ImportCorrections;
};
const canonical = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
export function FinanceImport({
  catalog,
  onClose,
  onImported,
}: {
  catalog: FinanceCatalog;
  onClose: () => void;
  onImported: () => void;
}) {
  const w = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [corrections, setCorrections] = useState<ImportCorrections>({});
  const [excluded, setExcluded] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  async function requestPreview(dryRun: boolean) {
    if (!file) throw new Error("Elegí el archivo.");
    if (file.size > MAX_IMPORT_UPLOAD_BYTES)
      throw new Error(
        "El archivo supera 2 MiB. Exportá un período más corto como CSV.",
      );
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(file);
    });
    return api<Preview>("/api/finance/import", {
      org: w.organization.id,
      branch: w.branchId,
      key: crypto.randomUUID(),
      action: "preview",
      filename: file.name,
      content,
      mapping: Object.fromEntries(
        Object.entries(mapping).map(([kind, values]) => [
          kind,
          Object.fromEntries(
            Object.entries(values ?? {}).filter(([, value]) => value),
          ),
        ]),
      ),
      corrections,
      excluded_rows: excluded,
      dry_run: dryRun,
    });
  }
  async function validate() {
    setBusy(true);
    setError("");
    try {
      const result = await requestPreview(true);
      setPreview(result);
      setCorrections(result.corrections ?? corrections);
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo analizar el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await requestPreview(false);
      setPreview(saved);
      if (importFingerprint(saved.rows) !== importFingerprint(preview.rows))
        throw new Error(
          "Cambió el catálogo o la revisión. Revisá los nuevos resultados antes de confirmar otra vez.",
        );
      if (!saved.id || !saved.preview_hash)
        throw new Error("No se pudo guardar la revisión.");
      await api("/api/finance/import", {
        org: w.organization.id,
        branch: w.branchId,
        key: crypto.randomUUID(),
        action: "confirm",
        id: saved.id,
        preview_hash: saved.preview_hash,
      });
      setDone(true);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  }
  const unresolved =
    preview?.rows.filter((r) => r.review_status === "NEEDS_REVIEW") ?? [];
  const ready =
    preview?.rows.filter((r) => r.review_status === "READY").length ?? 0;
  const totals = importTotals(preview?.rows ?? []);
  const needs: Record<string, { kind: keyof ImportMapping; name: string }> = {};
  for (const row of unresolved)
    for (const [code, kind, index] of [
      ["STAFF_NEEDS_MAPPING", "staff", 1],
      ["PAYMENT_METHOD_NEEDS_MAPPING", "payment_methods", 7],
      ["CONCEPT_NEEDS_MAPPING", "services", 3],
      ["CATEGORY_NEEDS_MAPPING", "categories", 3],
    ] as const) {
      const name =
        corrections[row.source_row]?.cells[String(index) as "1" | "3" | "7"] ??
        row.raw_values[index]?.value ??
        "";
      if (name.trim() && row.anomalies.includes(code))
        needs[kind + ":" + canonical(name)] = { kind, name };
    }
  function correct(row: PreviewRow, index: string, value: string) {
    setCorrections((c) => ({
      ...c,
      [row.source_row]: {
        reason: c[row.source_row]?.reason ?? "",
        cells: { ...c[row.source_row]?.cells, [index]: value },
      },
    }));
    setDirty(true);
  }
  return (
    <Modal title="Importar Excel / Google Sheets" onClose={onClose}>
      <div className="stack">
        {error && <Notice error>{error}</Notice>}
        {done ? (
          <>
            <Notice>
              Histórico importado. Cada movimiento conserva su archivo, fila y
              valores originales.
            </Notice>
            <button onClick={onClose}>Cerrar</button>
          </>
        ) : (
          <>
            <p>
              En Google Sheets, descargá la planilla como Microsoft Excel
              (.xlsx). Cargá ese archivo aquí; se lee la hoja Registro Diario y
              el sistema vuelve a calcular los resúmenes.
            </p>
            <Field label="Archivo XLSX o CSV">
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setMapping({});
                  setCorrections({});
                  setExcluded([]);
                  setDirty(false);
                  setEditing(null);
                  setError("");
                }}
              />
            </Field>
            <small className="muted">
              Hasta 2 MiB. Analizar no guarda movimientos ni modifica el
              archivo.
            </small>
            {Object.entries(needs).map(([key, { kind, name }]) => (
              <Field key={key} label={`Vincular “${name}”`}>
                <select
                  disabled={busy}
                  value={
                    kind === "services"
                      ? mapping.services?.[canonical(name)]
                        ? "services:" + mapping.services[canonical(name)]
                        : mapping.items?.[canonical(name)]
                          ? "items:" + mapping.items[canonical(name)]
                          : ""
                      : (mapping[kind]?.[canonical(name)] ?? "")
                  }
                  onChange={(e) => {
                    const target =
                      kind === "services"
                        ? (e.target.value.split(":")[0] as "services" | "items")
                        : kind;
                    const id =
                      kind === "services"
                        ? e.target.value.split(":")[1]
                        : e.target.value;
                    setMapping((m) => ({
                      ...m,
                      ...(kind === "services"
                        ? {
                            services: { ...m.services, [canonical(name)]: "" },
                            items: { ...m.items, [canonical(name)]: "" },
                          }
                        : {}),
                      [target]: { ...m[target], [canonical(name)]: id ?? "" },
                    }));
                    setDirty(true);
                  }}
                >
                  <option value="">Elegir del catálogo</option>
                  {(kind === "services"
                    ? (["services", "items"] as const)
                    : [kind]
                  ).flatMap((group) =>
                    (catalog[group] ?? []).map((item) => (
                      <option
                        key={group + item.id}
                        value={
                          kind === "services" ? group + ":" + item.id : item.id
                        }
                      >
                        {String(item.name)}
                      </option>
                    )),
                  )}
                </select>
              </Field>
            ))}
            <button
              className="primary"
              disabled={busy || !file}
              aria-busy={busy}
              onClick={validate}
            >
              {busy
                ? "Procesando…"
                : preview
                  ? "Actualizar revisión"
                  : "Analizar archivo"}
            </button>
            {preview && (
              <>
                <Notice>
                  {ready} listas · {unresolved.length} por revisar ·{" "}
                  {
                    preview.rows.filter((r) => r.review_status === "EXCLUDED")
                      .length
                  }{" "}
                  excluidas.
                </Notice>
                <div className="kpi-grid">
                  {[
                    ["Ingresos a importar", totals.income],
                    ["Egresos a importar", totals.expense],
                    ["Saldo antes de comisiones", totals.balance],
                  ].map(([label, value]) => (
                    <div className="kpi" key={label}>
                      <span>{label}</span>
                      <strong>{money(value, w.organization.currency)}</strong>
                    </div>
                  ))}
                </div>
                <p className="muted">
                  Totales de las filas listas. Los costos POS y las comisiones
                  sin una regla histórica válida quedan pendientes; no se
                  reemplazan por cero.
                </p>
                {unresolved.length > 0 && <h3>Resolver filas pendientes</h3>}
                {Object.keys(corrections).length > 0 && (
                  <p>
                    {Object.keys(corrections).length} corrección(es) registradas
                    con su motivo. Podés verlas en la revisión de cada fila.
                  </p>
                )}
                {preview.rows
                  .filter(
                    (r) =>
                      r.review_status !== "READY" || editing === r.source_row,
                  )
                  .map((row) => (
                    <section className="panel stack" key={row.source_row}>
                      <strong>
                        Fila {row.source_row} ·{" "}
                        {row.raw_values[3]?.value || "Sin concepto"}
                      </strong>
                      <p>
                        {row.anomalies
                          .map((code) => importIssues[code] ?? code)
                          .join(" ")}
                      </p>
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={excluded.includes(row.source_row)}
                          onChange={(e) => {
                            setExcluded((v) =>
                              e.target.checked
                                ? [...v, row.source_row]
                                : v.filter((n) => n !== row.source_row),
                            );
                            setDirty(true);
                          }}
                        />{" "}
                        Excluir esta fila
                      </label>
                      {!excluded.includes(row.source_row) && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              setEditing(
                                editing === row.source_row
                                  ? null
                                  : row.source_row,
                              )
                            }
                          >
                            {editing === row.source_row
                              ? "Ocultar corrección"
                              : "Corregir fila"}
                          </button>
                          {editing === row.source_row && (
                            <>
                              <div className="form-grid">
                                {importColumns.map((label, i) => (
                                  <Field key={label} label={label}>
                                    {i === 4 ? (
                                      <select
                                        disabled={busy}
                                        value={
                                          corrections[row.source_row]?.cells[
                                            "4"
                                          ] ??
                                          row.raw_values[4]?.value ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          correct(row, "4", e.target.value)
                                        }
                                      >
                                        <option value="">Elegir</option>
                                        <option value="ingreso">Ingreso</option>
                                        <option value="egreso">Egreso</option>
                                      </select>
                                    ) : (
                                      <input
                                        disabled={busy}
                                        maxLength={250}
                                        value={
                                          corrections[row.source_row]?.cells[
                                            String(i) as "0"
                                          ] ??
                                          row.raw_values[i]?.value ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          correct(
                                            row,
                                            String(i),
                                            e.target.value,
                                          )
                                        }
                                      />
                                    )}
                                  </Field>
                                ))}
                              </div>
                              <Field label="Motivo de la corrección">
                                <input
                                  disabled={busy}
                                  maxLength={500}
                                  value={
                                    corrections[row.source_row]?.reason ?? ""
                                  }
                                  onChange={(e) => {
                                    setCorrections((c) => ({
                                      ...c,
                                      [row.source_row]: {
                                        cells: c[row.source_row]?.cells ?? {},
                                        reason: e.target.value,
                                      },
                                    }));
                                    setDirty(true);
                                  }}
                                />
                              </Field>
                              <small>
                                El original se conserva para poder revisar el
                                cambio.
                              </small>
                            </>
                          )}
                        </>
                      )}
                    </section>
                  ))}
                <details>
                  <summary>
                    Ver las {preview.rows.length} filas del archivo
                  </summary>
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Movimientos del archivo"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Fila</th>
                          <th>Fecha</th>
                          <th>Concepto</th>
                          <th>Importe</th>
                          <th>Estado</th>
                          <th>Revisar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.source_row}>
                            <td>{row.source_row}</td>
                            <td>
                              {String(
                                row.normalized.date ??
                                  row.raw_values[0]?.value ??
                                  "",
                              )}
                            </td>
                            <td>{String(row.normalized.concept ?? "")}</td>
                            <td>
                              {money(
                                row.normalized.amount_minor,
                                w.organization.currency,
                              )}
                            </td>
                            <td>
                              {row.review_status === "READY"
                                ? "Lista"
                                : row.review_status === "EXCLUDED"
                                  ? "Excluida"
                                  : "Por revisar"}
                            </td>
                            <td>
                              <button
                                disabled={busy}
                                onClick={() => setEditing(row.source_row)}
                              >
                                Revisar fila {row.source_row}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                {dirty && (
                  <Notice>
                    Actualizá la revisión para comprobar los cambios y los
                    totales.
                  </Notice>
                )}
                <button
                  className="primary"
                  disabled={
                    busy || dirty || unresolved.length > 0 || ready === 0
                  }
                  aria-busy={busy}
                  onClick={confirm}
                >
                  Confirmar importación de {ready} movimientos
                </button>
                <small>
                  Este paso registra el histórico. El mismo archivo no se puede
                  importar dos veces.
                </small>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
