"use client";
import { useClock } from "@/hooks/use-clock";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api } from "@/lib/client";
import { statusLabels } from "@/lib/validation";
import { Modal, Badge, Notice } from "@/components/ui";
import type { Appointment } from "@/lib/types";
import { BookingForm } from "./booking-form";
import { CheckoutDialog } from "@/features/finance/checkout";
export function AppointmentDialog({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: (a: Appointment) => void;
}) {
  const w = useWorkspace();
  const [a, setA] = useState(appointment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [booking, setBooking] = useState<"reschedule" | "rebooking" | null>(
    null,
  );
  const tz =
    w.branches.find((b) => b.id === a.branch_id)?.timezone ??
    w.organization.timezone;
  const now = useClock();
  const operator = w.role !== "barber";
  const due = new Date(a.starts_at).valueOf() <= now + 30 * 60000;
  const [operationKeys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        "confirmed",
        "checked_in",
        "in_service",
        "completed",
        "cancelled",
        "no_show",
      ].map((s) => [s, crypto.randomUUID()]),
    ),
  );
  async function change(status: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/transition", {
        org: w.organization.id,
        id: a.id,
        status,
        key: operationKeys[status],
        reason: status === "cancelled" ? reason || null : null,
      });
      const next = { ...a, status };
      setA(next);
      onChanged(next);
      if (status === "completed" && operator) setCheckout(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  if (checkout)
    return (
      <CheckoutDialog
        appointmentId={a.id}
        branchId={a.branch_id}
        onClose={() => setCheckout(false)}
      />
    );
  if (booking)
    return (
      <BookingForm
        mode={booking}
        appointment={a}
        onClose={() => setBooking(null)}
        onSaved={() => {
          onChanged(a);
          onClose();
        }}
      />
    );
  return (
    <Modal title={a.customer_name} onClose={onClose}>
      <div className="stack">
        <div className="row between">
          <Badge status={a.status} label={statusLabels[a.status]} />
          <span>
            {formatInTimeZone(a.starts_at, tz, "dd/MM · HH:mm")}–
            {formatInTimeZone(a.ends_at, tz, "HH:mm")}
          </span>
        </div>
        <p>
          {a.services.map((s) => s.name).join(" + ")} · {a.duration_minutes} min
        </p>
        <p className="muted">
          {a.staff_name} · {tz}
        </p>
        {error && <Notice error>{error}</Notice>}
        <div className="row wrap">
          {operator && a.status === "scheduled" && (
            <button
              aria-busy={!!busy}
              disabled={busy}
              onClick={() => change("confirmed")}
            >
              Confirmar
            </button>
          )}
          {["scheduled", "confirmed"].includes(a.status) && (
            <button
              aria-busy={!!busy}
              className="primary"
              disabled={busy || !due}
              onClick={() => change("checked_in")}
            >
              Check-in
            </button>
          )}
          {a.status === "checked_in" && (
            <button
              aria-busy={!!busy}
              className="primary"
              disabled={busy || !due}
              onClick={() => change("in_service")}
            >
              Iniciar servicio
            </button>
          )}
          {a.status === "in_service" && (
            <button
              aria-busy={!!busy}
              className="primary"
              disabled={busy}
              onClick={() => change("completed")}
            >
              Completar servicio
            </button>
          )}
          {operator && ["scheduled", "confirmed"].includes(a.status) && (
            <button
              aria-busy={!!busy}
              disabled={busy}
              onClick={() => setBooking("reschedule")}
            >
              Reprogramar
            </button>
          )}
          {operator &&
            ["scheduled", "confirmed"].includes(a.status) &&
            new Date(a.starts_at).valueOf() <= now && (
              <button
                aria-busy={!!busy}
                disabled={busy}
                onClick={() => change("no_show")}
              >
                No asistió
              </button>
            )}
        </div>
        {!due && ["scheduled", "confirmed"].includes(a.status) && (
          <small>El check-in se habilita 30 minutos antes del turno.</small>
        )}
        {a.status === "completed" && (
          <div className="panel stack">
            {operator && (
              <button className="primary" onClick={() => setCheckout(true)}>
                Cobrar / ver checkout
              </button>
            )}
            <h3>¿Agendar próxima visita?</h3>
            <p className="muted">
              Te sugeriremos una fecha según los servicios y la frecuencia del
              cliente.
            </p>
            <button className="primary" onClick={() => setBooking("rebooking")}>
              Agendar próximo turno
            </button>
          </div>
        )}
        {operator &&
          ["scheduled", "confirmed", "checked_in"].includes(a.status) && (
            <details>
              <summary>Cancelar reserva</summary>
              <div className="stack-sm" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Motivo (opcional)</span>
                  <input
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  aria-busy={!!busy}
                  className="danger"
                  disabled={busy}
                  onClick={() => change("cancelled")}
                >
                  Confirmar cancelación
                </button>
              </div>
            </details>
          )}
      </div>
    </Modal>
  );
}
