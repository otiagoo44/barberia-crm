"use client";
import { useState } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { api } from "@/lib/client";
import { Modal, Field, Notice } from "@/components/ui";
import type { FinanceCatalog } from "./client";
import type { PreviewRow, ImportMapping } from "./import-parser";
import { MAX_IMPORT_UPLOAD_BYTES } from "./import-limits";
type Preview = {
  id?: string;
  preview_hash?: string;
  rows: PreviewRow[];
  dry_run?: boolean;
};
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
  const [excluded, setExcluded] = useState<number[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dirty, setDirty] = useState(false);
  function canonical(v: string) {
    return v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }
  async function validate() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > MAX_IMPORT_UPLOAD_BYTES)
        throw new Error(
          "El archivo supera 2 MiB. Prepará un CSV con los movimientos necesarios.",
        );
      const content = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("No se pudo leer el archivo."));
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.readAsDataURL(file);
      });
      setPreview(
        await api<Preview>("/api/finance/import", {
          org: w.organization.id,
          branch: w.branchId,
          key: crypto.randomUUID(),
          action: "preview",
          filename: file.name,
          content,
          mapping,
          excluded_rows: excluded,
          dry_run: dryRun,
        }),
      );
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview?.id || !preview.preview_hash) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/finance/import", {
        org: w.organization.id,
        branch: w.branchId,
        key: crypto.randomUUID(),
        action: "confirm",
        id: preview.id,
        preview_hash: preview.preview_hash,
      });
      setDone(true);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  const unresolved =
    preview?.rows.filter((r) => r.review_status === "NEEDS_REVIEW") ?? [];
  const needs: Record<string, { kind: keyof ImportMapping; name: string }> = {};
  for (const row of unresolved) {
    for (const [code, kind, index] of [
      ["STAFF_NEEDS_MAPPING", "staff", 1],
      ["PAYMENT_METHOD_NEEDS_MAPPING", "payment_methods", 7],
      ["CONCEPT_NEEDS_MAPPING", "services", 3],
      ["CATEGORY_NEEDS_MAPPING", "categories", 3],
    ] as const) {
      if (row.anomalies.includes(code)) {
        const name = row.raw_values[index]?.value ?? "";
        needs[kind + ":" + canonical(name)] = { kind, name };
      }
    }
  }
  return (
    <Modal title="Importar histórico 17:17" onClose={onClose}>
      <div className="stack">
        {error && <Notice error>{error}</Notice>}
        {done ? (
          <>
            <Notice>
              Importación registrada. El archivo, la fila y los valores
              originales quedaron vinculados a cada movimiento.
            </Notice>
            <button onClick={onClose}>Cerrar</button>
          </>
        ) : (
          <>
            <p>
              Se importan movimientos de Registro Diario. Las fórmulas y los
              resúmenes no se utilizan como importes históricos.
            </p>
            <Field label="Archivo XLSX o CSV">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setMapping({});
                  setExcluded([]);
                }}
              />
            </Field>
            <p className="muted">Máximo 2 MiB por archivo.</p>
            <label>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => {
                  setDryRun(e.target.checked);
                  setDirty(true);
                }}
              />{" "}
              Solo simulación: no guardar en la base
            </label>
            {Object.entries(needs).map(([key, { kind, name }]) => (
              <Field key={key} label={`Mapear “${name}”`}>
                <select
                  value={mapping[kind]?.[canonical(name)] ?? ""}
                  onChange={(e) => {
                    setMapping((m) => ({
                      ...m,
                      [kind]: { ...m[kind], [canonical(name)]: e.target.value },
                    }));
                    setDirty(true);
                  }}
                >
                  <option value="">Requiere selección explícita</option>
                  {(catalog[kind] ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {String(e.name)}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <button
              className="primary"
              disabled={busy || !file}
              onClick={validate}
            >
              {busy
                ? "Validando…"
                : dryRun
                  ? "Analizar sin guardar"
                  : "Guardar preview validado"}
            </button>
            {preview && (
              <>
                <Notice>
                  {
                    preview.rows.filter((r) => r.review_status === "READY")
                      .length
                  }{" "}
                  listas · {unresolved.length} requieren revisión ·{" "}
                  {
                    preview.rows.filter((r) => r.review_status === "EXCLUDED")
                      .length
                  }{" "}
                  excluidas.
                </Notice>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Estado / anomalía</th>
                        <th>Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.source_row}>
                          <td>{row.source_row}</td>
                          <td>{row.raw_values[0]?.value}</td>
                          <td>{row.raw_values[3]?.value}</td>
                          <td>
                            {row.review_status}
                            {row.anomalies.length > 0 && (
                              <small>{row.anomalies.join(", ")}</small>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Excluir fila ${row.source_row}`}
                              type="checkbox"
                              checked={excluded.includes(row.source_row)}
                              onChange={(e) => {
                                setExcluded((rows) =>
                                  e.target.checked
                                    ? [...rows, row.source_row]
                                    : rows.filter((n) => n !== row.source_row),
                                );
                                setDirty(true);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Notice>
                  Si no existe una regla válida para la fecha histórica, el fee
                  o la comisión quedarán como desconocidos. No se inferirán
                  desde la configuración actual.
                </Notice>
                {!dryRun && preview.id && (
                  <button
                    className="primary"
                    disabled={
                      busy || dirty || preview.dry_run || unresolved.length > 0
                    }
                    onClick={confirm}
                  >
                    Confirmar importación de las filas listas
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
