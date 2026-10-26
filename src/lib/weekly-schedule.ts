export const weekDays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function weeklyBlocks(
  days: number[],
  start: string,
  end: string,
  pauseStart = "",
  pauseEnd = "",
) {
  if (
    !days.length ||
    days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(days).size !== days.length
  )
    throw new Error("Elegí los días que querés modificar.");
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(start) || !time.test(end) || start >= end)
    throw new Error("El inicio debe ser anterior al fin del turno.");
  if (
    (pauseStart || pauseEnd) &&
    (!time.test(pauseStart) ||
      !time.test(pauseEnd) ||
      pauseStart <= start ||
      pauseEnd >= end ||
      pauseStart >= pauseEnd)
  )
    throw new Error("El descanso debe estar completo y dentro del turno.");
  return days.flatMap((weekday) =>
    pauseStart
      ? [
          { weekday, starts_at: start, ends_at: pauseStart },
          { weekday, starts_at: pauseEnd, ends_at: end },
        ]
      : [{ weekday, starts_at: start, ends_at: end }],
  );
}
