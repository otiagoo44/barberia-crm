"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/features/organizations/context";
import { api, useResource } from "@/lib/client";
import { Loading, Notice } from "@/components/ui";

type Person = {
  staff_id: string;
  name: string;
  own: boolean;
  status: "connected" | "disconnected" | "reconnect";
  email: string | null;
  pending: number;
  failed: number;
  last_error: string | null;
  last_synced_at: string | null;
};
export function GoogleCalendar() {
  const w = useWorkspace();
  const r = useResource<{ configured: boolean; people: Person[] }>(
    `/api/calendar/status?org=${w.organization.id}`,
  );
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  async function action(
    person: Person,
    kind: "connect" | "disconnect" | "retry",
  ) {
    setBusy(person.staff_id);
    setError("");
    try {
      const result = await api<{ url?: string }>(`/api/calendar/${kind}`, {
        org: w.organization.id,
        staff: person.staff_id,
      });
      if (result.url) window.location.assign(result.url);
      else r.reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la conexión.",
      );
    } finally {
      setBusy(null);
    }
  }
  const callback = useSearchParams().get("calendar");
  const feedback: Record<string, string> = {
    connected:
      "Google Calendar conectado. Los turnos futuros se sincronizan automáticamente.",
    calendar_email_mismatch:
      "Elegí la misma cuenta de Google que tu correo de acceso al CRM.",
    calendar_authorization_denied:
      "No autorizaste la conexión. Tus reservas siguen guardadas en el CRM.",
    calendar_permission_required:
      "Google no otorgó todos los permisos necesarios. Volvé a conectar y autorizá el calendario de Barbería OS.",
    calendar_connect_failed:
      "No se pudo completar la conexión. Volvé a intentarlo; las reservas siguen en el CRM.",
  };
  return (
    <section className="panel stack" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading">Google Calendar</h2>
      <p>
        Consultá tus turnos desde Google Calendar. Cambios de horario,
        profesional y cancelaciones se gestionan desde el CRM.
      </p>
      <p className="muted">
        Cada profesional conecta su propia cuenta. Se crea un calendario de
        Barbería OS; no se leen tus compromisos personales. No se envían
        invitaciones a clientes.
      </p>
      {callback && feedback[callback] && (
        <Notice error={callback !== "connected"}>{feedback[callback]}</Notice>
      )}
      {r.loading && <Loading />}
      {(r.error || error) && <Notice error>{r.error || error}</Notice>}
      {r.data && !r.data.configured && (
        <Notice>
          La conexión con Google todavía requiere completar la configuración del
          negocio. Tus reservas siguen funcionando en el CRM.
        </Notice>
      )}
      {r.data?.people?.map((person) => (
        <div className="panel stack" key={person.staff_id}>
          <h3>{person.name}</h3>
          <p>
            {person.status === "connected"
              ? `Conectado · ${person.email}`
              : person.status === "reconnect"
                ? "Necesita volver a autorizar Google"
                : "Sin conectar"}
          </p>
          {person.status === "connected" && (
            <p className="muted">
              {person.pending} turnos por sincronizar · {person.failed} con
              reintentos agotados.
              {person.last_synced_at
                ? ` Última sincronización: ${new Date(person.last_synced_at).toLocaleString("es-PY")}.`
                : " La primera sincronización está pendiente."}
            </p>
          )}
          {person.last_error && (
            <Notice error>
              {person.last_error === "authorization_required" ||
              person.last_error === "access_changed"
                ? "Revisá tu acceso y volvé a conectar Google."
                : "Google no respondió. El sistema reintenta automáticamente; la reserva está guardada."}
            </Notice>
          )}
          {person.own ? (
            <div className="actions">
              <button
                className="primary"
                disabled={!r.data?.configured || busy !== null}
                onClick={() => action(person, "connect")}
              >
                {busy === person.staff_id
                  ? "Procesando…"
                  : person.status === "disconnected"
                    ? "Conectar Google Calendar"
                    : "Volver a autorizar"}
              </button>
              {person.status === "connected" && person.failed > 0 && (
                <button
                  disabled={busy !== null}
                  onClick={() => action(person, "retry")}
                >
                  Reintentar sincronización
                </button>
              )}
              {person.status !== "disconnected" && (
                <button
                  disabled={busy !== null}
                  onClick={() => action(person, "disconnect")}
                >
                  Desconectar
                </button>
              )}
            </div>
          ) : (
            <small>
              Este profesional debe conectar Google desde su propia sesión.
            </small>
          )}
        </div>
      ))}
      {r.data && !r.data.people?.length && (
        <p>
          Tu cuenta debe estar vinculada a un profesional activo para conectar
          su calendario.
        </p>
      )}
      <small>
        La sincronización puede tardar unos minutos. Al desconectar se detienen
        las actualizaciones; los eventos ya creados permanecen en Google. Si
        cambiás un evento directamente en Google, ese cambio no modifica el CRM.
      </small>
    </section>
  );
}
