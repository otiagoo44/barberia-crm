"use client";
import { useState } from "react";
import { DataChart } from "@/components/chart";
import { ViewSwitcher } from "@/components/workspace-ui";
import { chartInteger } from "@/lib/chart-values";
import type { FinanceRow } from "./client";

// The parent only supplies the existing finance.report-authorized projection.
// Aggregation stays exact until values reach the approximate chart boundary.
export function StaffFinancialCharts({
  rows,
  currency,
}: {
  rows: FinanceRow[];
  currency: string;
}) {
  const [view, setView] = useState("production");
  const staff = new Map<
    string,
    {
      name: string;
      production: bigint;
      checkouts: bigint;
      commission: bigint;
      unknown: boolean;
    }
  >();
  for (const row of rows) {
    const id = String(row.staff_id);
    const item = staff.get(id) ?? {
      name: String(row.name ?? "Profesional"),
      production: 0n,
      checkouts: 0n,
      commission: 0n,
      unknown: false,
    };
    item.production += BigInt(String(row.gross_production_minor));
    item.checkouts += BigInt(String(row.paid_checkouts));
    item.commission += BigInt(String(row.commission_accrued_minor));
    item.unknown ||= Number(row.unknown_commissions) > 0;
    staff.set(id, item);
  }
  const labels: Record<string, string> = {
    production: "Producción",
    ticket: "Ticket promedio",
    commission: "Comisiones",
  };
  return (
    <section className="stack">
      <ViewSwitcher
        label="Indicador financiero del equipo"
        value={view}
        onChange={setView}
        options={Object.entries(labels)}
      />
      <DataChart
        title={`${labels[view]} por profesional`}
        description={
          view === "ticket"
            ? "Producción asignada / checkouts pagados, redondeado a la unidad monetaria. Sin checkouts: no disponible."
            : view === "commission"
              ? "Devengadas en el período; no indica liquidaciones pagadas. Una regla desconocida deja el total sin graficar."
              : "Importe asignado al profesional por el motor financiero; no equivale a cobros ni resultado."
        }
        currency={currency}
        kind="bar"
        horizontal
        data={[...staff.values()].map((s) => ({
          label: s.name,
          value: chartInteger(
            view === "ticket"
              ? s.checkouts > 0n
                ? ((s.production + s.checkouts / 2n) / s.checkouts).toString()
                : null
              : view === "commission"
                ? s.unknown
                  ? null
                  : s.commission.toString()
                : s.production.toString(),
          ),
        }))}
        series={[{ key: "value", label: labels[view]! }]}
      />
    </section>
  );
}
