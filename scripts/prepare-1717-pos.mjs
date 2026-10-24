import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Preparation only. Provider evidence, effective date and fixed fees must be
// supplied explicitly; unknown is never silently converted to zero.
export function pos1717Sql(options) {
  if (options.projectRef !== "tbcfhagteyqufjkmbxzz")
    throw new Error("Unexpected project");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      options.organizationId ?? "",
    )
  )
    throw new Error("Verified organizationId required");
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(
      options.effectiveFrom ?? "",
    ) ||
    !Number.isFinite(Date.parse(options.effectiveFrom))
  )
    throw new Error("Explicit effectiveFrom with timezone required");
  if (
    typeof options.evidenceReference !== "string" ||
    options.evidenceReference.trim().length < 5 ||
    options.evidenceReference.length > 250
  )
    throw new Error("Provider evidence required");
  for (const method of ["debit", "credit"]) {
    if (
      !Number.isSafeInteger(options.fixedAmountMinor?.[method]) ||
      options.fixedAmountMinor[method] < 0 ||
      options.fixedAmountMinor[method] > 9000000000000
    )
      throw new Error(`Confirmed integer fixed charge required for ${method}`);
  }
  for (const field of [
    "vatTreatment",
    "withholdingTreatment",
    "otherChargesTreatment",
  ]) {
    if (
      typeof options[field] !== "string" ||
      options[field].trim().length < 5 ||
      options[field].length > 250
    )
      throw new Error(`Verified ${field} required; unknown is not zero`);
  }
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const rates = [
    { code: "debit", bps: 200, fixed: options.fixedAmountMinor.debit },
    { code: "credit", bps: 500, fixed: options.fixedAmountMinor.credit },
  ];
  return `begin;
set local lock_timeout='5s';
do $pos$
declare org uuid := '${options.organizationId}'; since timestamptz := ${literal(options.effectiveFrom)};
 item jsonb; method_id uuid; new_rule_id uuid; existing public.payment_method_fee_rules;
begin
 if not app_private.has_org_role(org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(org);
 if not app_private.has_org_role(org,array['organization_owner']) or not exists(select 1 from public.organizations where id=org and slug='1717-barberia' and currency='PYG' and active) then raise exception 'forbidden' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(${literal(JSON.stringify(rates))}::jsonb) loop
  select id into strict method_id from public.payment_methods where organization_id=org and code=item->>'code' and type='card' and active;
  select * into existing from public.payment_method_fee_rules where organization_id=org and payment_method_id=method_id and effective_from=since and active;
  if existing.id is not null then
    if existing.percentage_bps<>(item->>'bps')::integer or existing.fixed_amount_minor<>(item->>'fixed')::bigint or existing.evidence_reference is distinct from ${literal(options.evidenceReference)} then raise exception 'Different tariff already exists at effective date'; end if;
    continue;
  end if;
  if since<now() then raise exception 'Prospective tariff date required'; end if;
  new_rule_id:=(public.finance_command(org,null,'configure',jsonb_build_object('entity','payment_method_fee_rules','payment_method_id',method_id,
    'percentage_bps',(item->>'bps')::integer,'fixed_amount_minor',(item->>'fixed')::bigint,'effective_from',since,'evidence_reference',${literal(options.evidenceReference)}),gen_random_uuid())->>'id')::uuid;
  perform app_private.record_audit(org,null,'1717.pos_evidence','payment_method_fee_rules',new_rule_id,
    jsonb_build_object('vat',${literal(options.vatTreatment)},'withholding',${literal(options.withholdingTreatment)},'other_charges',${literal(options.otherChargesTreatment)},'provider','UPay'),gen_random_uuid());
 end loop;
end $pos$;
commit;
`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [, , optionsFile, destination] = process.argv;
  if (!optionsFile || !destination)
    throw new Error(
      "Usage: node scripts/prepare-1717-pos.mjs verified-fee-options.json output.sql",
    );
  await writeFile(
    destination,
    pos1717Sql(JSON.parse(await readFile(optionsFile, "utf8"))),
    { mode: 0o600 },
  );
  console.log("POS SQL prepared only; no production tariff changed.");
}
