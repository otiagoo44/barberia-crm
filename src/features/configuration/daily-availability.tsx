"use client";
import { useState, type FormEvent } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, resourceUrl, useResource } from "@/lib/client";
import { Field, Notice, Loading } from "@/components/ui";
import type { DataRow, Page, Staff } from "@/lib/types";

export function DailyAvailability({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const w = useWorkspace();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const [day, setDay] = useState(() =>
    formatInTimeZone(new Date(), tz, "yyyy-MM-dd"),
  );
  const [editing, setEditing] = useState<DataRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const staff = useResource<Page<Staff>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  const assignments = useResource<Page<DataRow>>(
    w.branchId
      ? resourceUrl("staff_branch_assignments", {
          org: w.organization.id,
          branch: w.branchId,
        })
      : null,
  );
  const rows = useResource<{ items: DataRow[] }>(
    w.branchId
      ? resourceUrl("daily_availability", {
          org: w.organization.id,
          branch: w.branchId,
          date: day,
        })
      : null,
  );
  const people =
    staff.data?.items.filter(
      (s) =>
        s.active &&
        assignments.data?.items.some((a) => a.staff_id === s.id && a.active) &&
        (w.role !== "barber" || s.id === w.staffId),
    ) ?? [];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (String(form.get("starts_at")) >= String(form.get("ends_at")))
        throw new Error(
          "La hora de salida debe ser posterior a la de entrada.",
        );
      await api("/api/workspace/record", {
        org: w.organization.id,
        branch: w.branchId,
        entity: "staff_availability_exceptions",
        id: editing?.id ?? null,
        data: {
          staff_id: form.get("staff_id"),
          local_date: day,
          starts_at: form.get("starts_at"),
          ends_at: form.get("ends_at"),
          available: form.get("available") === "true",
          reason: String(form.get("reason") || "Turno acordado para el día"),
        },
      });
      setEditing(null);
      rows.reload();
      setMessage(
        "Disponibilidad guardada. Los horarios de reserva se actualizan automáticamente.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el turno.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="panel stack">
        <h2>Quién atiende cada día</h2>
        <p className="muted">
          Cargá los bloques que cada barbero puede cubrir. Podés tener un turno
          por la mañana y otro por la tarde, sin fijar un horario semanal.
        </p>
        <Field label="Día de trabajo">
          <input
            type="date"
            value={day}
            required
            onChange={(e) => {
              if (e.target.value) {
                setDay(e.target.value);
                setEditing(null);
                setMessage("");
              }
            }}
          />
        </Field>
        <p className="muted">
          Los bloques disponibles reemplazan el horario semanal de ese día. Los
          descansos se descuentan. Si hay citas comprometidas, reasignalas en
          Agenda antes de reducir el horario.
        </p>
      </div>
      {(rows.error || staff.error || assignments.error) && (
        <Notice error>{rows.error || staff.error || assignments.error}</Notice>
      )}
      {rows.loading ? (
        <Loading />
      ) : (
        <div className="panel stack">
          <h3>Bloques del {day}</h3>
          {!rows.data?.items.length && (
            <p className="muted">
              Sin bloques especiales para este día. Si no hay un horario semanal
              configurado, no se ofrecen turnos online.
            </p>
          )}
          {rows.data?.items.map((row) => (
            <div className="row between wrap" key={row.id}>
              <p>
                <strong>
                  {staff.data?.items.find((s) => s.id === row.staff_id)?.name ??
                    "Barbero"}
                </strong>{" "}
                · {String(row.starts_at).slice(0, 5)} a{" "}
                {String(row.ends_at).slice(0, 5)} ·{" "}
                {row.available ? "Disponible" : "Descanso / ausente"}
              </p>
              {!readOnly && (
                <button
                  onClick={() => {
                    setEditing(row);
                    setError("");
                    setMessage("");
                  }}
                >
                  Editar bloque
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <form
          key={`${w.branchId}:${day}:${editing?.id ?? "new"}`}
          className="panel stack"
          onSubmit={save}
        >
          <h3>{editing ? "Editar bloque" : "Agregar un bloque"}</h3>
          <div className="form-grid">
            <Field label="Barbero">
              <select
                name="staff_id"
                defaultValue={String(editing?.staff_id ?? "")}
                required
              >
                <option value="">Elegir barbero</option>
                {people.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Disponibilidad">
              <select
                name="available"
                defaultValue={String(editing?.available ?? true)}
              >
                <option value="true">Disponible para atender</option>
                <option value="false">Descanso / ausente</option>
              </select>
            </Field>
            <Field label="Desde">
              <input
                type="time"
                name="starts_at"
                defaultValue={String(editing?.starts_at ?? "").slice(0, 5)}
                required
              />
            </Field>
            <Field label="Hasta">
              <input
                type="time"
                name="ends_at"
                defaultValue={String(editing?.ends_at ?? "").slice(0, 5)}
                required
              />
            </Field>
          </div>
          <Field label="Nota (opcional)">
            <input
              name="reason"
              maxLength={300}
              defaultValue={String(editing?.reason ?? "")}
              placeholder="Por ejemplo: cubre el turno de la tarde"
            />
          </Field>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <div className="row wrap">
            <button className="primary" disabled={busy || !people.length}>
              {busy ? "Guardando…" : "Guardar disponibilidad"}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)}>
                Cancelar edición
              </button>
            )}
          </div>
          {!staff.loading && !assignments.loading && !people.length && (
            <Notice>
              Primero agregá el barbero y asignalo a esta sucursal.
            </Notice>
          )}
        </form>
      )}
    </div>
  );
}
