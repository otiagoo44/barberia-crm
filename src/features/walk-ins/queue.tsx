"use client";
import { useState } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { useResource, resourceUrl, api } from "@/lib/client";
import { useLive } from "@/hooks/use-live";
import { BookingForm } from "@/features/appointments/booking-form";
import { AppointmentDialog } from "@/features/appointments/appointment-dialog";
import { Empty, Notice, Loading, Badge } from "@/components/ui";
import type { DataRow, Appointment } from "@/lib/types";
export function WalkIns() {
  const w = useWorkspace();
  const r = useResource<{
    staff: {
      id: string;
      name: string;
      working: boolean;
      available_now: boolean;
    }[];
    queue: DataRow[];
  }>(
    w.branchId
      ? resourceUrl("day", { org: w.organization.id, branch: w.branchId })
      : null,
  );
  const [newEntry, setNewEntry] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const live = useLive(w.organization.id, w.branchId, (c) => {
    if (
      [
        "walk_in_entries",
        "appointments",
        "staff_time_off",
        "staff_availability_exceptions",
      ].includes(c.table ?? "") ||
      c.type === "reconnected" ||
      c.type === "visible"
    )
      r.reload();
  });
  async function action(row: DataRow, type: string) {
    setBusy(row.id);
    setError("");
    try {
      if (type === "assign")
        await api("/api/workspace/assign_walkin", {
          org: w.organization.id,
          id: row.id,
          staff: null,
          starts_at: new Date().toISOString(),
          key: crypto.randomUUID(),
        });
      else if (type === "open") {
        const a = await api<Appointment>(
          resourceUrl("appointment", {
            org: w.organization.id,
            id: String(row.appointment_id),
          }),
        );
        setAppointment(a);
      } else
        await api("/api/workspace/close_walkin", {
          org: w.organization.id,
          id: row.id,
          status: type,
          key: crypto.randomUUID(),
        });
      r.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }
  if (!w.branchId)
    return <Empty title="Configurá una sucursal para comenzar" />;
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SIN TURNO</span>
          <h1>Walk-ins</h1>
          <p>
            Quién espera, quién está atendiendo y quién puede recibir al próximo
            cliente.
          </p>
        </div>
        {w.role !== "barber" && (
          <button className="primary" onClick={() => setNewEntry(true)}>
            + Agregar a la cola
          </button>
        )}
      </div>
      <div className="team-state">
        {r.data?.staff.map((s) => (
          <span className={s.available_now ? "available" : ""} key={s.id}>
            {s.name} ·{" "}
            {s.working
              ? "En servicio"
              : s.available_now
                ? "Disponible"
                : "Sin disponibilidad"}
          </span>
        ))}
      </div>
      <div className="toolbar">
        <button onClick={r.reload}>Actualizar</button>
        <span className="realtime-state">{live}</span>
        <small>
          La espera es una estimación del próximo hueco compatible; puede
          cambiar con la cola.
        </small>
      </div>
      {(r.error || error) && <Notice error>{r.error || error}</Notice>}
      {r.loading && !r.data && <Loading />}
      <div className="stack">
        {r.data?.queue.map((row, index) => (
          <article className="queue-card" key={row.id}>
            <div>
              <h3>
                {index + 1}. {String(row.customer_name)}
              </h3>
              <Badge
                status={String(row.status)}
                label={
                  {
                    waiting: "Esperando",
                    assigned: "Asignado",
                    in_service: "En servicio",
                  }[String(row.status)] ?? String(row.status)
                }
              />
              <small>
                {row.estimated_wait_minutes === null
                  ? "Sin disponibilidad estimada hoy"
                  : `Próximo hueco en aproximadamente ${String(row.estimated_wait_minutes)} min`}
              </small>
              <small>
                Ingresó{" "}
                {new Date(String(row.created_at)).toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className="row">
              {row.status === "waiting" && w.role !== "barber" ? (
                <>
                  <button
                    aria-busy={!!busy}
                    className="primary"
                    disabled={busy === row.id}
                    onClick={() => action(row, "assign")}
                  >
                    Asignar disponible
                  </button>
                  <button
                    aria-busy={!!busy}
                    disabled={busy === row.id}
                    onClick={() => action(row, "left")}
                  >
                    Se retiró
                  </button>
                  <button
                    aria-busy={!!busy}
                    disabled={busy === row.id}
                    onClick={() => action(row, "cancelled")}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  aria-busy={!!busy}
                  disabled={busy === row.id}
                  onClick={() => action(row, "open")}
                >
                  Abrir servicio
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {r.data && !r.data.queue.length && (
        <Empty title="Nadie está esperando">
          La cola está lista para recibir clientes sin turno.
        </Empty>
      )}
      {newEntry && (
        <BookingForm
          mode="walkin"
          onClose={() => setNewEntry(false)}
          onSaved={() => {
            setNewEntry(false);
            r.reload();
          }}
        />
      )}
      {appointment && (
        <AppointmentDialog
          appointment={appointment}
          onClose={() => setAppointment(null)}
          onChanged={() => r.reload()}
        />
      )}
    </section>
  );
}
