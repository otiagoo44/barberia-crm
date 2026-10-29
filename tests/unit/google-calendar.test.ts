import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  calendarContext,
  calendarEvent,
  calendarEventId,
  decryptCalendarSecret,
  encryptCalendarSecret,
  projectCalendarEvent,
  type CalendarSnapshot,
} from "../../src/lib/google-calendar";

const snapshot: CalendarSnapshot = {
  organization: "org-a",
  staff: "staff-a",
  profile: "profile-a",
  auth_version: "version",
  calendar_id: "app-calendar@group.calendar.google.com",
  refresh_cipher: "not-a-token",
  appointment: "appointment-a",
  revision: 1,
  remove: false,
  starts_at: "2026-10-30T22:00:00Z",
  ends_at: "2026-10-30T22:40:00Z",
  status: "scheduled",
  services: "Corte",
  slug: "fixture-a",
  timezone: "America/Asuncion",
  location: "Local",
};
test("Calendar token encryption is authenticated, randomized and tenant/user bound", () => {
  const key = randomBytes(32).toString("hex"),
    context = calendarContext("org-a", "staff-a", "profile-a");
  const first = encryptCalendarSecret("synthetic-refresh-token", context, key);
  assert.notEqual(
    first,
    encryptCalendarSecret("synthetic-refresh-token", context, key),
  );
  assert.equal(
    decryptCalendarSecret(first, context, key),
    "synthetic-refresh-token",
  );
  assert.throws(() =>
    decryptCalendarSecret(
      first,
      calendarContext("org-b", "staff-a", "profile-a"),
      key,
    ),
  );
  assert.throws(() =>
    decryptCalendarSecret(
      first,
      calendarContext("org-a", "staff-a", "profile-b"),
      key,
    ),
  );
  const parts = first.split(".");
  parts[2] = Buffer.alloc(16).toString("base64url");
  assert.throws(() => decryptCalendarSecret(parts.join("."), context, key));
});
test("Calendar events contain local timezone and CRM link, without client contact or private notes", () => {
  const event = calendarEvent(snapshot, "https://crm.example");
  assert.equal(event.start.timeZone, "America/Asuncion");
  assert.equal(event.start.dateTime, snapshot.starts_at);
  assert.equal(event.visibility, "private");
  assert.match(event.description, /\/fixture-a\/agenda\?date=2026-10-30/);
  assert.ok(!("attendees" in event));
  const id = calendarEventId(
    "connection-a",
    snapshot.calendar_id,
    snapshot.appointment,
  );
  assert.match(id, /^[0-9a-v]{5,1024}$/);
  assert.equal(
    id,
    calendarEventId("connection-a", snapshot.calendar_id, snapshot.appointment),
  );
  assert.notEqual(
    id,
    calendarEventId("connection-b", snapshot.calendar_id, snapshot.appointment),
  );
});
test("Calendar create retry, reschedule and cancellation reuse the same external event", async () => {
  let event: Record<string, unknown> | null = null;
  let created = 0,
    updated = 0,
    deleted = 0;
  const request = (async (
    _url: string | URL | Request,
    options: RequestInit = {},
  ) => {
    if (!options.method)
      return event ? Response.json(event) : new Response(null, { status: 404 });
    if (options.method === "POST") {
      created++;
      event = JSON.parse(String(options.body));
      return Response.json(event, { status: 201 });
    }
    if (options.method === "PUT") {
      updated++;
      event = JSON.parse(String(options.body));
      return Response.json(event);
    }
    if (options.method === "DELETE") {
      deleted++;
      event = null;
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected request");
  }) as typeof fetch;
  await projectCalendarEvent(
    "connection",
    snapshot,
    "synthetic-access",
    "https://crm.example",
    request,
  );
  await projectCalendarEvent(
    "connection",
    snapshot,
    "synthetic-access",
    "https://crm.example",
    request,
  );
  await projectCalendarEvent(
    "connection",
    {
      ...snapshot,
      starts_at: "2026-10-31T12:00:00Z",
      ends_at: "2026-10-31T12:40:00Z",
    },
    "synthetic-access",
    "https://crm.example",
    request,
  );
  assert.equal(created, 1);
  assert.equal(updated, 2);
  const latest = event as Record<string, unknown> | null;
  assert.equal(
    (latest?.start as { dateTime: string })?.dateTime,
    "2026-10-31T12:00:00Z",
  );
  await projectCalendarEvent(
    "connection",
    { ...snapshot, remove: true },
    "synthetic-access",
    "https://crm.example",
    request,
  );
  await projectCalendarEvent(
    "connection",
    { ...snapshot, remove: true },
    "synthetic-access",
    "https://crm.example",
    request,
  );
  assert.equal(deleted, 1);
});
test("Calendar projection rejects wrong ownership, revoked access and provider failures", async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(
      projectCalendarEvent(
        "connection",
        snapshot,
        "synthetic",
        "https://crm.example",
        (async () => new Response(null, { status })) as typeof fetch,
      ),
    );
  }
  let writes = 0;
  await assert.rejects(
    projectCalendarEvent(
      "connection",
      snapshot,
      "synthetic",
      "https://crm.example",
      (async (_url, options) => {
        if (options?.method) writes++;
        return Response.json({
          extendedProperties: {
            private: { barberiaAppointment: "someone-else" },
          },
        });
      }) as typeof fetch,
    ),
  );
  assert.equal(writes, 0);
});

test("A 409 after an ambiguous creation updates the owned event instead of creating a second one", async () => {
  let reads=0, inserts=0, updates=0;
  await projectCalendarEvent("connection",snapshot,"synthetic","https://crm.example",(async(_url,options)=>{
    if(!options?.method){reads++;return reads===1?new Response(null,{status:404}):Response.json(calendarEvent(snapshot,"https://crm.example"));}
    if(options.method==='POST'){inserts++;return new Response(null,{status:409});}
    if(options.method==='PUT'){updates++;return Response.json(JSON.parse(String(options.body)));}
    throw new Error('Unexpected request');
  }) as typeof fetch);
  assert.equal(inserts,1);assert.equal(updates,1);assert.equal(reads,2);
});
test("Google 403 quotas remain retryable; missing permission requires reconnection", async () => {
  for (const [reason, authorizationRequired] of [["rateLimitExceeded", false], ["insufficientPermissions", true]] as const) {
    await assert.rejects(projectCalendarEvent("connection",snapshot,"synthetic","https://crm.example",(async()=>Response.json({error:{errors:[{reason}]}},{status:403})) as typeof fetch), error => typeof error === "object" && error !== null && "authorizationRequired" in error && error.authorizationRequired === authorizationRequired);
  }
});
