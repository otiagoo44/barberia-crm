"use client";
import { useState, type FormEvent } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, resourceUrl, useResource } from "@/lib/client";
import { Field, Notice, Loading, Empty, Modal } from "@/components/ui";
import type { DataRow, Page, Staff, Service } from "@/lib/types";

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
  const [selectedStaff, setSelectedStaff] = useState("");
  const [service, setService] = useState("");
  const [revision, setRevision] = useState(0);
  const [extraBlocks, setExtraBlocks] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [copyKey, setCopyKey] = useState(() => crypto.randomUUID());
  const services = useResource<Page<Service>>(
    resourceUrl("services", { org: w.organization.id }),
  );
  const slots = useResource<{ starts_at: string; staff_id: string }[]>(
    selectedStaff && service
      ? resourceUrl("availability", {
          org: w.organization.id,
          branch: w.branchId,
          staff: selectedStaff,
          service,
          date: day,
          revision: String(revision),
        })
      : null,
  );
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
      if (!editing) {
        const starts = form.getAll("starts_at").map(String),
          ends = form.getAll("ends_at").map(String),
          kinds = form.getAll("available").map(String);
        const blocks = starts.map((starts_at, i) => ({
          starts_at,
          ends_at: ends[i],
          available: kinds[i] === "true",
          reason: String(
            form.get("reason") || "Bloque confirmado para la fecha",
          ),
        }));
        if (blocks.some((b) => b.starts_at >= b.ends_at))
          throw new Error("Cada bloque debe terminar después de su inicio.");
        await api("/api/workspace/daily_blocks", {
          org: w.organization.id,
          branch: w.branchId,
          staff: form.get("staff_id"),
          date: day,
          blocks,
          key: crypto.randomUUID(),
        });
        setExtraBlocks([]);
      } else
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
      setRevision((v) => v + 1);
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
                setExtraBlocks([]);
                setMessage("");
              }
            }}
          />
        </Field>
        <Field label="Profesional del día">
          <select
            value={selectedStaff}
            onChange={(e) => {
              setSelectedStaff(e.target.value);
              setEditing(null);
            }}
          >
            <option value="">Todo el equipo</option>
            {people.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
          <div className="row between wrap">
            <h3>Bloques del {day}</h3>
            {!readOnly &&
              selectedStaff &&
              rows.data?.items.some(
                (row) => row.staff_id === selectedStaff,
              ) && (
                <button
                  onClick={() => {
                    setCopyKey(crypto.randomUUID());
                    setCopying(true);
                  }}
                >
                  Copiar bloques a otra fecha
                </button>
              )}
          </div>
          {!rows.data?.items.length && (
            <p className="muted">
              Sin bloques especiales para este día. Si no hay un horario semanal
              configurado, no se ofrecen turnos online.
            </p>
          )}
          {people
            .filter((s) => !selectedStaff || s.id === selectedStaff)
            .map((s) => {
              const blocks =
                rows.data?.items.filter((row) => row.staff_id === s.id) ?? [];
              const minutes = (v: unknown) => {
                const [h, m] = String(v).split(":").map(Number);
                return h * 60 + m;
              };
              return (
                <section className="availability-day" key={s.id}>
                  <h3>{s.name}</h3>
                  <div className="availability-bar" aria-hidden="true">
                    {blocks.map((row) => (
                      <span
                        key={row.id}
                        className={!row.available ? "break" : ""}
                        style={{
                          left: `${minutes(row.starts_at) / 14.4}%`,
                          width: `${(minutes(row.ends_at) - minutes(row.starts_at)) / 14.4}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="availability-hours">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>24:00</span>
                  </div>
                  {!blocks.length && (
                    <p className="muted">
                      Sin bloques cargados para esta fecha.
                    </p>
                  )}
                  {blocks.map((row) => (
                    <div className="availability-block" key={row.id}>
                      <p>
                        <strong>
                          {staff.data?.items.find((s) => s.id === row.staff_id)
                            ?.name ?? "Barbero"}
                        </strong>{" "}
                        · {String(row.starts_at).slice(0, 5)} a{" "}
                        {String(row.ends_at).slice(0, 5)} ·{" "}
                        {row.available ? "Disponible" : "Descanso / ausente"}
                      </p>
                      {!readOnly && (
                        <button
                          onClick={() => {
                            setEditing(row);
                            setExtraBlocks([]);
                            setError("");
                            setMessage("");
                          }}
                        >
                          Editar bloque
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}
        </div>
      )}
      {!readOnly && (
        <form
          key={`${w.branchId}:${day}:${selectedStaff}:${editing?.id ?? "new"}:${revision}`}
          className="panel stack"
          onSubmit={save}
        >
          <h3>{editing ? "Editar bloque" : "Agregar un bloque"}</h3>
          <div className="form-grid">
            <Field label="Barbero">
              <select
                name="staff_id"
                defaultValue={String(editing?.staff_id ?? selectedStaff)}
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
          {!editing &&
            extraBlocks.map((id) => (
              <div className="form-grid" key={id}>
                <Field label="Tipo de bloque adicional">
                  <select name="available">
                    <option value="true">Disponible para atender</option>
                    <option value="false">Descanso / ausente</option>
                  </select>
                </Field>
                <Field label="Desde (bloque adicional)">
                  <input type="time" name="starts_at" required />
                </Field>
                <Field label="Hasta (bloque adicional)">
                  <input type="time" name="ends_at" required />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    setExtraBlocks((v) => v.filter((x) => x !== id))
                  }
                >
                  Quitar bloque adicional
                </button>
              </div>
            ))}
          {!editing && (
            <button
              type="button"
              disabled={extraBlocks.length >= 15}
              onClick={() => setExtraBlocks((v) => [...v, crypto.randomUUID()])}
            >
              Agregar otro bloque o descanso
            </button>
          )}
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
      {copying && (
        <Modal
          title="Copiar bloques confirmados"
          onClose={() => !busy && setCopying(false)}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const target = new FormData(e.currentTarget).get("target");
              try {
                if (target === day) throw new Error("Elegí otra fecha.");
                const blocks =
                  rows.data?.items
                    .filter((row) => row.staff_id === selectedStaff)
                    .map((row) => ({
                      starts_at: String(row.starts_at).slice(0, 5),
                      ends_at: String(row.ends_at).slice(0, 5),
                      available: !!row.available,
                      reason: `Copiado explícitamente del ${day}`,
                    })) ?? [];
                await api("/api/workspace/daily_blocks", {
                  org: w.organization.id,
                  branch: w.branchId,
                  staff: selectedStaff,
                  date: target,
                  blocks,
                  key: copyKey,
                });
                setDay(String(target));
                setCopying(false);
                setRevision((v) => v + 1);
                setMessage(
                  "Bloques copiados a la fecha elegida. Se conservaron las citas existentes.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Profesional: {people.find((s) => s.id === selectedStaff)?.name}.
              Se copiarán los bloques y descansos del {day}. No elimina otros
              bloques ni modifica citas.
            </p>
            <Field label="Fecha de destino">
              <input type="date" name="target" required />
            </Field>
            <label className="check-label">
              <input type="checkbox" required /> Confirmo que el profesional
              atenderá en estos bloques de la fecha elegida.
            </label>
            {error && <Notice error>{error}</Notice>}
            <button className="primary" disabled={busy}>
              Confirmar copia
            </button>
          </form>
        </Modal>
      )}
      <section className="panel stack">
        <h2>Comprobar horas reservables</h2>
        <p className="muted">
          Consulta el motor real con duración, descansos, citas y
          compatibilidad. Los bloques cargados no garantizan lugar para
          cualquier servicio.
        </p>
        <Field label="Servicio para comprobar">
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Elegir servicio</option>
            {services.data?.items
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.default_duration_minutes} min
                </option>
              ))}
          </select>
        </Field>
        {!selectedStaff && (
          <p>Elegí un profesional para consultar sus horas disponibles.</p>
        )}
        {slots.loading && <Loading />}
        {slots.error && <Notice error>{slots.error}</Notice>}
        {slots.data &&
          (slots.data.length ? (
            <div className="slot-grid">
              {[...new Set(slots.data.map((s) => s.starts_at))].map((t) => (
                <span className="badge active" key={t}>
                  {formatInTimeZone(t, tz, "HH:mm")}
                </span>
              ))}
            </div>
          ) : (
            <Empty title="Sin horas reservables para esta selección" />
          ))}
      </section>
    </div>
  );
}
