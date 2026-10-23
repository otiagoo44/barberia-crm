"use client";
import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { api, useResource, resourceUrl } from "@/lib/client";
import {
  normalizePhone,
  retentionLabels,
  statusLabels,
} from "@/lib/validation";
import { Modal, Field, Notice, Empty, Loading, Badge } from "@/components/ui";
import { BookingForm } from "@/features/appointments/booking-form";
import { SavedViews } from "@/components/saved-views";
import type { DataRow, Page, Staff } from "@/lib/types";
import {
  RecordDrawer,
  Tabs,
  ActivityTimeline,
  DataTable,
  FilterBar,
  Toast,
} from "@/components/workspace-ui";
export function Customers({ retention = false }: { retention?: boolean }) {
  const w = useWorkspace();
  const searchParams = useSearchParams();
  const requestedCustomer = searchParams.get("customer");
  const [destination, setDestination] = useState(requestedCustomer);
  const [selected, setSelected] = useState<string | null>(requestedCustomer);
  // A new URL selects a new record. Closing the same URL stays closed.
  if (destination !== requestedCustomer) {
    setDestination(requestedCustomer);
    setSelected(requestedCustomer);
  }
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState(retention ? "due_soon" : "all");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [postpone, setPostpone] = useState<DataRow | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const r = useResource<Page<DataRow>>(
    resourceUrl(tab === "maintenance" ? "maintenance" : "customers", {
      org: w.organization.id,
      branch: retention ? w.branchId : null,
      q: query,
      retention: tab === "maintenance" ? null : tab,
      cursor,
    }),
  );
  async function noContact(row: DataRow) {
    try {
      await api("/api/workspace/record", {
        org: w.organization.id,
        branch: w.branchId || null,
        entity: "customers",
        id: String(row.customer_id ?? row.id),
        data: { do_not_contact: true },
      });
      r.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {retention ? "CLIENTES QUE VUELVEN" : "RELACIONES QUE CRECEN"}
          </span>
          <h1>{retention ? "Retención" : "Clientes"}</h1>
          <p>
            {retention
              ? "Detectá quién está por volver y ayudalo a encontrar su próximo turno."
              : "Un historial compartido entre todos los locales de tu barbería."}
          </p>
        </div>
        {!retention && w.role !== "barber" && (
          <button className="primary" onClick={() => setEditing(true)}>
            + Nuevo cliente
          </button>
        )}
      </div>
      {retention && (
        <div
          className="config-tabs"
          role="group"
          aria-label="Seguimiento de clientes"
        >
          {[
            ["due_soon", "Por volver pronto"],
            ["due", "Le toca volver"],
            ["overdue", "Atrasados"],
            ["lapsed", "Sin regresar"],
            ["maintenance", "Servicios especiales"],
          ].map(([value, label]) => (
            <button
              aria-pressed={tab === value}
              key={value}
              className={tab === value ? "selected" : ""}
              onClick={() => {
                setTab(value);
                setCursor(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!retention && w.role !== "barber" && (
        <div
          className="config-tabs"
          role="group"
          aria-label="Estado de clientes"
        >
          <button
            aria-pressed={tab === "all"}
            className={tab === "all" ? "selected" : ""}
            onClick={() => {
              setTab("all");
              setCursor(null);
            }}
          >
            Activos
          </button>
          <button
            aria-pressed={tab === "archived"}
            className={tab === "archived" ? "selected" : ""}
            onClick={() => {
              setTab("archived");
              setCursor(null);
            }}
          >
            Archivados
          </button>
        </div>
      )}
      <FilterBar label="Buscar y exportar clientes">
        <input
          aria-label="Buscar clientes"
          placeholder="Nombre o teléfono…"
          value={text}
          maxLength={80}
          onChange={(e) => {
            setText(e.target.value);
            setCursor(null);
          }}
        />
        <button onClick={r.reload}>Actualizar</button>
        {["organization_owner", "manager"].includes(w.role) && !retention && (
          <a
            className="primary"
            href={`/api/export/customers?org=${w.organization.id}${w.branchId ? "&branch=" + w.branchId : ""}`}
          >
            Exportar CSV
          </a>
        )}
      </FilterBar>
      {w.role !== "barber" && (
        <SavedViews
          value={tab}
          onChange={(value) => {
            setTab(value);
            setCursor(null);
          }}
          options={[
            ["all", "Activos"],
            ["archived", "Archivados"],
            ["due_soon", "Por volver pronto"],
            ["due", "Le toca volver"],
            ["overdue", "Atrasados"],
            ["lapsed", "Sin regresar"],
          ]}
        />
      )}
      {(r.error || error) && <Notice error>{r.error || error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {r.data?.items.length ? (
        <DataTable label="Clientes y regreso estimado">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Última visita</th>
              <th>Último servicio / barbero</th>
              <th>Regreso estimado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {r.data.items.map((c) => (
              <tr key={c.id}>
                <td>
                  <button
                    onClick={() => setSelected(String(c.customer_id ?? c.id))}
                  >
                    {String(c.name)}
                  </button>
                  {!!c.service_name && <small>{String(c.service_name)}</small>}
                </td>
                <td>{String(c.normalized_phone)}</td>
                <td>
                  {c.last_visit_at
                    ? new Date(String(c.last_visit_at)).toLocaleDateString(
                        "es-PY",
                        { timeZone: w.organization.timezone },
                      )
                    : "Sin visitas completadas"}
                </td>
                <td>
                  {String(c.last_service_name ?? "Sin historial")}
                  <small className="block">
                    {String(c.last_staff_name ?? "")}
                  </small>
                </td>
                <td>
                  {c.expected_return_at
                    ? new Date(String(c.expected_return_at)).toLocaleDateString(
                        "es",
                      )
                    : "Sin frecuencia configurada"}
                </td>
                <td>
                  <Badge
                    status={String(c.retention_status)}
                    label={
                      retentionLabels[String(c.retention_status)] ?? "Activo"
                    }
                  />
                </td>
                <td>
                  <div className="row">
                    <a
                      href={`https://wa.me/${String(c.normalized_phone).replace("+", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp ↗
                    </a>
                    {w.role !== "barber" && (
                      <button
                        onClick={() =>
                          setBooking({
                            id: String(c.customer_id ?? c.id),
                            name: String(c.name),
                          })
                        }
                      >
                        Agendar
                      </button>
                    )}
                    {retention && (
                      <>
                        <button
                          onClick={() =>
                            setPostpone({
                              ...c,
                              id: String(c.customer_id ?? c.id),
                            })
                          }
                        >
                          Posponer
                        </button>
                        <button onClick={() => noContact(c)}>
                          No contactar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        r.data && (
          <Empty
            title={
              retention
                ? "No hay clientes en esta lista"
                : "Todavía no hay clientes"
            }
          >
            {retention
              ? "La fecha de retorno se calcula al completar un servicio con frecuencia configurada."
              : "Registrá un cliente real o crealo al reservar su primera visita."}
          </Empty>
        )
      )}
      <div className="pagination">
        {cursor && (
          <button onClick={() => setCursor(null)}>Volver al inicio</button>
        )}
        {r.data?.has_more && (
          <button
            onClick={() => setCursor(JSON.stringify(r.data?.next_cursor))}
          >
            Siguientes 50
          </button>
        )}
      </div>
      {selected && (
        <CustomerDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={r.reload}
        />
      )}{" "}
      {editing && (
        <CustomerForm
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setMessage("Cliente guardado.");
            r.reload();
          }}
        />
      )}
      {booking && (
        <BookingForm
          customer={booking}
          onClose={() => setBooking(null)}
          onSaved={() => {
            setBooking(null);
            r.reload();
          }}
        />
      )}
      {postpone && (
        <Postpone
          customer={postpone}
          onClose={() => setPostpone(null)}
          onSaved={() => {
            setPostpone(null);
            r.reload();
          }}
        />
      )}
      {message && <Toast onClose={() => setMessage("")}>{message}</Toast>}
    </section>
  );
}
function CustomerDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const w = useWorkspace();
  const r = useResource<{
    customer: DataRow;
    stats: Record<string, number | string | null>;
    tags: string[];
    preferences: { id: string; key: string; value: string }[];
    upcoming: DataRow[];
  }>(resourceUrl("customer", { org: w.organization.id, id }));
  const [cursor, setCursor] = useState<{ date: string; id: string } | null>(
    null,
  );
  const timeline = useResource<Page<DataRow>>(
    resourceUrl("timeline", {
      org: w.organization.id,
      id,
      before: cursor?.date,
      before_id: cursor?.id,
    }),
  );
  const [old, setOld] = useState<DataRow[]>([]);
  const [section, setSection] = useState("summary");
  const [rebooking, setRebooking] = useState(false);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/record", {
        org: w.organization.id,
        branch: w.branchId || null,
        entity: "customer_notes",
        id: null,
        data: { customer_id: id, body: new FormData(form).get("body") },
      });
      form.reset();
      timeline.reload();
      setSection("activity");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function addAttribute(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const preference = values.get("kind") === "preference";
      await api("/api/workspace/record", {
        org: w.organization.id,
        branch: w.branchId || null,
        entity: preference ? "customer_preferences" : "customer_tags",
        id: preference
          ? (r.data?.preferences.find((p) => p.key === values.get("key"))?.id ??
            null)
          : null,
        data: preference
          ? {
              customer_id: id,
              key: values.get("key"),
              value: values.get("value"),
            }
          : { customer_id: id, tag: values.get("key") },
      });
      form.reset();
      r.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  if (edit && r.data)
    return (
      <CustomerForm
        customer={r.data.customer}
        onClose={() => setEdit(false)}
        onSaved={() => {
          setEdit(false);
          r.reload();
          onChanged();
        }}
      />
    );
  return (
    <RecordDrawer
      title={String(r.data?.customer.name ?? "Cliente")}
      onClose={onClose}
    >
      {r.error && <Notice error>{r.error}</Notice>}
      {r.loading && !r.data && <Loading />}
      {r.data && (
        <div className="stack">
          <div className="record-context">
            <span>Clientes / Ficha del cliente</span>
            <Badge
              status={String(
                r.data.customer.archived_at ? "cancelled" : "active",
              )}
              label={r.data.customer.archived_at ? "Archivado" : "Activo"}
            />
          </div>
          <div className="row between wrap">
            <div>
              <p>{String(r.data.customer.normalized_phone)}</p>
              <p className="muted">{String(r.data.customer.email ?? "")}</p>
            </div>
            {w.role !== "barber" && (
              <button onClick={() => setEdit(true)}>Editar cliente</button>
            )}
          </div>
          {!r.data.customer.archived_at && (
            <div className="row wrap">
              <button className="primary" onClick={() => setRebooking(true)}>
                Agendar próximo turno
              </button>
              {!r.data.customer.do_not_contact && (
                <a
                  className="contact-action"
                  href={`https://wa.me/${String(r.data.customer.normalized_phone).replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          )}
          <Tabs
            value={section}
            onChange={setSection}
            options={[
              ["summary", "Resumen"],
              ["activity", "Actividad"],
              ["notes", "Notas y preferencias"],
            ]}
          >
            {section === "summary" && (
              <div className="stack">
                <div className="detail-grid">
                  <div className="panel">
                    <strong>{r.data.stats.visits ?? 0}</strong>
                    <p className="muted">visitas completadas</p>
                  </div>
                  <div className="panel">
                    <strong>{r.data.stats.no_shows ?? 0}</strong>
                    <p className="muted">
                      no-shows · {r.data.stats.cancellations ?? 0} cancelaciones
                    </p>
                  </div>
                </div>
                <p>
                  <strong>Próximo regreso:</strong>{" "}
                  {r.data.customer.expected_return_at
                    ? new Date(
                        String(r.data.customer.expected_return_at),
                      ).toLocaleDateString("es")
                    : "Sin frecuencia configurada"}
                </p>
                <p>
                  <strong>Última visita:</strong>{" "}
                  {r.data.stats.last_visit_at
                    ? new Date(
                        String(r.data.stats.last_visit_at),
                      ).toLocaleDateString("es")
                    : "Sin visitas completadas"}
                </p>
                {r.data.stats.habitual_service && (
                  <p>
                    <strong>Servicio habitual:</strong>{" "}
                    {r.data.stats.habitual_service}
                  </p>
                )}
                {r.data.customer.do_not_contact && (
                  <Notice>Este cliente pidió no ser contactado.</Notice>
                )}
                {r.data.tags.length > 0 && (
                  <div className="row wrap">
                    {r.data.tags.map((t) => (
                      <span className="badge" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {r.data.preferences.map((p) => (
                  <p key={p.key}>
                    <strong>{p.key}:</strong> {p.value}
                  </p>
                ))}
                <h3>Próximas reservas</h3>
                {r.data.upcoming?.length ? (
                  r.data.upcoming.map((a) => (
                    <article className="upcoming-visit" key={a.id}>
                      <div>
                        <strong>
                          {new Date(String(a.starts_at)).toLocaleString(
                            "es-PY",
                            {
                              timeZone:
                                w.branches.find((b) => b.id === a.branch_id)
                                  ?.timezone ?? w.organization.timezone,
                              dateStyle: "medium",
                              timeStyle: "short",
                            },
                          )}
                        </strong>
                        <small>
                          {String(a.duration_minutes)} min ·{" "}
                          {statusLabels[String(a.status)]}
                        </small>
                      </div>
                      <Link
                        onClick={() => w.setBranchId(String(a.branch_id))}
                        href={`/${w.organization.slug}/agenda?date=${formatInTimeZone(String(a.starts_at), w.branches.find((b) => b.id === a.branch_id)?.timezone ?? w.organization.timezone, "yyyy-MM-dd")}&staff=${a.staff_id}`}
                      >
                        Ver en agenda
                      </Link>
                    </article>
                  ))
                ) : (
                  <Empty title="Sin próximas reservas">
                    Ofrecé una nueva visita según su frecuencia real.
                  </Empty>
                )}
              </div>
            )}
            {section === "activity" && (
              <div className="stack">
                <h3>Historial</h3>
                {timeline.error && <Notice error>{timeline.error}</Notice>}
                {timeline.loading && <Loading />}
                <ActivityTimeline>
                  {[...old, ...(timeline.data?.items ?? [])].map((t) => {
                    const d = t.data as Record<
                      string,
                      string | Record<string, string>
                    >;
                    const type = String(t.type);
                    return (
                      <article className="timeline-item" key={t.id}>
                        <small>
                          {new Date(String(t.created_at)).toLocaleString("es")}
                        </small>
                        <p>
                          {type === "note"
                            ? String(d.body)
                            : type.startsWith("appointment.")
                              ? (statusLabels[
                                  type.replace("appointment.", "")
                                ] ?? type)
                              : type === "customer.created"
                                ? "Cliente registrado"
                                : "Actividad del cliente"}
                        </p>
                        {d.starts_at && (
                          <small>
                            Turno:{" "}
                            {new Date(String(d.starts_at)).toLocaleString("es")}
                          </small>
                        )}
                      </article>
                    );
                  })}
                </ActivityTimeline>
                {timeline.data?.has_more && (
                  <button
                    onClick={() => {
                      const items = timeline.data!.items;
                      const last = items.at(-1)!;
                      setOld((v) => [...v, ...items]);
                      setCursor({ date: String(last.created_at), id: last.id });
                    }}
                  >
                    Ver historial anterior
                  </button>
                )}
              </div>
            )}
            {section === "notes" && (
              <div className="stack">
                {w.role !== "barber" && (
                  <form onSubmit={addNote} className="stack-sm">
                    <Field label="Agregar nota">
                      <textarea
                        name="body"
                        maxLength={2000}
                        required
                        placeholder="Preferencias o información útil para la próxima visita…"
                      />
                    </Field>
                    {error && <Notice error>{error}</Notice>}
                    <button aria-busy={!!busy} disabled={busy}>
                      Guardar nota
                    </button>
                  </form>
                )}
                {w.role !== "barber" && (
                  <form onSubmit={addAttribute} className="stack-sm">
                    <h3>Etiquetas y preferencias</h3>
                    <Field label="Tipo">
                      <select name="kind">
                        <option value="tag">Etiqueta</option>
                        <option value="preference">Preferencia</option>
                      </select>
                    </Field>
                    <Field label="Etiqueta o nombre de preferencia">
                      <input name="key" required maxLength={60} />
                    </Field>
                    <Field label="Detalle de preferencia (opcional para etiqueta)">
                      <input name="value" maxLength={300} />
                    </Field>
                    <button aria-busy={!!busy} disabled={busy}>
                      Agregar información
                    </button>
                  </form>
                )}
              </div>
            )}
          </Tabs>
        </div>
      )}
      {rebooking && r.data && (
        <BookingForm
          customer={{ id, name: String(r.data.customer.name) }}
          onClose={() => setRebooking(false)}
          onSaved={() => {
            setRebooking(false);
            r.reload();
            timeline.reload();
            onChanged();
          }}
        />
      )}
    </RecordDrawer>
  );
}
function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: DataRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const staff = useResource<Page<Staff>>(
    resourceUrl("staff", { org: w.organization.id }),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/workspace/record", {
        org: w.organization.id,
        branch: w.branchId || null,
        entity: "customers",
        id: customer?.id ?? null,
        data: {
          name: form.get("name"),
          normalized_phone: normalizePhone(String(form.get("phone"))),
          email: form.get("email") || null,
          birthday: form.get("birthday") || null,
          home_branch_id: form.get("home_branch") || null,
          preferred_staff_id: form.get("staff") || null,
          return_interval_days: form.get("frequency")
            ? Number(form.get("frequency"))
            : null,
          do_not_contact: form.has("do_not_contact"),
          archived_at: form.has("archived")
            ? (customer?.archived_at ?? new Date().toISOString())
            : null,
        },
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
      title={customer ? "Editar cliente" : "Nuevo cliente"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <Field label="Nombre">
            <input
              name="name"
              defaultValue={String(customer?.name ?? "")}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Teléfono con código de país">
            <input
              name="phone"
              type="tel"
              defaultValue={String(customer?.normalized_phone ?? "")}
              required
              maxLength={30}
            />
          </Field>
          <Field label="Email (opcional)">
            <input
              name="email"
              type="email"
              defaultValue={String(customer?.email ?? "")}
              maxLength={254}
            />
          </Field>
          <Field label="Nacimiento (opcional)">
            <input
              name="birthday"
              type="date"
              defaultValue={String(customer?.birthday ?? "")}
            />
          </Field>
          <Field label="Sucursal habitual">
            <select
              name="home_branch"
              defaultValue={String(customer?.home_branch_id ?? w.branchId)}
            >
              {w.role === "organization_owner" && (
                <option value="">Sin preferencia</option>
              )}
              {w.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Barbero preferido">
            <select
              name="staff"
              defaultValue={String(customer?.preferred_staff_id ?? "")}
            >
              <option value="">Sin preferencia</option>
              {staff.data?.items.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Frecuencia de regreso (días, opcional)">
            <input
              name="frequency"
              type="number"
              min={1}
              max={730}
              defaultValue={String(customer?.return_interval_days ?? "")}
            />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            name="do_not_contact"
            defaultChecked={!!customer?.do_not_contact}
          />
          No contactar
        </label>
        {customer && (
          <label className="check-label">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={!!customer.archived_at}
            />
            Archivar cliente
          </label>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button aria-busy={!!busy} className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Postpone({
  customer,
  onClose,
  onSaved,
}: {
  customer: DataRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const w = useWorkspace();
  const [error, setError] = useState("");
  return (
    <Modal title="Posponer contacto" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get("date"));
          try {
            await api("/api/workspace/record", {
              org: w.organization.id,
              branch: w.branchId,
              entity: "customers",
              id: customer.id,
              data: {
                followup_after: new Date(value + "T12:00:00Z").toISOString(),
              },
            });
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
          }
        }}
      >
        <p>{String(customer.name)}</p>
        <Field label="Volver a mostrar a partir de">
          <input
            type="date"
            name="date"
            min={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
        {error && <Notice error>{error}</Notice>}
        <button className="primary">Guardar</button>
      </form>
    </Modal>
  );
}
