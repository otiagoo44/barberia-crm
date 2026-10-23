import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Generates reviewable SQL; never opens a network connection or logs credentials.
// Applying requires a privileged maintenance connection with the REAL operator's
// verified owner/AAL2/session context. This file never manufactures that context.
export async function confirmed1717Sql(options) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const key of ["organizationId", "branchId", "estebanId", "jonatanId"])
    if (!uuid.test(options[key] ?? ""))
      throw new Error(`Verified ${key} required`);
  if (
    new Set([
      options.organizationId,
      options.branchId,
      options.estebanId,
      options.jonatanId,
    ]).size !== 4
  )
    throw new Error("Distinct verified identifiers required");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(options.effectiveDate ?? "") ||
    new Date(options.effectiveDate + "T00:00:00Z")
      .toISOString()
      .slice(0, 10) !== options.effectiveDate
  )
    throw new Error("Explicit valid prospective local effectiveDate required");
  if (options.projectRef !== "tbcfhagteyqufjkmbxzz")
    throw new Error("Unexpected project reference");
  const manifest = JSON.parse(
    await readFile(
      new URL("../config/onboarding/1717.json", import.meta.url),
      "utf8",
    ),
  );
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  return `-- Target: tbcfhagteyqufjkmbxzz. Review inspect-1717.sql evidence first.
-- No onboarding, users, invitations, payments, POS activation or public activation.
begin;
set local lock_timeout = '5s';
do $confirmed$
declare
 org uuid := '${options.organizationId}'; branch uuid := '${options.branchId}';
 esteban uuid := '${options.estebanId}'; jonatan uuid := '${options.jonatanId}';
 since date := '${options.effectiveDate}'; manifest jsonb := ${literal(JSON.stringify(manifest))}::jsonb;
 item jsonb; shift jsonb; segment jsonb; old_data jsonb; next_data jsonb;
 v_service_id uuid; branch_service_id uuid; v_staff_id uuid; rule record; appointment record;
 segments jsonb; preserved_consultation boolean; actor uuid;
begin
 actor := app_private.current_profile();
 if actor is null or not app_private.has_org_role(org,array['organization_owner']) then
   raise exception 'Real active owner AAL2 session required' using errcode='42501'; end if;
 perform app_private.lock_organization(org);
 if not app_private.has_org_role(org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.organizations where id=org and slug='1717-barberia' and active and currency='PYG' and timezone='America/Asuncion')
 or not exists(select 1 from public.branches where organization_id=org and id=branch and slug='luque' and active and timezone='America/Asuncion')
 or not exists(select 1 from public.staff where organization_id=org and id=esteban and slug='esteban' and active)
 or not exists(select 1 from public.staff where organization_id=org and id=jonatan and slug='jonatan' and active)
 then raise exception 'Verified identity mismatch'; end if;
 if not exists(select 1 from public.organization_settings where organization_id=org)
 or not exists(select 1 from public.branch_settings where organization_id=org and branch_id=branch)
 or not exists(select 1 from public.finance_settings where organization_id=org)
 then raise exception 'Existing organization settings required; do not rerun onboarding'; end if;
 if since < (now() at time zone 'America/Asuncion')::date then raise exception 'Historical schedule activation forbidden'; end if;
 if (select count(*) from public.staff_branch_assignments a where a.organization_id=org and a.branch_id=branch and a.staff_id in(esteban,jonatan) and a.active)<>2
 then raise exception 'Verified active assignments required'; end if;
 -- Keep release closed. Never turn an unexpectedly active business off silently.
 if exists(select 1 from public.organization_settings where organization_id=org and booking_enabled)
 or exists(select 1 from public.branch_settings where organization_id=org and branch_id=branch and booking_enabled)
 or exists(select 1 from public.partner_distribution_policies where organization_id=org and branch_id=branch and enabled and version=(select max(version) from public.partner_distribution_policies where organization_id=org and branch_id=branch))
 then raise exception 'Activation state changed: review before configuration'; end if;
 if exists(select 1 from public.organization_settings where organization_id=org and booking_lead_minutes<>0) then
 perform public.manage_record(org,'organization_settings',(select id from public.organization_settings where organization_id=org),null,'{"booking_lead_minutes":0}'); end if;
 if exists(select 1 from public.organizations where id=org and name<>manifest->'organization'->>'name') then
 perform public.update_organization(org,jsonb_build_object('name',manifest->'organization'->>'name')); end if;
 next_data := jsonb_build_object('name','Luque','address',manifest->'branch'->>'address','phone',manifest->'branch'->>'phone');
 select jsonb_build_object('name',name,'address',address,'phone',phone) into old_data from public.branches where id=branch and organization_id=org;
 if old_data is distinct from next_data then perform public.manage_record(org,'branches',branch,branch,next_data); end if;
 -- Current tariff version, effective at this transaction; previous appointment
 -- and checkout snapshots are immutable. Audit preserves before/after prices.
 for item in select value from jsonb_array_elements(manifest->'services') loop
   select id,consultation_required into v_service_id,preserved_consultation from public.services where organization_id=org and slug=item->>'slug';
   if v_service_id is null and exists(select 1 from public.services where organization_id=org and lower(name)=lower(item->>'name')) then
     raise exception 'Service name exists under another slug: manual identity review required'; end if;
   next_data := jsonb_build_object('name',item->>'name','slug',item->>'slug','default_duration_minutes',(item->>'duration_minutes')::integer,
     'website_category',item->>'website_category','category',item->>'website_category',
     'consultation_required',coalesce(preserved_consultation,false) or (item->>'consultation_required')::boolean,
     'composition_mode','standalone','base_service_id',null);
   select to_jsonb(s) into old_data from public.services s where id=v_service_id and organization_id=org;
   if v_service_id is null or exists(select 1 from jsonb_each(next_data) e where old_data->e.key is distinct from e.value) then
     v_service_id := (public.manage_record(org,'services',v_service_id,null,next_data)->>'id')::uuid;
     perform app_private.record_audit(org,branch,'1717.catalog_version','services',v_service_id,
       jsonb_build_object('before',old_data,'after',next_data,'effective_at',now(),'source','owner-confirmed-20261023'),gen_random_uuid());
   end if;
   select id,to_jsonb(bs) into branch_service_id,old_data from public.branch_services bs where organization_id=org and branch_id=branch and bs.service_id=v_service_id;
   next_data := jsonb_build_object('service_id',v_service_id,'duration_minutes',(item->>'duration_minutes')::integer,'price_minor',(item->>'price_minor')::bigint);
   if branch_service_id is null or exists(select 1 from jsonb_each(next_data) e where old_data->e.key is distinct from e.value) then
     branch_service_id := (public.manage_record(org,'branch_services',branch_service_id,branch,next_data)->>'id')::uuid;
     perform app_private.record_audit(org,branch,'1717.tariff_version','branch_services',branch_service_id,
       jsonb_build_object('before',old_data,'after',next_data,'effective_at',now(),'source','owner-confirmed-20261023'),gen_random_uuid());
   end if;
   foreach v_staff_id in array array[esteban,jonatan] loop
     if not exists(select 1 from public.staff_service_capabilities c where organization_id=org and c.staff_id=v_staff_id and c.service_id=v_service_id) then
       perform public.manage_record(org,'staff_service_capabilities',null,null,jsonb_build_object('staff_id',v_staff_id,'service_id',v_service_id)); end if;
   end loop;
 end loop;
 -- Never delete historical rules, exceptions, closures, absences or bookings.
 -- Split only Esteban's weekly intervals around the provisional usual break.
 foreach v_staff_id in array array[esteban,jonatan] loop
   segments := '[]'::jsonb;
   for shift in select value from jsonb_array_elements(manifest->'weekly_availability'->case when v_staff_id=esteban then 'esteban' else 'jonatan' end) loop
     if v_staff_id=esteban then
       segments := segments || jsonb_build_array(shift||'{"ends_at":"12:00"}'::jsonb,shift||'{"starts_at":"12:30"}'::jsonb);
     else segments := segments||jsonb_build_array(shift); end if;
   end loop;
   -- A different pre-existing future plan needs review, never a silent overwrite.
   if exists(select 1 from public.staff_availability_rules r where r.organization_id=org and r.branch_id=branch and r.staff_id=v_staff_id
      and r.valid_from>since and not exists(select 1 from jsonb_array_elements(segments) e where (e->>'weekday')::integer=r.weekday and (e->>'starts_at')::time=r.starts_at and (e->>'ends_at')::time=r.ends_at))
   then raise exception 'Existing future schedule requires review'; end if;
   for rule in select r.* from public.staff_availability_rules r where r.organization_id=org and r.branch_id=branch and r.staff_id=v_staff_id
     and (r.valid_until is null or r.valid_until>=since)
     and not exists(select 1 from jsonb_array_elements(segments) e where (e->>'weekday')::integer=r.weekday and (e->>'starts_at')::time=r.starts_at and (e->>'ends_at')::time=r.ends_at and r.valid_until is null and coalesce(r.valid_from,since)<=since)
   loop
     if rule.valid_from>=since then raise exception 'Conflicting same-day/future schedule requires review'; end if;
     -- Final validation below runs after the whole weekly set is installed.
     update public.staff_availability_rules set valid_until=since-1 where id=rule.id and organization_id=org;
     perform app_private.record_audit(org,branch,'1717.weekly_rule_retired','staff_availability_rules',rule.id,
       jsonb_build_object('previous_valid_until',rule.valid_until,'valid_until',since-1),gen_random_uuid());
   end loop;
   for segment in select value from jsonb_array_elements(segments) loop
     if not exists(select 1 from public.staff_availability_rules r where r.organization_id=org and r.branch_id=branch and r.staff_id=v_staff_id
       and r.weekday=(segment->>'weekday')::integer and r.starts_at=(segment->>'starts_at')::time and r.ends_at=(segment->>'ends_at')::time
       and coalesce(r.valid_from,since)<=since and r.valid_until is null) then
       insert into public.staff_availability_rules(organization_id,branch_id,staff_id,weekday,starts_at,ends_at,valid_from)
       values(org,branch,v_staff_id,(segment->>'weekday')::integer,(segment->>'starts_at')::time,(segment->>'ends_at')::time,since);
       perform app_private.record_audit(org,branch,'1717.weekly_rule_created','staff',v_staff_id,segment||jsonb_build_object('valid_from',since),gen_random_uuid());
     end if;
   end loop;
 end loop;
 for appointment in select a.* from public.appointments a where a.organization_id=org and a.staff_id in(esteban,jonatan)
   and a.starts_at>=now() and a.status in('scheduled','confirmed','checked_in','in_service') loop
   if not app_private.effective_availability(org,appointment.branch_id,appointment.staff_id,
       (appointment.starts_at at time zone (select timezone from public.branches where id=appointment.branch_id))::date,false,null) @> appointment.during
   then raise exception 'schedule_conflicts_with_bookings' using errcode='23514'; end if;
 end loop;
 if exists(select 1 from public.finance_settings where organization_id=org and
   (remuneration_model<>'equal_profit_share' or not (profit_share_staff_ids @> array[esteban,jonatan] and cardinality(profit_share_staff_ids)=2))) then
   perform public.finance_command(org,null,'configure_settings',jsonb_build_object('remuneration_model','equal_profit_share','profit_share_staff_ids',array[esteban,jonatan]),gen_random_uuid()); end if;
 -- No distribution policy confirmation: losses/recognition/approval remain open.
 -- No POS rule: effective date/fixed charge/VAT evidence remains open.
end $confirmed$;
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
      "Usage: node scripts/configure-confirmed-1717.mjs verified-options.json output.sql",
    );
  await writeFile(
    destination,
    await confirmed1717Sql(JSON.parse(await readFile(optionsFile, "utf8"))),
    { mode: 0o600 },
  );
  console.log(
    "Prepared reviewable SQL only; no cloud connection or activation performed.",
  );
}
