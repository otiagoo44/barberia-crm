"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  LayoutDashboard,
  CalendarDays,
  UsersRound,
  UserRoundPlus,
  RotateCcw,
  Scissors,
  Users,
  Store,
  Target,
  Wallet,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Search,
  Bell,
  Menu,
  ChevronRight,
  ChevronsUpDown,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useWorkspace } from "@/features/organizations/context";
import { SignOut } from "@/features/auth/auth-form";
import { roleLabels } from "@/lib/validation";
import { resourceUrl, useResource } from "@/lib/client";
import { Modal, Empty, Loading, Notice } from "./ui";
import type { Page, DataRow } from "@/lib/types";
import { brandStyle } from "@/lib/branding";
const links: [string, string, LucideIcon, string][] = [
  ["inicio", "Inicio", LayoutDashboard, "Operación"],
  ["agenda", "Agenda", CalendarDays, "Operación"],
  ["walk-ins", "Sin cita", UserRoundPlus, "Operación"],
  ["caja", "Caja", Wallet, "Operación"],
  ["clientes", "Clientes", UsersRound, "Clientes"],
  ["retencion", "Seguimiento", RotateCcw, "Clientes"],
  ["equipo", "Equipo", Users, "Negocio"],
  ["servicios", "Servicios", Scissors, "Negocio"],
  ["sucursales", "Sucursales", Store, "Negocio"],
  ["finanzas", "Finanzas", Wallet, "Resultados"],
  ["reportes", "Reportes", ChartNoAxesCombined, "Resultados"],
  ["metas", "Metas", Target, "Resultados"],
  ["configuracion", "Configuración", SlidersHorizontal, "Configuración"],
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
        {Array.from(new Set(allowed.map((l) => l[3]))).map((group) => (
          <div className="nav-group" key={group}>
            <span className="nav-group-label">{group}</span>
            {allowed
              .filter((l) => l[3] === group)
              .map(([key, label, Icon]) => (
                <Link
                  onClick={() => setMenu(false)}
                  className={path.endsWith("/" + key) ? "active" : ""}
                  href={`/${w.organization.slug}/${key}`}
                  aria-current={path.endsWith("/" + key) ? "page" : undefined}
                  key={key}
                >
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  {label}
                </Link>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link href="/">
          <ChevronsUpDown size={16} aria-hidden="true" /> Cambiar organización
        </Link>
        <details className="user-menu">
          <summary>
            <span className="avatar" aria-hidden="true">
              {w.fullName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {w.fullName}
              <small>{roleLabels[w.role]}</small>
            </span>
          </summary>
          <Link href="/mfa">
            <ShieldCheck size={16} aria-hidden="true" /> Seguridad de la cuenta
          </Link>
          <SignOut />
        </details>
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
            aria-haspopup="dialog"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="workspace-context">
            <span>{w.organization.name}</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>
              {links.find(([key]) => path.endsWith("/" + key))?.[1] ??
                "Espacio de trabajo"}
            </strong>
          </div>
          <GlobalSearch links={allowed} />
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
            <Bell size={18} aria-hidden="true" />
          </button>
        </header>
        <main id="content" className="workspace" key={w.branchId}>
          {children}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Accesos rápidos">
        {allowed
          .filter(([key]) => ["inicio", "agenda", "caja"].includes(key))
          .map(([key, label, Icon]) => (
            <Link
              key={key}
              href={`/${w.organization.slug}/${key}`}
              aria-current={path.endsWith("/" + key) ? "page" : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        <button
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <Menu size={20} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
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
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <Notice error>
          {r.error} <button onClick={r.reload}>Reintentar</button>
        </Notice>
      ) : r.data?.items.length ? (
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
function GlobalSearch({ links: allowed }: { links: typeof links }) {
  const w = useWorkspace();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (document.querySelector("dialog:modal")) return;
        if (
          e.target instanceof HTMLElement &&
          e.target.matches(
            'input, textarea, select, [contenteditable="true"]',
          ) &&
          e.target !== input.current
        )
          return;
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") setText("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const r = useResource<{
    customers: DataRow[];
    staff: DataRow[];
    appointments: DataRow[];
  }>(
    query.length >= 2 && w.role !== "finance"
      ? resourceUrl("search", { org: w.organization.id, q: query })
      : null,
  );
  return (
    <div className="global-search">
      <label>
        <span className="sr-only">
          Buscar clientes, teléfono, barberos o citas
        </span>
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          placeholder={
            w.role === "finance"
              ? "Buscar pantallas…"
              : "Buscar cliente o pantalla…"
          }
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
          {allowed
            .filter(([, label]) =>
              label
                .toLocaleLowerCase("es")
                .includes(query.toLocaleLowerCase("es")),
            )
            .map(([key, label, Icon]) => (
              <Link
                key={key}
                onClick={() => setText("")}
                href={`/${w.organization.slug}/${key}`}
              >
                <span className="row">
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </span>
                <small>Ir a la pantalla</small>
              </Link>
            ))}
          {r.loading && <p role="status">Buscando…</p>}
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
              onClick={() => {
                if (
                  typeof a.branch_id === "string" &&
                  w.branches.some((b) => b.id === a.branch_id)
                )
                  w.setBranchId(a.branch_id);
                setText("");
              }}
              href={`/${w.organization.slug}/agenda?date=${formatInTimeZone(String(a.starts_at), w.branches.find((b) => b.id === String(a.branch_id))?.timezone ?? w.organization.timezone, "yyyy-MM-dd")}`}
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
