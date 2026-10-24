import test from "node:test";
import assert from "node:assert/strict";
import { validateRecord } from "../../src/lib/record-validation";
import { operationError } from "../../src/lib/operation-errors";
import { weeklyBlocks } from "../../src/lib/weekly-schedule";
import { pos1717Sql } from "../../scripts/prepare-1717-pos.mjs";

test("service creation normalizes the legacy Other category and reports field failures", () => {
  const base = {
    name: "Tinte global",
    slug: "tinte-global",
    default_duration_minutes: 150,
    website_category: "otro",
    composition_mode: "standalone",
  };
  const valid = validateRecord("services", base, true);
  assert.deepEqual(valid.fields, {});
  assert.equal(valid.data.website_category, null);
  const invalid = validateRecord(
    "services",
    { ...base, slug: "Tinte Global", default_duration_minutes: 0 },
    true,
  );
  assert.match(invalid.fields.slug, /minúsculas/);
  assert.match(invalid.fields.default_duration_minutes, /mayor que cero/);
  assert.ok(
    validateRecord(
      "services",
      { ...base, website_category: "rulos", consultation_required: false },
      true,
    ).fields.consultation_required,
  );
});
test("domain errors remain specific without exposing SQL details", () => {
  assert.match(
    operationError({ code: "23514", message: "fee_rule_required" })!.message,
    /tarifa vigente/,
  );
  assert.equal(
    operationError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "services_organization_id_slug_key"',
      details: "sensitive row",
    })!.field,
    "slug",
  );
  assert.equal(
    operationError({ code: "23514", message: "arbitrary internal secret" }),
    undefined,
  );
});
test("weekly copying splits a confirmed break and never selects Sunday implicitly", () => {
  const blocks = weeklyBlocks([1, 2, 6], "09:00", "19:00", "12:00", "12:30");
  assert.equal(blocks.length, 6);
  assert.ok(blocks.every((b) => b.weekday !== 0));
  assert.deepEqual(blocks.slice(0, 2), [
    { weekday: 1, starts_at: "09:00", ends_at: "12:00" },
    { weekday: 1, starts_at: "12:30", ends_at: "19:00" },
  ]);
  assert.throws(
    () => weeklyBlocks([1], "09:00", "13:00", "12:00", "14:00"),
    /descanso/,
  );
  assert.throws(() => weeklyBlocks([1, 1], "09:00", "13:00"), /días/);
});
test("POS preparation requires explicit versioned rates rather than old hardcoded estimates", () => {
  const options = {
    projectRef: "tbcfhagteyqufjkmbxzz",
    organizationId: "11111111-1111-4111-8111-111111111111",
    effectiveFrom: "2026-12-01T09:00:00-03:00",
    evidenceReference: "Isolated verified terms",
    percentageBps: { debit: 220, credit: 520 },
    fixedAmountMinor: { debit: 0, credit: 0 },
    vatTreatment: "Fixture included",
    withholdingTreatment: "Fixture included",
    otherChargesTreatment: "Fixture no charges",
  };
  const components = {
    debit: { processing: 200, vat: 20, withholding: 0, other: 0 },
    credit: { processing: 470, vat: 47, withholding: 3, other: 0 },
  }; // synthetic
  const verified = { ...options, rateComponents: components };
  const sql = pos1717Sql(verified);
  assert.match(sql, /"bps":220/);
  assert.match(sql, /"bps":520/);
  assert.match(
    pos1717Sql({
      ...verified,
      percentageBps: { debit: 230, credit: 530 },
      rateComponents: {
        debit: { ...components.debit, processing: 210 },
        credit: { ...components.credit, processing: 480 },
      },
    }),
    /"bps":230/,
  );
  assert.throws(
    () => pos1717Sql({ ...verified, percentageBps: undefined as never }),
    /percentageBps/,
  );
  assert.throws(
    () =>
      pos1717Sql({
        ...verified,
        fixedAmountMinor: { debit: null as never, credit: 0 },
      }),
    /fixed charge/,
  );
  assert.throws(
    () => pos1717Sql({ ...verified, rateComponents: undefined as never }),
    /rateComponents/,
  );
});
