import test from "node:test";
import assert from "node:assert/strict";
import {
  observePublicBooking,
  professionalAccessReady,
  professionalConfigured,
  type SetupTeamPerson,
} from "../../src/lib/setup-readiness";
const person: SetupTeamPerson = {
  name: "Fixture",
  assigned: true,
  linked: true,
  membership: true,
  email_confirmed: true,
  capabilities: 4,
  verified_factors: 1,
  password_change_required: false,
};
test("Configured professional is independent of pending personal activation; one verified MFA enables access", () => {
  assert.equal(professionalConfigured(person), true);
  assert.equal(professionalAccessReady(person), true);
  const pending = {
    ...person,
    email_confirmed: false,
    verified_factors: 0,
    password_change_required: true,
  };
  assert.equal(professionalConfigured(pending), true);
  assert.equal(professionalAccessReady(pending), false);
  assert.equal(
    professionalAccessReady({ ...person, password_change_required: undefined }),
    false,
  );
  assert.equal(
    professionalAccessReady({
      ...person,
      verified_factors: 0,
      mfa_required: false,
    }),
    true,
  );
  assert.equal(
    professionalAccessReady({
      ...person,
      verified_factors: 0,
      mfa_required: true,
    }),
    false,
  );
});
test("Public booking readiness checks actual JSON contract; closed days are not missing configuration", async () => {
  const catalog = {
    slug: "fixture-a",
    website_booking_version: 1,
    branches: [
      {
        slug: "a1",
        staff: [{ slug: "staff" }],
        services: [
          {
            slug: "cut",
            consultation_required: false,
            composition_mode: "standalone",
          },
        ],
      },
    ],
  };
  const reads: string[] = [];
  const result = await observePublicBooking(
    "https://crm.example",
    "fixture-a",
    "a1",
    "2026-11-01",
    (async (url) => {
      reads.push(String(url));
      return Response.json(reads.length === 1 ? catalog : []);
    }) as typeof fetch,
  );
  assert.deepEqual(result, {
    catalog: true,
    availability: true,
    failed: false,
  });
  assert.equal(reads.length, 2);
  for (const response of [
    new Response("<html>starter</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    Response.json({ ...catalog, slug: "other" }),
    Response.json({ error: "closed" }, { status: 404 }),
  ]) {
    assert.equal(
      (
        await observePublicBooking(
          "https://crm.example",
          "fixture-a",
          "a1",
          "2026-11-01",
          (async () => response) as typeof fetch,
        )
      ).failed,
      true,
    );
  }
});
