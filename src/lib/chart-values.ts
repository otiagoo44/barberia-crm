/** Never turn unknown values or unsafe integer amounts into an apparent zero. */
export function chartInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && !/^-?\d+$/.test(value)) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
export function utilization(
  booked: unknown,
  available: unknown,
): number | null {
  const numerator = chartInteger(booked),
    denominator = chartInteger(available);
  return numerator === null || denominator === null || denominator <= 0
    ? null
    : Math.round((numerator / denominator) * 1000) / 10;
}
