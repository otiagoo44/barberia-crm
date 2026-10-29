import test from "node:test";
import assert from "node:assert/strict";
import { bookingWhatsAppUrl } from "../../src/lib/booking-whatsapp";

const booking = {
  phone: "+595 983 402 497",
  organization: "17:17 Barbería",
  branch: "Luque",
  timezone: "America/Asuncion",
  reference: "fixture-reference",
  startsAt: "2026-10-27T22:50:00Z",
  durationMinutes: 40,
  services: ["Corte de pelo", "Diseño & estilo"],
};

test("Confirmation notice uses the catalog phone, local time and server reference", () => {
  const url = new URL(bookingWhatsAppUrl({ ...booking, requestedStaff: "Jonatan" })!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/595983402497");
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
  const message = url.searchParams.get("text")!;
  for (const text of ["17:17 Barbería · Luque", "Corte de pelo + Diseño & estilo", "Profesional solicitado: Jonatan", "27/10/2026 · 19:50", "40 min", "fixture-reference"]) {
    assert.ok(message.includes(text));
  }
});

test("Missing or unsafe branch phones never fall back to another business", () => {
  for (const number of [undefined, null, "", "javascript:alert(1)", "+123", "+0123456789", "595983402497", "+595983402497?text=other"]) {
    assert.equal(bookingWhatsAppUrl({ ...booking, phone: number }), null);
  }
  const otherBranch = new URL(bookingWhatsAppUrl({ ...booking, phone: "+12025550199" })!);
  assert.equal(otherBranch.pathname, "/12025550199");
  assert.ok(!otherBranch.searchParams.get("text")!.includes("Profesional"));
});
