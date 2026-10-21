"use client";
import dynamic from "next/dynamic";
import { Loading } from "./ui";
export type ChartPoint = {
  label: string;
  [key: string]: string | number | null;
};
export type ChartProps = {
  title: string;
  description: string;
  data: ChartPoint[];
  series: { key: string; label: string }[];
  kind?: "line" | "bar";
  currency?: string;
  percent?: boolean;
  horizontal?: boolean;
};
export const DataChart = dynamic<ChartProps>(
  () => import("./data-chart").then((m) => m.DataChart),
  { ssr: false, loading: () => <Loading /> },
);
