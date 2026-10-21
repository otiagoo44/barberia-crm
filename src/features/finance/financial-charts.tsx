"use client";
import { DataChart } from "@/components/chart";
import { Notice, Loading } from "@/components/ui";
import { useResource } from "@/lib/client";
import { chartInteger } from "@/lib/chart-values";
import { financeUrl } from "./client";
type Series = {
  days: {
    date: string;
    sales: string;
    collected: string;
    expenses: string;
    result: string | null;
    incomplete: boolean;
  }[];
  expenses: { name: string; amount: string }[];
};
export function FinancialCharts({
  org,
  branch,
  from,
  to,
  currency,
}: {
  org: string;
  branch: string;
  from: string;
  to: string;
  currency: string;
}) {
  const r = useResource<Series>(financeUrl("series", org, branch, from, to));
  if (r.loading) return <Loading />;
  if (r.error) return <Notice error>{r.error}</Notice>;
  const days =
    r.data?.days.map((d) => ({
      label: d.date.slice(5),
      sales: chartInteger(d.sales),
      collected: chartInteger(d.collected),
      result: chartInteger(d.result),
    })) ?? [];
  return (
    <>
      <div className="dashboard-grid">
        <DataChart
          title="Ventas y dinero cobrado"
          description={`${from} a ${to} · fechas de registro y cobro independientes`}
          data={days}
          currency={currency}
          series={[
            { key: "sales", label: "Ventas netas" },
            { key: "collected", label: "Cobros netos" },
          ]}
        />
        <DataChart
          title="Resultado operativo"
          description="Ventas netas menos POS, gastos y comisiones; no indica efectivo"
          data={days}
          currency={currency}
          series={[{ key: "result", label: "Resultado" }]}
        />
        <DataChart
          title="Gastos por categoría"
          description="Gastos operativos y salarios, netos de reversiones del período"
          kind="bar"
          horizontal
          data={
            r.data?.expenses.map((d) => ({
              label: d.name,
              amount: chartInteger(d.amount),
            })) ?? []
          }
          currency={currency}
          series={[{ key: "amount", label: "Gastos netos" }]}
        />
      </div>
      {r.data?.days.some((d) => d.incomplete) && (
        <Notice>
          Hay días con tarifas o comisiones desconocidas. El resultado de esos
          días queda sin graficar.
        </Notice>
      )}
    </>
  );
}
