"use client";
import { useState, useEffect, type FormEvent } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, useResource, resourceUrl } from "@/lib/client";
import { normalizePhone } from "@/lib/validation";
import { Modal, Field, Notice, Loading } from "@/components/ui";
import { ServicePicker } from "@/features/services/service-picker";
import type { Service, Staff, DataRow, Page, Appointment } from "@/lib/types";
type Slot = {
  starts_at: string;
  staff_id: string;
  staff_name: string;
  duration_minutes: number;
};
export function BookingForm({
  mode = "booking",
  appointment,
  customer: initialCustomer,
  onClose,
  onSaved,
}: {
  mode?: "booking" | "reschedule" | "rebooking" | "walkin";
  appointment?: Appointment;
  customer?: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const [key] = useState(() => crypto.randomUUID());
  const [services, setServices] = useState<string[]>(
    appointment?.services.map((s) => s.id) ?? [],
  );
  const [staff, setStaff] = useState(
    w.role === "barber"
      ? (w.staffId ?? "")
      : mode === "reschedule"
        ? (appointment?.staff_id ?? "")
        : "",
  );
  const [date, setDate] = useState(
    mode === "reschedule" && appointment
      ? formatInTimeZone(appointment.starts_at, tz, "yyyy-MM-dd")
      : "",
  );
  const [start, setStart] = useState("");
  const [customer, setCustomer] = useState(
    initialCustomer ??
      (appointment
        ? { id: appointment.customer_id, name: appointment.customer_name }
        : null),
  );
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const catalog = useResource<Page<Service>>(
    resourceUrl("services", { org: w.organization.id }),
  );
  const localServices = useResource<Page<DataRow>>(
    resourceUrl("branch_services", {
      org: w.organization.id,
      branch: w.branchId,
    }),
  );
  const people = useResource<Page<Staff>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  const assignment = useResource<Page<DataRow>>(
    resourceUrl("staff_branch_assignments", {
      org: w.organization.id,
      branch: w.branchId,
    }),
  );
  const detail = useResource<{ customer: DataRow }>(
    mode === "rebooking" && customer
      ? resourceUrl("customer", { org: w.organization.id, id: customer.id })
      : null,
  );
  const dateValue =
    date ||
    (mode === "rebooking" && detail.data?.customer.expected_return_at
      ? formatInTimeZone(
          String(detail.data.customer.expected_return_at),
          tz,
          "yyyy-MM-dd",
        )
      : formatInTimeZone(new Date(), tz, "yyyy-MM-dd"));
  const eligibleServices = (catalog.data?.items ?? []).filter(
    (s) =>
      s.active &&
      localServices.data?.items.some(
        (bs) => bs.service_id === s.id && bs.active,
      ),
  );
  const localStaff = (people.data?.items ?? []).filter(
    (s) =>
      s.active &&
      assignment.data?.items.some((a) => a.staff_id === s.id && a.active),
  );
  const customers = useResource<Page<DataRow>>(
    query.length >= 2 && !customer && !newCustomer
      ? resourceUrl("customers", {
          org: w.organization.id,
          branch: w.branchId,
          q: query,
        })
      : null,
  );
  const availabilityQuery = new URLSearchParams({
    org: w.organization.id,
    branch: w.branchId,
    date: dateValue,
  });
  services.forEach((id) => availabilityQuery.append("service", id));
  if (staff) availabilityQuery.set("staff", staff);
  const availability = useResource<Slot[]>(
    mode !== "walkin" && services.length
      ? `/api/workspace/availability?${availabilityQuery}`
      : null,
  );
  const times = [...new Set(availability.data?.map((s) => s.starts_at) ?? [])];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!services.length) {
      setError("Seleccioná al menos un servicio principal.");
      return;
    }
    if (
      mode !== "walkin" &&
      (!start || !availability.data?.some((s) => s.starts_at === start))
    ) {
      setError("Elegí un horario disponible.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const common = {
        org: w.organization.id,
        branch: w.branchId,
        services,
        customer: customer?.id ?? null,
        customer_data: customer
          ? null
          : {
              name: form.get("name"),
              normalized_phone: normalizePhone(String(form.get("phone"))),
              email: String(form.get("email") ?? ""),
            },
        key,
      };
      if (mode === "walkin")
        await api("/api/workspace/walkin", {
          ...common,
          preferred_staff: staff || null,
        });
      else if (mode === "reschedule")
        await api("/api/workspace/reschedule", {
          org: w.organization.id,
          branch: w.branchId,
          id: appointment!.id,
          staff: staff || null,
          starts_at: start,
          services,
          key,
        });
      else
        await api("/api/workspace/booking", {
          ...common,
          staff: staff || null,
          starts_at: start,
          rebooked_from: mode === "rebooking" ? appointment!.id : null,
        });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "walkin"
          ? "Agregar cliente a la cola"
          : mode === "reschedule"
            ? "Reprogramar reserva"
            : mode === "rebooking"
              ? "Agendar próxima visita"
              : "Nueva reserva"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="stack">
        <ServicePicker
          services={eligibleServices}
          selected={services}
          onChange={(ids) => {
            setServices(ids);
            setStart("");
          }}
        />
        {catalog.loading && <Loading />}
        {!catalog.loading && !eligibleServices.length && (
          <Notice>Este local todavía no tiene servicios habilitados.</Notice>
        )}
        <div className="form-grid">
          <Field label="Barbero">
            <select
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
                setStart("");
              }}
              disabled={w.role === "barber"}
            >
              <option value="">Cualquiera disponible</option>
              {localStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {mode !== "walkin" && (
            <Field label="Fecha">
              <input
                type="date"
                value={dateValue}
                min={formatInTimeZone(new Date(), tz, "yyyy-MM-dd")}
                onChange={(e) => {
                  setDate(e.target.value);
                  setStart("");
                }}
                required
              />
            </Field>
          )}
        </div>
        {mode !== "walkin" && services.length > 0 && (
          <section className="stack-sm">
            <h3>Horarios disponibles</h3>
            <small>
              {tz} · La duración se calcula según los servicios elegidos.
            </small>
            {availability.loading && <Loading />}
            {availability.error && <Notice error>{availability.error}</Notice>}
            <div className="slot-grid">
              {times.map((time) => (
                <button
                  type="button"
                  className={start === time ? "selected" : ""}
                  onClick={() => setStart(time)}
                  key={time}
                >
                  {formatInTimeZone(time, tz, "HH:mm")}
                  <small>
                    {
                      availability.data?.filter((s) => s.starts_at === time)
                        .length
                    }{" "}
                    disponibles ·{" "}
                    {
                      availability.data?.find((s) => s.starts_at === time)
                        ?.duration_minutes
                    }{" "}
                    min
                  </small>
                </button>
              ))}
            </div>
            {!availability.loading && !times.length && (
              <p className="muted">
                No hay disponibilidad. Probá otra fecha o un barbero diferente.
              </p>
            )}
          </section>
        )}
        {customer ? (
          <div className="panel">
            <strong>{customer.name}</strong>
            {!appointment && (
              <button type="button" onClick={() => setCustomer(null)}>
                Cambiar cliente
              </button>
            )}
          </div>
        ) : (
          <section className="stack-sm">
            <div className="row between">
              <h3>Cliente</h3>
              <button type="button" onClick={() => setNewCustomer((v) => !v)}>
                {newCustomer ? "Buscar existente" : "Nuevo cliente"}
              </button>
            </div>
            {!newCustomer ? (
              <>
                <input
                  aria-label="Buscar cliente por nombre o teléfono"
                  placeholder="Nombre o teléfono completo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {customers.data?.items.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() =>
                      setCustomer({ id: c.id, name: String(c.name) })
                    }
                  >
                    {String(c.name)} · {String(c.normalized_phone)}
                  </button>
                ))}
                {query.length >= 2 &&
                  customers.data &&
                  !customers.data.items.length && (
                    <p className="muted">
                      No encontramos un cliente. Podés registrarlo como nuevo.
                    </p>
                  )}
              </>
            ) : (
              <div className="form-grid">
                <Field label="Nombre">
                  <input name="name" required maxLength={120} />
                </Field>
                <Field label="Teléfono con código de país">
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+código de país y número"
                    required
                    maxLength={30}
                  />
                </Field>
                <Field label="Email (opcional)">
                  <input name="email" type="email" maxLength={254} />
                </Field>
              </div>
            )}
          </section>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            aria-busy={!!busy}
            className="primary"
            disabled={busy || (!customer && !newCustomer)}
          >
            {busy
              ? "Guardando…"
              : mode === "walkin"
                ? "Agregar a la cola"
                : "Confirmar reserva"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
