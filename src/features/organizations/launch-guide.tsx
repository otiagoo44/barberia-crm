"use client";
import Link from "next/link";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CircleCheck, CircleAlert, Info } from "lucide-react";
import { useWorkspace } from "./context";
import { resourceUrl, useResource } from "@/lib/client";
import { Notice, Loading, Field } from "@/components/ui";
import type { SetupStatus } from "@/services/setup-status";

export function LaunchGuide({ expanded = false }: { expanded?: boolean }) {
  const w = useWorkspace();
  const [open, setOpen] = useState(expanded);
  const timezone =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const [day, setDay] = useState(
    formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"),
  );
  const r = useResource<SetupStatus>(
    open
      ? resourceUrl("setup", {
          org: w.organization.id,
          branch: w.branchId,
          date: day,
        })
      : null,
  );
  const ready = r.data?.checks.filter((c) => c.status === "ready").length ?? 0;
  const pending = r.data?.checks.filter((c) => c.status === "pending").length ?? 0;
  const manual = r.data?.checks.filter((c) => c.status === "manual").length ?? 0;
  return (
    <details
      className="launch-guide"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>Puesta en marcha</strong>
          <small>Comprobá tu equipo, horarios, cobros y seguridad</small>
        </span>
        <span className="badge">
          {r.loading
            ? "Consultando…"
            : r.data
              ? `${ready} comprobadas · ${pending} ${pending === 1 ? "pendiente" : "pendientes"} · ${manual} ${manual === 1 ? "manual" : "manuales"}`
              : "Revisar configuración"}
        </span>
      </summary>
      {open && (
        <div className="launch-guide-body">
          <div className="setup-summary">
            <Field label="Día que querés comprobar">
              <input
                type="date"
                value={day}
                required
                onChange={(event) => setDay(event.target.value)}
              />
            </Field>
            <button onClick={r.reload} disabled={r.loading}>
              Volver a comprobar
            </button>
          </div>
          {r.loading && <Loading />}
          {r.error && (
            <Notice error>
              {r.error} <button onClick={r.reload}>Reintentar</button>
            </Notice>
          )}
          {r.data && (
            <>
              <progress
                className="setup-progress"
                aria-label="Comprobaciones operativas listas"
                value={ready}
                max={r.data.checks.length}
              />
              <ol className="launch-checklist">
                {r.data.checks.map((check) => (
                  <li key={check.key}>
                    <Link
                      href={
                        check.module.startsWith("/")
                          ? check.module
                          : `/${w.organization.slug}/${check.module || "configuracion"}`
                      }
                    >
                      <strong>{check.label}</strong>
                      <span className={`setup-status ${check.status}`}>
                        {check.status === "ready" ? (
                          <CircleCheck size={18} aria-hidden="true" />
                        ) : check.status === "pending" ? (
                          <CircleAlert size={18} aria-hidden="true" />
                        ) : (
                          <Info size={18} aria-hidden="true" />
                        )}
                        {check.status === "ready"
                          ? "Comprobado"
                          : check.status === "pending"
                            ? "Falta revisar"
                            : "Verificación manual"}
                      </span>
                      <span>{check.detail}</span>
                      {check.steps && (
                        <ul>
                          {check.steps.map((step) => (
                            <li key={step.label}>
                              <strong>{step.label}: </strong>
                              {step.status === "ready"
                                ? "Comprobado"
                                : step.status === "pending"
                                  ? "Pendiente"
                                  : "Verificación manual"}
                              . {step.detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="muted">
                Consultado a las{" "}
                {new Date(r.data.checked_at).toLocaleTimeString("es-PY", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . Este diagnóstico no habilita reservas ni distribuciones.
                Las comprobaciones manuales necesitan evidencia externa y no
                significan que la configuración esté incompleta.
              </p>
            </>
          )}
          <div className="launch-actions" style={{ marginTop: 24 }}>
            <Link className="primary" href={`/${w.organization.slug}/equipo`}>
              Configurar equipo y horarios
            </Link>
            <Link href={`/${w.organization.slug}/caja`}>Ir a caja →</Link>
          </div>
        </div>
      )}
    </details>
  );
}
