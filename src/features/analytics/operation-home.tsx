"use client";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { useWorkspace } from "@/features/organizations/context";
import { resourceUrl, useResource } from "@/lib/client";
import { financeUrl, money, type FinanceRow } from "@/features/finance/client";
import { DayOverview } from "./day-overview";
import { Loading, Notice } from "@/components/ui";
import { MetricCard } from "@/components/workspace-ui";
import type { DataRow } from "@/lib/types";

/** Reception reads operational projections only, never finance summary/staff pay. */
export function ReceptionHome() {
  const w = useWorkspace();
  const tz =
    w.branches.find((b) => b.id === w.branchId)?.timezone ??
    w.organization.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const day = useResource<{ queue: DataRow[] }>(
    w.branchId
      ? resourceUrl("day", { org: w.organization.id, branch: w.branchId })
      : null,
  );
  const cash = useResource<{
    session: FinanceRow | null;
    pending: FinanceRow[];
  }>(
    w.branchId
      ? financeUrl("cash", w.organization.id, w.branchId, today)
      : null,
  );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERACIÓN · RECEPCIÓN</span>
          <h1>Tu jornada en recepción</h1>
          <p>Próximas atenciones, espera y cobros de tu sucursal.</p>
        </div>
        <Link className="primary" href={`/${w.organization.slug}/agenda`}>
          Ver agenda
        </Link>
      </div>
      <DayOverview />
      {(day.error || cash.error) && (
        <Notice error>{day.error || cash.error}</Notice>
      )}
      {(day.loading || cash.loading) && <Loading />}
      <div className="kpi-grid">
        <MetricCard
          label="Clientes esperando"
          value={
            day.data
              ? day.data.queue.filter((q) => q.status === "waiting").length
              : "Sin datos"
          }
        />
        <MetricCard
          label="Pendientes de cobrar"
          value={cash.data ? cash.data.pending.length : "Sin datos"}
        />
        <MetricCard
          label="Estado de caja"
          value={
            cash.data
              ? cash.data.session?.status === "open"
                ? "Abierta"
                : "Cerrada"
              : "Sin datos"
          }
        />
        <MetricCard
          label="Efectivo esperado"
          value={
            cash.data?.session
              ? money(
                  cash.data.session.expected_cash_minor,
                  w.organization.currency,
                )
              : "Sin apertura"
          }
        />
      </div>
      <div className="role-actions">
        {[
          ["walk-ins", "Recibir sin cita", "Asignar un barbero disponible"],
          ["caja", "Ir a cobros", "Servicios completados y movimientos"],
          ["retencion", "Seguimiento", "Ayudar a planificar la próxima visita"],
        ].map(([path, title, detail]) => (
          <Link key={path} href={`/${w.organization.slug}/${path}`}>
            <strong>{title}</strong>
            <small>{detail}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
