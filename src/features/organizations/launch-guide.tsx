"use client";
import Link from "next/link";
import { useWorkspace } from "./context";
import { resourceUrl, useResource } from "@/lib/client";
import { Notice } from "@/components/ui";
import type { DataRow, Page } from "@/lib/types";

export function LaunchGuide() {
  const w = useWorkspace();
  const settings = useResource<Page<DataRow>>(
    resourceUrl("organization_settings", { org: w.organization.id }),
  );
  const branch = useResource<Page<DataRow>>(
    w.branchId
      ? resourceUrl("branch_settings", {
          org: w.organization.id,
          branch: w.branchId,
        })
      : null,
  );
  const enabled =
    settings.data?.items[0]?.booking_enabled &&
    branch.data?.items[0]?.booking_enabled;
  return (
    <details className="launch-guide">
      <summary>
        <span>
          <strong>Configuración operativa</strong>
          <small>Equipo, reservas y caja en un solo lugar</small>
        </span>
        <span className="badge">
          {settings.loading || branch.loading
            ? "Consultando…"
            : enabled
              ? "Reservas habilitadas"
              : "Revisar configuración"}
        </span>
      </summary>
      <div className="launch-guide-body">
        {(settings.error || branch.error) && (
          <Notice error>
            No pudimos consultar el estado de las reservas. Recargá la página.
          </Notice>
        )}
        <ol className="launch-checklist">
          <li>
            <Link href={`/${w.organization.slug}/equipo`}>
              <strong>1. Equipo y disponibilidad</strong>
              <span>
                Asigná servicios a cada barbero y cargá sus horarios y
                descansos.
              </span>
            </Link>
          </li>
          <li>
            <Link href={`/${w.organization.slug}/servicios`}>
              <strong>2. Servicios y precios</strong>
              <span>
                Revisá duración, precio y servicios que necesitan una consulta
                previa.
              </span>
            </Link>
          </li>
          <li>
            <Link href={`/${w.organization.slug}/finanzas`}>
              <strong>3. Ganancias y medios de pago</strong>
              <span>
                Elegí reparto de ganancias o comisiones por servicio y revisá
                las tarifas de tarjetas antes de cobrar.
              </span>
            </Link>
          </li>
          <li>
            <Link href={`/${w.organization.slug}/sucursales`}>
              <strong>4. Reservas por internet</strong>
              <span>
                Revisá horarios del local. Habilitá reservas en la sucursal y en
                Configuración.
              </span>
            </Link>
          </li>
        </ol>
        <div className="launch-actions">
          <Link className="primary" href={`/${w.organization.slug}/caja`}>
            Abrir caja
          </Link>
          <Link href={`/${w.organization.slug}/configuracion`}>
            Dar acceso al equipo →
          </Link>
          {enabled && (
            <Link
              href={`/book/${w.organization.slug}/${w.branches.find((b) => b.id === w.branchId)?.slug ?? ""}`}
            >
              Ver página de reservas →
            </Link>
          )}
        </div>
        <p className="muted">
          Una cita completada se cobra desde la agenda. Al terminar el día,
          contá el efectivo y cerrá la caja. Las comisiones sin una regla
          confirmada aparecen pendientes de cálculo.
        </p>
      </div>
    </details>
  );
}
