import { fromZonedTime } from "date-fns-tz";
/** Elapsed minutes, including 23/25-hour dates and appointments across midnight. */
export function calendarBounds(day: string, tz: string) {
  const next = new Date(day + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const origin = fromZonedTime(day + "T00:00:00", tz).getTime();
  const end = fromZonedTime(
    next.toISOString().slice(0, 10) + "T00:00:00",
    tz,
  ).getTime();
  return { origin, end, minutes: (end - origin) / 60000 };
}
export function visibleInterval(
  startsAt: string,
  endsAt: string,
  origin: number,
  end: number,
) {
  const start = Math.max(origin, new Date(startsAt).getTime());
  const finish = Math.min(end, new Date(endsAt).getTime());
  return finish > start
    ? {
        start: (start - origin) / 60000,
        end: (finish - origin) / 60000,
        duration: (finish - start) / 60000,
      }
    : null;
}
