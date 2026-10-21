"use client";
import { useSyncExternalStore, useState } from "react";
import { Field, Notice } from "./ui";
import { useWorkspace } from "@/features/organizations/context";
type SavedView = { name: string; value: string };
const eventName = "barberia-saved-view";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}
/** Personal preferences only. No customer data, search text or access scopes. */
export function SavedViews({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const w = useWorkspace();
  const key = `barberia.views.v1.${w.organization.id}.${w.profileId}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  let views: SavedView[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      views = parsed
        .filter(
          (v): v is SavedView =>
            !!v &&
            typeof v.name === "string" &&
            v.name.length <= 40 &&
            options.some(([key]) => key === v.value),
        )
        .slice(0, 8);
  } catch {
    /* damaged preferences never affect business data */
  }
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  function save(next: SavedView[]) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(eventName));
      setMessage("Vista guardada sólo en este navegador.");
    } catch {
      setMessage("No se pudo guardar la vista en este navegador.");
    }
  }
  return (
    <details className="saved-views">
      <summary>Vistas guardadas</summary>
      <div className="stack-sm">
        <Field label="Vista personal">
          <select
            value=""
            onChange={(e) => {
              const item = views[Number(e.target.value)];
              if (item) onChange(item.value);
            }}
          >
            <option value="">Elegir una vista guardada</option>
            {views.map((view, index) => (
              <option key={index} value={String(index)}>
                {view.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre de la vista">
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Por ejemplo: retornos pendientes"
          />
        </Field>
        <div className="row wrap">
          <button
            disabled={!name.trim() || views.length >= 8}
            onClick={() => {
              save([
                ...views.filter((v) => v.name !== name.trim()),
                { name: name.trim(), value },
              ]);
              setName("");
            }}
          >
            Guardar vista actual
          </button>
          {!!views.length && (
            <button onClick={() => save([])}>Borrar vistas personales</button>
          )}
        </div>
        <small>
          Guarda el filtro de retorno; no guarda búsquedas ni datos de clientes.
          Máximo 8.
        </small>
        {message && <Notice>{message}</Notice>}
      </div>
    </details>
  );
}
