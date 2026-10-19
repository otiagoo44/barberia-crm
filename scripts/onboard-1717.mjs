import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// An operator runs the generated SQL in the intended project's SQL editor.
// No Auth credentials, global platform privileges or synthetic sales are created.
export async function onboardingSql(ownerEmail) {
  if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(ownerEmail ?? ""))
    throw new Error("Provide the confirmed owner's email.");
  const manifest = JSON.parse(
    await readFile(
      new URL("../config/onboarding/1717.json", import.meta.url),
      "utf8",
    ),
  );
  const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
  return `begin;
do $onboarding$
declare
  owner_id uuid; org_id uuid; branch_id uuid; service_id uuid; staff_id uuid;
  item jsonb; manifest jsonb := ${literal(JSON.stringify(manifest))}::jsonb;
begin
  select u.id into owner_id from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)=lower(${literal(ownerEmail)}) and u.email_confirmed_at is not null and p.active;
  if owner_id is null then raise exception 'Confirmed active owner account required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('onboard:1717-barberia',0));
  select id into org_id from public.organizations where slug='1717-barberia';
  if org_id is not null then
    if not exists(select 1 from public.organization_memberships where organization_id=org_id and profile_id=owner_id and role='organization_owner' and active)
    then raise exception 'Existing organization belongs to another owner; no changes made'; end if;
    raise notice 'Organization already onboarded; existing business configuration preserved';
    return;
  end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.organizations(name,slug,timezone,currency,created_by)
  values(manifest->'organization'->>'name','1717-barberia','America/Asuncion','PYG',owner_id) returning id into org_id;
  insert into public.organization_memberships(organization_id,profile_id,role,all_branches)
  values(org_id,owner_id,'organization_owner',true);
  insert into public.organization_settings(organization_id,booking_enabled) values(org_id,false);
  insert into public.branches(organization_id,name,slug,address,phone,timezone)
  values(org_id,'Luque','luque',manifest->'branch'->>'address','+595983402497','America/Asuncion') returning id into branch_id;
  insert into public.branch_settings(organization_id,branch_id,booking_enabled) values(org_id,branch_id,false);
  insert into public.branch_business_hours(organization_id,branch_id,weekday,opens_at,closes_at)
  select org_id,branch_id,day,'08:00'::time,'21:00'::time from generate_series(1,6) day;
  for item in select value from jsonb_array_elements(manifest->'staff') loop
    insert into public.staff(organization_id,name,slug) values(org_id,item->>'name',item->>'slug') returning id into staff_id;
    insert into public.staff_branch_assignments(organization_id,branch_id,staff_id) values(org_id,branch_id,staff_id);
  end loop;
  -- Unknown durations and staff shifts cannot safely create public availability.
  for item in select value from jsonb_array_elements(manifest->'services') where value->>'duration_minutes' is not null loop
    insert into public.services(organization_id,name,slug,default_duration_minutes,website_category,consultation_required,composition_mode)
    values(org_id,item->>'name',item->>'slug',(item->>'duration_minutes')::integer,item->>'website_category',(item->>'consultation_required')::boolean,'standalone') returning id into service_id;
    insert into public.branch_services(organization_id,branch_id,service_id,price_minor)
    values(org_id,branch_id,service_id,(item->>'price_minor')::bigint);
  end loop;
  -- Owner confirmed both partners provide the entire catalog; shifts are daily.
  insert into public.staff_service_capabilities(organization_id,staff_id,service_id)
  select org_id,s.id,v.id from public.staff s cross join public.services v
  where s.organization_id=org_id and v.organization_id=org_id;
  insert into public.finance_settings(organization_id,advances_deductible,remuneration_model,profit_share_staff_ids)
  select org_id,false,'equal_profit_share',array_agg(id order by id) from public.staff where organization_id=org_id;
  for item in select value from jsonb_array_elements(manifest->'payment_methods') loop
    insert into public.payment_methods(organization_id,name,code,type) values(org_id,item->>'name',item->>'code',item->>'type');
  end loop;
  -- Cash and transfer have no POS charge. Card rates remain unknown until confirmed.
  insert into public.payment_method_fee_rules(organization_id,payment_method_id,percentage_bps,fixed_amount_minor,effective_from,evidence_reference)
  select org_id,id,0,0,now(),'Initial setup: cash/transfer, no card processing' from public.payment_methods where organization_id=org_id and code in ('cash','transfer');
  for item in select value from jsonb_array_elements(manifest->'expense_categories') loop
    insert into public.expense_categories(organization_id,name,code,kind) values(org_id,item->>'name',item->>'code',item->>'kind');
  end loop;
  for item in select value from jsonb_array_elements(manifest->'finance_items') loop
    insert into public.finance_items(organization_id,name,kind,price_minor) values(org_id,item->>'name',item->>'kind',null);
  end loop;
  perform app_private.record_audit(org_id,branch_id,'organization.onboarded','organizations',org_id,
    jsonb_build_object('source','config/onboarding/1717.json','booking_enabled',false,'commission_rules','pending_confirmation'),gen_random_uuid());
end $onboarding$;
commit;
select o.name,o.slug,b.slug as branch,m.role from public.organizations o
join public.branches b on b.organization_id=o.id
join public.organization_memberships m on m.organization_id=o.id
join auth.users u on u.id=m.profile_id where o.slug='1717-barberia' and lower(u.email)=lower(${literal(ownerEmail)});
`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [, , email, destination] = process.argv;
  if (!destination)
    throw new Error(
      "Usage: node scripts/onboard-1717.mjs owner@email output.sql",
    );
  await writeFile(destination, await onboardingSql(email), { mode: 0o600 });
  console.log(
    "Onboarding SQL prepared. Run only in the verified production project.",
  );
}
