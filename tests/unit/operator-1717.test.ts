import test from "node:test";
import assert from "node:assert/strict";
import { confirmed1717Sql } from "../../scripts/configure-confirmed-1717.mjs";
import { pos1717Sql } from "../../scripts/prepare-1717-pos.mjs";

test("17:17 maintenance plan refuses unverified identities and another project", async () => {
  const options = {
    projectRef: "tbcfhagteyqufjkmbxzz",
    organizationId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    estebanId: "33333333-3333-4333-8333-333333333333",
    jonatanId: "44444444-4444-4444-8444-444444444444",
    effectiveDate: "2026-10-24",
  };
  await assert.rejects(
    confirmed1717Sql({ ...options, projectRef: "different" }),
    /Unexpected project/,
  );
  await assert.rejects(
    confirmed1717Sql({ ...options, branchId: options.organizationId }),
    /Distinct/,
  );
  await assert.rejects(
    confirmed1717Sql({ ...options, estebanId: "unknown" }),
    /Verified/,
  );
  await assert.rejects(
    confirmed1717Sql({ ...options, effectiveDate: "2026-02-30" }),
    /valid prospective/,
  );
});
test("POS preparation refuses an unknown fixed charge, date or evidence", () => {
  const options = {
    projectRef: "tbcfhagteyqufjkmbxzz",
    organizationId: "11111111-1111-4111-8111-111111111111",
    effectiveFrom: "2026-10-24T09:00:00-03:00",
    evidenceReference: "synthetic provider evidence",
    fixedAmountMinor: { debit: 0, credit: 0 },
  };
  assert.throws(
    () => pos1717Sql({ ...options, effectiveFrom: "" }),
    /effectiveFrom/,
  );
  assert.throws(
    () => pos1717Sql({ ...options, evidenceReference: "" }),
    /evidence/,
  );
  assert.throws(
    () =>
      pos1717Sql({
        ...options,
        fixedAmountMinor: { debit: null as unknown as number, credit: 0 },
      }),
    /fixed charge/,
  );
  assert.throws(
    () =>
      pos1717Sql({ ...options, fixedAmountMinor: { debit: 0.2, credit: 0 } }),
    /integer fixed/,
  );
});
