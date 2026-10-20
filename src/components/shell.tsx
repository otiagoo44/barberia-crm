"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useWorkspace } from "@/features/organizations/context";
import { SignOut } from "@/features/auth/auth-form";
import { roleLabels } from "@/lib/validation";
import { resourceUrl, useResource } from "@/lib/client";
import { Modal, Empty } from "./ui";
import type { Page, DataRow } from "@/lib/types";
import { brandStyle } from "@/lib/branding";
const links = [
  ["inicio", "Inicio", "◈"],
  ["agenda", "Agenda", "▦"],
  ["clientes", "Clientes", "◎"],
  ["walk-ins", "Walk-ins", "⇥"],
  ["retencion", "Retención", "↻"],
  ["equipo", "Equipo", "♧"],
  ["servicios", "Servicios", "✂"],
  ["sucursales", "Sucursales", "⌂"],
  ["metas", "Metas", "⚑"],
  ["caja", "Caja", "$"],
  ["finanzas", "Finanzas", "%"],
  ["reportes", "Reportes", "▥"],
  ["configuracion", "Configuración", "⚙"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const w = useWorkspace();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [activity, setActivity] = useState(false);
  const allowed = links.filter(([key]) =>
    w.role === "barber"
      ? ["inicio", "agenda", "clientes", "equipo", "reportes"].includes(key)
      : w.role === "finance"
        ? ["inicio", "caja", "finanzas", "reportes"].includes(key)
        : w.role === "receptionist"
          ? [
              "inicio",
              "agenda",
              "clientes",
              "walk-ins",
              "retencion",
              "caja",
            ].includes(key)
          : w.role === "manager"
            ? key !== "configuracion"
            : true,
  );
  const nav = (
    <>
      <Link className="brand" href={`/${w.organization.slug}/inicio`}>
        <span className="brand-mark">
          {w.organization.logo_url ? (
            <img
              src={w.organization.logo_url}
              alt=""
              width="38"
              height="38"
              referrerPolicy="no-referrer"
              style={{ objectFit: "contain" }}
            />
          ) : (
            "B"
          )}
        </span>
        <span>
          {w.organization.name}
          <small>BARBERÍA OS</small>
        </span>
      </Link>
      <nav aria-label="Navegación principal">
        {allowed.map(([key, label, icon]) => (
          <Link
            onClick={() => setMenu(false)}
            className={path.endsWith("/" + key) ? "active" : ""}
            href={`/${w.organization.slug}/${key}`}
            key={key}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link href="/">Cambiar organización</Link>
        <span>{w.fullName}</span>
        <small>{roleLabels[w.role]}</small>
        <SignOut />
      </div>
    </>
  );
  return (
    <div className="app-shell" style={brandStyle(w.organization.brand_color)}>
      <aside className="sidebar">{nav}</aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Abrir navegación"
            onClick={() => setMenu(true)}
          >
            ☰
          </button>
          <GlobalSearch />
          {w.branches.length > 1 ? (
            <label className="branch-switch">
              <span className="sr-only">Sucursal activa</span>
              <select
                value={w.branchId}
                title="Cambiar de sucursal cierra los formularios sin guardar"
                onChange={(e) => w.setBranchId(e.target.value)}
              >
                {w.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="branch-name">
              {w.branches[0]?.name ?? "Sin sucursal"}
            </span>
          )}
          <button
            className="icon-button"
            aria-label="Ver actividad"
            onClick={() => setActivity(true)}
          >
            ◉
          </button>
        </header>
        <main id="content" className="workspace" key={w.branchId}>
          {children}
        </main>
      </div>
      {menu && (
        <Modal title="Navegación" onClose={() => setMenu(false)}>
          <div className="mobile-nav">{nav}</div>
        </Modal>
      )}
      {activity && (
        <Modal title="Actividad" onClose={() => setActivity(false)}>
          <Activity />
        </Modal>
      )}
    </div>
  );
}
function Activity() {
  const w = useWorkspace();
  const r = useResource<Page<DataRow>>(
    resourceUrl("notifications", { org: w.organization.id }),
  );
  return (
    <div className="stack">
      {r.data?.items.length ? (
        r.data.items.map((n) => (
          <article className="list-item" key={n.id}>
            <strong>{String(n.title)}</strong>
            <p>{String(n.body ?? "")}</p>
            <small>{new Date(String(n.created_at)).toLocaleString("es")}</small>
          </article>
        ))
      ) : (
        <Empty title="Sin notificaciones" />
      )}
    </div>
  );
}
function GlobalSearch() {
  const w = useWorkspace();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const r = useResource<{
    customers: DataRow[];
    staff: DataRow[];
    appointments: DataRow[];
  }>(
    query.length >= 2
      ? resourceUrl("search", { org: w.organization.id, q: query })
      : null,
  );
  return (
    <div className="global-search">
      <label>
        <span className="sr-only">
          Buscar clientes, teléfono, barberos o citas
        </span>
        <span aria-hidden="true">⌕</span>
        <input
          placeholder="Buscar clientes, teléfono…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={80}
        />
      </label>
      {query.length >= 2 && text && (
        <div className="search-results">
          <button className="close-search" onClick={() => setText("")}>
            Cerrar
          </button>
          {r.data?.customers.map((c) => (
            <Link
              key={c.id}
              onClick={() => setText("")}
              href={`/${w.organization.slug}/clientes?customer=${c.id}`}
            >
              {String(c.name)}
              <small>{String(c.normalized_phone)}</small>
            </Link>
          ))}
          {r.data?.staff.map((s) => (
            <Link
              key={s.id}
              onClick={() => setText("")}
              href={`/${w.organization.slug}/agenda?staff=${s.id}`}
            >
              {String(s.name)}
              <small>Equipo</small>
            </Link>
          ))}
          {r.data?.appointments.map((a) => (
            <Link
              key={a.id}
              onClick={() => setText("")}
              href={`/${w.organization.slug}/agenda?date=${String(a.starts_at).slice(0, 10)}`}
            >
              {String(a.name)}
              <small>
                {new Date(String(a.starts_at)).toLocaleString("es")}
              </small>
            </Link>
          ))}
          {r.error && <p>{r.error}</p>}
          {r.data &&
            !r.data.customers.length &&
            !r.data.staff.length &&
            !r.data.appointments.length && <p>Sin resultados</p>}
        </div>
      )}
    </div>
  );
}
