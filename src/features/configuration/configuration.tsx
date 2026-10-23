"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { RecordManager } from "./record-manager";
import { definitions } from "./definitions";
import { DailyAvailability } from "./daily-availability";
import { LaunchGuide } from "@/features/organizations/launch-guide";
import { useResource, resourceUrl, api } from "@/lib/client";
import { Field, Notice, Loading } from "@/components/ui";
import { roleLabels } from "@/lib/validation";
import type { DataRow, Page } from "@/lib/types";
export function Configuration({
  module,
}: {
  module: "equipo" | "servicios" | "sucursales" | "configuracion";
}) {
  const w = useWorkspace();
  const owner = w.role === "organization_owner";
  const lists = {
    sucursales: [
      "branches",
      "branch_business_hours",
      "branch_closures",
      "branch_settings",
    ],
    servicios: owner ? ["services", "branch_services"] : ["branch_services"],
    equipo:
      w.role === "barber"
        ? [
            "daily_availability",
            "staff_availability_rules",
            "staff_availability_exceptions",
            "staff_time_off",
          ]
        : owner
          ? [
              "daily_availability",
              "staff",
              "staff_branch_assignments",
              "staff_service_capabilities",
              "staff_availability_rules",
              "staff_availability_exceptions",
              "staff_time_off",
            ]
          : [
              "daily_availability",
              "staff_branch_assignments",
              "staff_availability_rules",
              "staff_availability_exceptions",
              "staff_time_off",
            ],
    configuracion: [
      "setup",
      "organization_settings",
      "memberships",
      "branding",
      "audit",
    ],
  };
  const options = lists[module];
  const [tab, setTab] = useState(options[0]);
  const settings = useResource<Page<DataRow>>(
    w.role === "barber"
      ? resourceUrl("organization_settings", { org: w.organization.id })
      : null,
  );
  const labels: Record<string, string> = {
    setup: "Puesta en marcha",
    daily_availability: "Turnos del día",
    memberships: "Usuarios y permisos",
    branding: "Identidad del negocio",
    audit: "Auditoría",
  };
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFIGURACIÓN OPERATIVA</span>
          <h1>
            {
              {
                equipo: w.role === "barber" ? "Mi disponibilidad" : "Equipo",
                servicios: "Servicios",
                sucursales: "Sucursales",
                configuracion: "Configuración",
              }[module]
            }
          </h1>
          <p>Usá los datos y las reglas reales del negocio.</p>
        </div>
      </div>
      <div
        className="config-tabs"
        role="group"
        aria-label="Secciones de configuración"
      >
        {options.map((key) => (
          <button
            aria-pressed={key === tab}
            className={key === tab ? "selected" : ""}
            onClick={() => setTab(key)}
            key={key}
          >
            {labels[key] ?? definitions[key]?.title}
          </button>
        ))}
      </div>
      {tab === "setup" ? (
        <LaunchGuide expanded />
      ) : tab === "daily_availability" ? (
        <DailyAvailability
          key={w.branchId}
          readOnly={
            w.role === "barber" &&
            !settings.data?.items[0]?.barber_can_edit_availability
          }
        />
      ) : tab === "memberships" ? (
        <Memberships />
      ) : tab === "branding" ? (
        <Branding />
      ) : tab === "audit" ? (
        <Audit />
      ) : (
        <RecordManager
          key={tab}
          entity={tab}
          readOnly={
            w.role === "barber" &&
            !settings.data?.items[0]?.barber_can_edit_availability
          }
        />
      )}
    </section>
  );
}
function Memberships() {
  const w = useWorkspace();
  const [cursor, setCursor] = useState<string | null>(null);
  const r = useResource<Page<DataRow>>(
    resourceUrl("organization_memberships", { org: w.organization.id, cursor }),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/membership", {
        org: w.organization.id,
        email: form.get("email"),
        role: form.get("role"),
        all_branches: form.has("all"),
        branches: form.getAll("branches"),
        active: form.has("active"),
      });
      r.reload();
      setMessage("Acceso actualizado. El cambio aplica inmediatamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="panel stack">
        <h2>Asignar o actualizar acceso</h2>
        <p className="muted">
          La persona debe registrar y confirmar su cuenta. Usá su mismo correo
          para darle acceso, cambiar el rol o desactivarla.
        </p>
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Correo registrado">
              <input name="email" type="email" required maxLength={254} />
            </Field>
            <Field label="Rol">
              <select name="role">
                <option value="receptionist">Recepción</option>
                <option value="manager">Encargado</option>
                <option value="barber">Barbero</option>
                <option value="finance">Finanzas</option>
                <option value="organization_owner">Propietario</option>
              </select>
            </Field>
          </div>
          <label className="check-label">
            <input type="checkbox" name="all" />
            Todas las sucursales (el encargado usa siempre las asignadas)
          </label>
          <div className="service-options">
            {w.branches.map((b) => (
              <label key={b.id} className="check-label">
                <input type="checkbox" name="branches" value={b.id} />
                {b.name}
              </label>
            ))}
          </div>
          <label className="check-label">
            <input type="checkbox" name="active" defaultChecked />
            Acceso activo
          </label>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice success>{message}</Notice>}
          <button aria-busy={!!busy} className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar acceso"}
          </button>
        </form>
      </div>
      <div
        className="table-wrap"
        role="region"
        aria-label="Usuarios y permisos. Tabla desplazable con teclado."
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {r.data?.items.map((m) => (
              <tr key={m.id}>
                <td>
                  {String(m.profile_name ?? m.email ?? "Cuenta registrada")}
                </td>
                <td>{roleLabels[String(m.role)]}</td>
                <td>{m.active ? "Activo" : "Desactivado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.data?.has_more && (
        <button onClick={() => setCursor(JSON.stringify(r.data?.next_cursor))}>
          Ver siguientes usuarios
        </button>
      )}
      {cursor && (
        <button onClick={() => setCursor(null)}>Volver al inicio</button>
      )}
    </div>
  );
}
function Branding() {
  const w = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/workspace/organization", {
        org: w.organization.id,
        data: {
          name: form.get("name"),
          logo_url: form.get("logo") || null,
          brand_color: form.get("color"),
          timezone: form.get("timezone"),
          currency: form.get("currency"),
        },
      });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <h2>Identidad del negocio</h2>
      <div className="form-grid">
        <Field label="Nombre">
          <input
            name="name"
            defaultValue={w.organization.name}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Logo (URL HTTPS)">
          <input
            name="logo"
            type="url"
            defaultValue={w.organization.logo_url ?? ""}
            maxLength={1000}
          />
        </Field>
        <Field label="Color principal">
          <input
            name="color"
            type="color"
            defaultValue={w.organization.brand_color}
          />
        </Field>
        <Field label="Zona horaria por defecto">
          <input
            name="timezone"
            defaultValue={w.organization.timezone}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Moneda ISO">
          <input
            name="currency"
            defaultValue={w.organization.currency}
            required
            pattern="[A-Z]{3}"
            maxLength={3}
          />
        </Field>
      </div>
      <p className="muted">
        Cada local puede usar una zona horaria distinta. Los precios de visitas
        anteriores conservan su moneda original.
      </p>
      <p>
        Reserva pública:{" "}
        <a
          href={`/book/${w.organization.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          /book/{w.organization.slug} ↗
        </a>
      </p>
      {error && <Notice error>{error}</Notice>}
      <button aria-busy={!!busy} className="primary" disabled={busy}>
        Guardar configuración
      </button>
    </form>
  );
}
function Audit() {
  const w = useWorkspace();
  const [cursor, setCursor] = useState<string | null>(null);
  const r = useResource<Page<DataRow>>(
    resourceUrl("audit_logs", { org: w.organization.id, cursor }),
  );
  return (
    <div className="stack">
      <h2>Acciones registradas</h2>
      {r.loading && !r.data && <Loading />}
      {r.error && <Notice error>{r.error}</Notice>}
      <div
        className="table-wrap"
        role="region"
        aria-label="Acciones registradas. Tabla desplazable con teclado."
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Referencia de solicitud</th>
            </tr>
          </thead>
          <tbody>
            {r.data?.items.map((log) => (
              <tr key={log.id}>
                <td>{new Date(String(log.created_at)).toLocaleString("es")}</td>
                <td>{String(log.action)}</td>
                <td>{String(log.request_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.data?.has_more && (
        <button onClick={() => setCursor(JSON.stringify(r.data?.next_cursor))}>
          Ver anteriores
        </button>
      )}
    </div>
  );
}
