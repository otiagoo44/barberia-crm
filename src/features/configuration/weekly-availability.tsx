"use client";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, resourceUrl, useResource } from "@/lib/client";
import { weekDays, weeklyBlocks } from "@/lib/weekly-schedule";
import { Field, Notice, Loading } from "@/components/ui";
import type { Page, DataRow } from "@/lib/types";

export function WeeklyAvailability() {
  const w = useWorkspace();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const tomorrow = format(
    addDays(new Date(today + "T12:00:00"), 1),
    "yyyy-MM-dd",
  );
  const people = useResource<Page<DataRow>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  const rules = useResource<Page<DataRow>>(
    resourceUrl("staff_availability_rules", {
      org: w.organization.id,
      branch: w.branchId,
    }),
  );
  const support = useResource<{ weekly_editor_supported: boolean }>(
    resourceUrl("weekly_schedule", {
      org: w.organization.id,
      branch: w.branchId,
    }),
  );
  const [staff, setStaff] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [from, setFrom] = useState(tomorrow);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("19:00");
  const [pause, setPause] = useState(false);
  const [pauseStart, setPauseStart] = useState("12:00");
  const [pauseEnd, setPauseEnd] = useState("12:30");
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // Retain the same command on ambiguous network failures, and renew when the
  // operator changes the payload. A retry cannot create another revision.
  const [command, setCommand] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const selected = rules.data?.items.filter((r) => r.staff_id === staff) ?? [];
  const complete = !rules.data?.has_more && !people.data?.has_more;
  let preview: ReturnType<typeof weeklyBlocks> = [];
  let invalid = "";
  try {
    preview = closed
      ? []
      : weeklyBlocks(
          days,
          start,
          end,
          pause ? pauseStart : "",
          pause ? pauseEnd : "",
        );
  } catch (e) {
    invalid = (e as Error).message;
  }
  async function save() {
    setError("");
    setMessage("");
    if (!staff || !days.length || invalid || from < tomorrow) {
      setError(
        invalid || "Elegí profesional, días y una fecha a partir de mañana.",
      );
      return;
    }
    const payload = {
      org: w.organization.id,
      branch: w.branchId,
      staff,
      from,
      days,
      blocks: preview,
      expected: selected
        .filter((r) => days.includes(Number(r.weekday)))
        .map((r) => ({ id: r.id, updated_at: String(r.updated_at) })),
    };
    const fingerprint = JSON.stringify(payload);
    const key =
      command?.fingerprint === fingerprint ? command.key : crypto.randomUUID();
    setCommand({ fingerprint, key });
    setBusy(true);
    try {
      await api("/api/workspace/weekly_schedule", { ...payload, key });
      setMessage(
        "Semana guardada. Se conservaron el historial anterior, las excepciones y las ausencias. Las reservas se comprobaron antes de confirmar.",
      );
      rules.reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar los horarios.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h2>Editor semanal</h2>
      <p>
        Copiá un turno a los días seleccionados. Reemplaza únicamente sus reglas
        recurrentes desde la fecha elegida; las excepciones diarias se
        administran en Turnos del día. Los descansos obligatorios se mantienen.
      </p>
      {(people.loading || rules.loading) && <Loading />}
      {(people.error || rules.error) && (
        <Notice error>
          {people.error || rules.error}{" "}
          <button
            onClick={() => {
              people.reload();
              rules.reload();
            }}
          >
            Reintentar
          </button>
        </Notice>
      )}
      {support.data?.weekly_editor_supported === false && (
        <Notice>
          El editor semanal requiere la migración pendiente. Los horarios
          actuales siguen disponibles en Disponibilidad semanal.
        </Notice>
      )}
      {support.error && <Notice error>{support.error}</Notice>}
      {!complete && (
        <Notice error>
          La lista tiene más páginas. Usá el editor individual para no
          sobrescribir horarios que todavía no se consultaron.
        </Notice>
      )}
      <div className="form-grid">
        <Field label="Profesional">
          <select
            value={staff}
            onChange={(e) => {
              setStaff(e.target.value);
              setMessage("");
            }}
          >
            <option value="">Elegí un profesional</option>
            {people.data?.items
              .filter((s) => s.active !== false)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Vigente desde">
          <input
            type="date"
            min={tomorrow}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
      </div>
      <fieldset>
        <legend>Días que querés modificar</legend>
        <div className="row wrap">
          {weekDays.map((label, day) => (
            <label className="check-label" key={day}>
              <input
                type="checkbox"
                checked={days.includes(day)}
                onChange={(e) =>
                  setDays(
                    e.target.checked
                      ? [...days, day].sort()
                      : days.filter((d) => d !== day),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check-label">
        <input
          type="checkbox"
          checked={closed}
          onChange={(e) => setClosed(e.target.checked)}
        />
        Cerrar los días seleccionados desde esa fecha
      </label>
      {!closed && (
        <>
          <div className="form-grid">
            <Field label="Inicio del turno">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Fin del turno">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={pause}
              onChange={(e) => setPause(e.target.checked)}
            />
            Agregar descanso
          </label>
          {pause && (
            <div className="form-grid">
              <Field label="Inicio del descanso">
                <input
                  type="time"
                  value={pauseStart}
                  onChange={(e) => setPauseStart(e.target.value)}
                />
              </Field>
              <Field label="Fin del descanso">
                <input
                  type="time"
                  value={pauseEnd}
                  onChange={(e) => setPauseEnd(e.target.value)}
                />
              </Field>
            </div>
          )}
        </>
      )}
      <h3>Vista previa semanal desde {from}</h3>
      <ul>
        {weekDays.map((label, day) => (
          <li key={day}>
            <strong>{label}:</strong>{" "}
            {days.includes(day)
              ? closed
                ? "Cerrado"
                : invalid ||
                  preview
                    .filter((b) => b.weekday === day)
                    .map((b) => `${b.starts_at}–${b.ends_at}`)
                    .join(" · ")
              : "Conserva su configuración"}
          </li>
        ))}
      </ul>
      {staff && (
        <details>
          <summary>Horarios guardados · copiar para editar</summary>
          <ul>
            {selected
              .filter((r) => !r.valid_until || String(r.valid_until) >= from)
              .map((r) => (
                <li key={r.id}>
                  {weekDays[Number(r.weekday)]}{" "}
                  {String(r.starts_at).slice(0, 5)}–
                  {String(r.ends_at).slice(0, 5)} · desde{" "}
                  {String(r.valid_from ?? "siempre")}{" "}
                  <button
                    onClick={() => {
                      setDays([Number(r.weekday)]);
                      setStart(String(r.starts_at).slice(0, 5));
                      setEnd(String(r.ends_at).slice(0, 5));
                      setPause(false);
                      setClosed(false);
                    }}
                  >
                    Copiar franja
                  </button>
                </li>
              ))}
          </ul>
          <p>
            Para una jornada partida, cargá el turno completo y activá su
            descanso.
          </p>
        </details>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice success>{message}</Notice>}
      <button
        className="primary"
        disabled={
          busy ||
          !support.data?.weekly_editor_supported ||
          !complete ||
          !!rules.error ||
          !!people.error ||
          rules.loading ||
          !rules.data
        }
        aria-busy={busy}
        onClick={save}
      >
        {busy ? "Guardando…" : "Guardar semana"}
      </button>
    </section>
  );
}
