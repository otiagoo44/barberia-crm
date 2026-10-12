import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  phone,
  date,
  customerInput,
  csvCell,
} from "../../src/lib/validation";
import {
  nextServiceSelection,
  type PickableService,
} from "../../src/features/services/service-picker";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
test("International phone normalization preserves tenant-independent identity", () => {
  assert.equal(normalizePhone(" +595 (981) 123-456 "), "+595981123456");
  assert.ok(phone.safeParse(normalizePhone("+595 (981) 123-456")).success);
  for (const invalid of [
    "0981123456",
    "+0123456789",
    "+123",
    "+1234567890123456",
  ])
    assert.equal(phone.safeParse(invalid).success, false);
});
test("External customer input rejects extra tenant IDs and malformed dates", () => {
  const customer = { name: "Ana", normalized_phone: "+595981123456" };
  assert.ok(customerInput.safeParse(customer).success);
  assert.equal(
    customerInput.safeParse({
      ...customer,
      organization_id: crypto.randomUUID(),
    }).success,
    false,
  );
  for (const invalid of ["2026-02-30", "2026-13-01", "2025-02-29", "2026-1-1"])
    assert.equal(date.safeParse(invalid).success, false);
  assert.ok(date.safeParse("2028-02-29").success);
});
test("CSV export neutralizes spreadsheet formulas and quotes", () => {
  for (const text of [
    "=SUM(1,2)",
    "+1",
    "-2",
    "@cmd",
    "\tformula",
    "\rformula",
  ])
    assert.ok(csvCell(text).startsWith("\"'"));
  assert.equal(csvCell('Ana "A"'), '"Ana ""A"""');
  assert.equal(csvCell(null), '""');
});
test("Service selection keeps exactly one primary and removes dependent options", () => {
  const all: PickableService[] = [
    {
      id: "cut",
      name: "Corte",
      composition_mode: "standalone",
      base_service_id: null,
    },
    {
      id: "curl",
      name: "Rulos",
      composition_mode: "standalone",
      base_service_id: null,
    },
    {
      id: "design",
      name: "Diseño",
      composition_mode: "included",
      base_service_id: "cut",
    },
    {
      id: "wash",
      name: "Lavado",
      composition_mode: "additive",
      base_service_id: null,
    },
    {
      id: "override",
      name: "Premium",
      composition_mode: "override",
      base_service_id: "cut",
    },
  ];
  assert.deepEqual(nextServiceSelection([], all[2], all), ["cut", "design"]);
  assert.deepEqual(nextServiceSelection(["cut", "design"], all[0], all), []);
  assert.deepEqual(
    nextServiceSelection(["cut", "design", "wash"], all[1], all),
    ["wash", "curl"],
  );
  assert.deepEqual(nextServiceSelection([], all[4], all), ["cut", "override"]);
});
test("Asuncion dates and DST-aware local boundaries resolve to UTC instants", () => {
  const utc = fromZonedTime("2026-10-12T09:00:00", "America/Asuncion");
  assert.equal(
    formatInTimeZone(utc, "America/Asuncion", "yyyy-MM-dd HH:mm"),
    "2026-10-12 09:00",
  );
  const before = fromZonedTime("2026-03-08T00:00:00", "America/New_York");
  const after = fromZonedTime("2026-03-09T00:00:00", "America/New_York");
  assert.equal((after.getTime() - before.getTime()) / 3600000, 23);
});
