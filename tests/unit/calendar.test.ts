import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarBounds, visibleInterval } from "../../src/lib/calendar";
test("calendar retains elapsed duration through DST and midnight; adjacent intervals stay adjacent", () => {
  const spring = calendarBounds("2026-03-08", "America/New_York");
  const fall = calendarBounds("2026-11-01", "America/New_York");
  assert.equal(spring.minutes, 1380);
  assert.equal(fall.minutes, 1500);
  const repeated = visibleInterval(
    "2026-11-01T05:30:00Z",
    "2026-11-01T06:30:00Z",
    fall.origin,
    fall.end,
  )!;
  assert.equal(repeated.duration, 60);
  const day = calendarBounds("2026-10-21", "Etc/UTC");
  const previous = visibleInterval(
    "2026-10-20T23:40:00Z",
    "2026-10-21T00:20:00Z",
    day.origin,
    day.end,
  )!;
  assert.deepEqual(previous, { start: 0, end: 20, duration: 20 });
  const adjacent = visibleInterval(
    "2026-10-21T00:20:00Z",
    "2026-10-21T00:25:00Z",
    day.origin,
    day.end,
  )!;
  assert.equal(previous.end, adjacent.start);
  assert.equal(adjacent.duration, 5);
  assert.equal(
    visibleInterval(
      "2026-10-20T23:00:00Z",
      "2026-10-21T00:00:00Z",
      day.origin,
      day.end,
    ),
    null,
  );
});
