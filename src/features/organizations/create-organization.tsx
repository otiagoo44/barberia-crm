"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";
export function CreateOrganization() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/create_organization", {
        name: data.get("name"),
        slug: data.get("slug"),
        timezone: data.get("timezone"),
        currency: data.get("currency"),
        owner_email: data.get("email"),
      });
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel stack">
      <h2>Nueva organización</h2>
      <p className="muted">El propietario debe tener una cuenta registrada.</p>
      <div className="form-grid">
        <Field label="Nombre">
          <input name="name" required maxLength={120} />
        </Field>
        <Field label="Identificador de la URL">
          <input
            name="slug"
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            required
            placeholder="nombre-del-negocio"
          />
        </Field>
        <Field label="Correo del propietario">
          <input type="email" name="email" required />
        </Field>
        <Field label="Zona horaria">
          <input
            name="timezone"
            defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
            required
          />
        </Field>
        <Field label="Moneda (ISO)">
          <input
            name="currency"
            pattern="[A-Z]{3}"
            maxLength={3}
            defaultValue="USD"
            required
          />
        </Field>
      </div>
      {error && <Notice error>{error}</Notice>}
      <button aria-busy={!!busy} className="primary" disabled={busy}>
        {busy ? "Creando…" : "Crear organización"}
      </button>
    </form>
  );
}
