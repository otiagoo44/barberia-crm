"use client";
import { useId } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Empty } from "./ui";
import type { ChartProps } from "./chart";
import { money } from "@/features/finance/client";
const colors = [
  "var(--color-chart-primary)",
  "var(--color-chart-secondary)",
  "var(--color-chart-tertiary)",
  "var(--color-chart-quaternary)",
  "var(--color-chart-result)",
];
export function DataChart({
  title,
  description,
  data,
  series,
  kind = "line",
  currency,
  percent,
  horizontal = false,
}: ChartProps) {
  const id = useId();
  const format = (value: unknown) =>
    value === null || value === undefined
      ? "No disponible"
      : currency
        ? money(value, currency)
        : `${value}${percent ? "%" : ""}`;
  const available = data.some((d) =>
    series.some((s) => d[s.key] !== null && d[s.key] !== undefined),
  );
  const axes = (
    <>
      <CartesianGrid
        stroke="var(--border)"
        vertical={horizontal}
        horizontal={!horizontal}
      />
      <XAxis
        dataKey={horizontal ? undefined : "label"}
        type={horizontal ? "number" : "category"}
        allowDecimals={!!percent}
        tick={{ fontSize: 14, fill: "var(--muted)" }}
        tickLine={false}
        axisLine={false}
        minTickGap={20}
        tickCount={horizontal ? 3 : undefined}
        tickFormatter={
          horizontal
            ? (v) =>
                currency ? money(v, currency) : percent ? `${v}%` : String(v)
            : undefined
        }
      />
      <YAxis
        type={horizontal ? "category" : "number"}
        dataKey={horizontal ? "label" : undefined}
        allowDecimals={!!percent}
        tick={{ fontSize: 14, fill: "var(--muted)" }}
        tickLine={false}
        axisLine={false}
        width={horizontal ? 110 : currency ? 82 : 44}
        tickFormatter={(v) =>
          horizontal
            ? String(v)
            : currency
              ? new Intl.NumberFormat("es-PY", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(Number(v) / (currency === "PYG" ? 1 : 100))
              : percent
                ? `${v}%`
                : String(v)
        }
      />
      <Tooltip
        formatter={(v) => format(v)}
        contentStyle={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      />
      <Legend wrapperStyle={{ fontSize: 14, paddingTop: 12 }} />
    </>
  );
  return (
    <section className="panel chart-panel" aria-labelledby={id}>
      <div className="chart-heading">
        <div>
          <h2 id={id}>{title}</h2>
          <p>
            {description}
            {currency ? ` · ${currency}` : ""}
          </p>
        </div>
      </div>
      {available ? (
        <>
          <div
            className="chart-frame"
            style={
              horizontal
                ? {
                    height: Math.max(230, Math.min(data.length * 36 + 64, 800)),
                  }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              {kind === "bar" ? (
                <BarChart
                  layout={horizontal ? "vertical" : "horizontal"}
                  data={data}
                  accessibilityLayer
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  {axes}
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={colors[i % colors.length]}
                      radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart
                  data={data}
                  accessibilityLayer
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  {axes}
                  {series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="linear"
                      dataKey={s.key}
                      name={s.label}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      strokeDasharray={s.dashed ? "5 3" : undefined}
                      dot={data.length < 15}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>Ver datos de {title.toLocaleLowerCase("es")}</summary>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label={`Datos de ${title}`}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Período / categoría</th>
                    {series.map((s) => (
                      <th scope="col" key={s.key}>
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={`${d.label}:${i}`}>
                      <th scope="row">{d.label}</th>
                      {series.map((s) => (
                        <td key={s.key}>{format(d[s.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <Empty title="Sin datos para graficar">
          Registrá operaciones o elegí otro período. Los valores desconocidos no
          se representan como cero.
        </Empty>
      )}
    </section>
  );
}
