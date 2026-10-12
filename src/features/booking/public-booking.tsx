"use client";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useResource, api } from "@/lib/client";
import { normalizePhone } from "@/lib/validation";
import { Field, Notice, Empty, Loading } from "@/components/ui";
import { ServicePicker } from "@/features/services/service-picker";
import { brandStyle } from "@/lib/branding";
import { preselectedServices } from "@/lib/booking-links";
type PublicService = {
  slug: string;
  name: string;
  composition_mode: string;
  base_service_slug: string | null;
  price_minor: number | null;
  consultation_required?: boolean;
};
type PublicBranch = {
  slug: string;
  name: string;
  timezone: string;
  address: string;
  phone?: string|null;
  services: PublicService[];
  staff: { slug: string; name: string; services: string[] }[];
};
type Catalog = {
  name: string;
  slug: string;
  brand_color: string;
  currency: string;
  logo_url: string | null;
  branches: PublicBranch[];
};
type Slot = {
  starts_at: string;
  staff_slug: string;
  staff_name: string;
  duration_minutes: number;
};
export function PublicBooking({
  organization,
  branchSlug,
  requestedService,
}: {
  organization: string;
  branchSlug?: string;
  requestedService?: string;
}) {
  const catalog = useResource<Catalog>(
    `/api/public/catalog?organization=${encodeURIComponent(organization)}${branchSlug ? "&branch=" + encodeURIComponent(branchSlug) : ""}`,
  );
  const [branch, setBranch] = useState(branchSlug ?? "");
  const [selection, setServices] = useState<string[]|null>(null);
  const [staff, setStaff] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{
    reference: string;
    starts_at: string;
    ends_at: string;
    duration_minutes: number;
  } | null>(null);
  const b = catalog.data?.branches.find(
    (b) => b.slug === (branch || catalog.data?.branches[0]?.slug),
  );
  const services=selection??preselectedServices(requestedService,b?.services??[]);
  const today = formatInTimeZone(
    new Date(),
    b?.timezone ?? "Etc/UTC",
    "yyyy-MM-dd",
  );
  const day = date || today;
  const query = new URLSearchParams({
    organization,
    branch: b?.slug ?? "",
    date: day,
  });
  services.forEach((s) => query.append("service", s));
  if (staff) query.set("staff", staff);
  const availability = useResource<Slot[]>(
    b && services.length ? `/api/public/availability?${query}` : null,
  );
  const times = [...new Set(availability.data?.map((s) => s.starts_at) ?? [])];
  if (catalog.loading && !catalog.data) return <Loading />;
  if (catalog.error) return <Notice error>{catalog.error}</Notice>;
  if (!b)
    return (
      <Empty title="Las reservas online todavía no están disponibles">
        Contactá al local para coordinar tu visita.
      </Empty>
    );
  if (confirmed)
    return (
      <div className="panel public-confirmation stack">
        <span aria-hidden="true">✓</span>
        <h1>Tu reserva quedó registrada</h1>
        <p>
          {catalog.data?.name} · {b.name}
        </p>
        <p>
          {formatInTimeZone(
            confirmed.starts_at,
            b.timezone,
            "dd/MM/yyyy · HH:mm",
          )}{" "}
          · {confirmed.duration_minutes} min
        </p>
        <p className="muted">Referencia: {confirmed.reference}</p>
        <small>
          Guardá esta referencia. Para modificar tu turno, contactá al local.
        </small>
        <button onClick={() => window.location.reload()}>
          Volver a reservar
        </button>
      </div>
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!time || !availability.data?.some((s) => s.starts_at === time)) {
      setError("Elegí un horario disponible.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await api<{
        reference: string;
        starts_at: string;
        ends_at: string;
        duration_minutes: number;
      }>("/api/public/booking", {
        organization,
        branch: b!.slug,
        services,
        staff: staff || null,
        starts_at: time,
        customer: {
          name: form.get("name"),
          normalized_phone: normalizePhone(String(form.get("phone"))),
          email: String(form.get("email") ?? ""),
        },
        key,
        website: String(form.get("website") ?? ""),
      });
      setConfirmed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={brandStyle(catalog.data?.brand_color ?? "#6fe2ff")}>
      <header>
        {catalog.data?.logo_url && (
          <img
            src={catalog.data.logo_url}
            width="60"
            height="60"
            alt=""
            referrerPolicy="no-referrer"
            style={{ objectFit: "contain", marginBottom: 12 }}
          />
        )}
        <span className="eyebrow">RESERVÁ TU PRÓXIMA VISITA</span>
        <h1>{catalog.data?.name}</h1>
        <p className="muted">
          Elegí el servicio y encontrá el horario que te queda mejor.
        </p>
      </header>
      <form onSubmit={submit} className="panel stack">
        <div className="booking-steps">
          <span className={services.length ? "" : "current"}>1 · Servicio</span>
          <span className={services.length && !time ? "current" : ""}>
            2 · Horario
          </span>
          <span className={time ? "current" : ""}>3 · Confirmación</span>
        </div>
        {catalog.data!.branches.length > 1 && (
          <Field label="Sucursal">
            <select
              value={b.slug}
              onChange={(e) => {
                setBranch(e.target.value);
                setServices([]);
                setStaff("");
                setTime("");
              }}
            >
              {catalog.data!.branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <p className="muted">
          {b.name}
          {b.address ? " · " + b.address : ""}
        </p>
        <ServicePicker
          services={b.services.filter(s=>!s.consultation_required).map((s) => ({
            id: s.slug,
            name: s.name,
            composition_mode: s.composition_mode,
            base_service_id: s.base_service_slug,
          }))}
          selected={services}
          onChange={(ids) => {
            setServices(ids);
            setTime("");
          }}
        />
        {b.services.some(s=>s.consultation_required)&&<Notice>Requieren consulta previa: {b.services.filter(s=>s.consultation_required).map(s=>s.name).join(', ')}. {b.phone&&<a href={'tel:'+b.phone.replace(/[^+0-9]/g,'')}>Contactar a la barbería</a>}</Notice>}
        <div className="form-grid">
          <Field label="Barbero">
            <select
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
                setTime("");
              }}
            >
              <option value="">Cualquiera disponible</option>
              {b.staff
                .filter((s) =>
                  services.every((service) => s.services.includes(service)),
                )
                .map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              min={today}
              value={day}
              required
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
              }}
            />
          </Field>
        </div>
        {services.length > 0 && (
          <>
            <h3>Horarios disponibles</h3>
            <small>Horarios del local · {b.timezone}</small>
            {availability.loading && <Loading />}
            {availability.error && <Notice error>{availability.error}</Notice>}
            <div className="slot-grid">
              {times.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={time === t ? "selected" : ""}
                  onClick={() => setTime(t)}
                >
                  {formatInTimeZone(t, b.timezone, "HH:mm")}
                  <small>
                    {
                      availability.data?.find((s) => s.starts_at === t)
                        ?.duration_minutes
                    }{" "}
                    min
                  </small>
                </button>
              ))}
            </div>
            {!availability.loading && !times.length && (
              <p className="muted">
                No encontramos horarios para esa selección. Probá otra fecha.
              </p>
            )}
          </>
        )}
        <div className="form-grid">
          <Field label="Nombre">
            <input name="name" autoComplete="name" required maxLength={120} />
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
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          </Field>
        </div>
        <div className="honeypot" aria-hidden="true">
          <label>
            Sitio web
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <small>
          Usaremos tus datos para gestionar esta visita. No incluimos
          información sensible en esta reserva.
        </small>
        {error && <Notice error>{error}</Notice>}
        <button className="primary" disabled={busy || !time}>
          {busy ? "Confirmando…" : "Confirmar mi reserva"}
        </button>
      </form>
    </div>
  );
}
