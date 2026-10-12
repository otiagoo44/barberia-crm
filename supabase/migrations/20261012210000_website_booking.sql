-- Public website catalog metadata and attribution; no tenant or pricing authority from URL parameters.
alter table public.services add column website_category text check (website_category in ('corte','rulos','tinte','barba','infantil','cejas','lavado'));
alter table public.services add column consultation_required boolean not null default false;
alter table public.services add constraint rulos_consultation_required check (website_category is distinct from 'rulos' or consultation_required);
alter table public.appointments add column booking_attribution text check (booking_attribution='website');
create table app_private.booking_attributions (organization_id uuid not null references public.organizations(id), key uuid not null, attribution text check(attribution='website'), primary key(organization_id,key));
revoke all on app_private.booking_attributions from public,anon,authenticated;
create or replace function app_private.public_catalog(p_secret text,p_slug text,p_branch_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'booking');
 select o.id into v_org from public.organizations o join public.organization_settings os on os.organization_id=o.id where o.slug=p_slug and o.active and os.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select jsonb_build_object('website_booking_version',1,'name',o.name,'slug',o.slug,'logo_url',o.logo_url,'brand_color',o.brand_color,'currency',o.currency,'branches',
 (select coalesce(jsonb_agg(jsonb_build_object('name',b.name,'slug',b.slug,'address',b.address,'phone',b.phone,'timezone',b.timezone,'services',
 (select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'description',s.description,'duration_minutes',coalesce(bs.duration_minutes,s.default_duration_minutes),'composition_mode',s.composition_mode,'base_service_slug',(select slug from public.services where id=s.base_service_id),'price_minor',bs.price_minor,'website_category',s.website_category,'consultation_required',s.consultation_required or coalesce(s.website_category='rulos',false)) order by s.name),'[]'::jsonb) from public.branch_services bs join public.services s on s.organization_id=bs.organization_id and s.id=bs.service_id where bs.organization_id=v_org and bs.branch_id=b.id and bs.active and s.active),
 'staff',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'services',(select coalesce(jsonb_agg(sv.slug),'[]'::jsonb) from public.staff_service_capabilities c join public.services sv on sv.id=c.service_id where c.organization_id=v_org and c.staff_id=s.id)) order by s.name),'[]'::jsonb) from public.staff s join public.staff_branch_assignments sa on sa.organization_id=s.organization_id and sa.staff_id=s.id where s.organization_id=v_org and sa.branch_id=b.id and sa.active and s.active)) order by b.name),'[]'::jsonb) from public.branches b join public.branch_settings bs on bs.organization_id=b.organization_id and bs.branch_id=b.id where b.organization_id=v_org and b.active and bs.booking_enabled and (p_branch_slug is null or b.slug=p_branch_slug))) into v_result from public.organizations o where o.id=v_org;
 return v_result; end $$;
create or replace function app_private.resolve_public_request(p_slug text,p_branch_slug text,p_services text[],p_staff_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_branch uuid; v_staff uuid; v_services uuid[]; begin
 if cardinality(p_services) not between 1 and 12 or length(p_slug)>63 or length(p_branch_slug)>63 then raise exception 'invalid_request' using errcode='22023'; end if;
 select o.id,b.id into v_org,v_branch from public.organizations o join public.organization_settings os on os.organization_id=o.id join public.branches b on b.organization_id=o.id join public.branch_settings bs on bs.organization_id=o.id and bs.branch_id=b.id where o.slug=p_slug and b.slug=p_branch_slug and o.active and b.active and os.booking_enabled and bs.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select array_agg(id order by id) into v_services from public.services where organization_id=v_org and slug=any(p_services) and active;
 if cardinality(v_services) is distinct from cardinality(p_services) then raise exception 'invalid_services' using errcode='22023'; end if;
 if exists(select 1 from public.services where organization_id=v_org and id=any(v_services) and (consultation_required or website_category='rulos')) then raise exception 'consultation_required' using errcode='22023'; end if;
 if p_staff_slug is not null then select id into v_staff from public.staff where organization_id=v_org and slug=p_staff_slug and active; if v_staff is null then raise exception 'invalid_staff' using errcode='22023'; end if; end if;
 return jsonb_build_object('organization_id',v_org,'branch_id',v_branch,'staff_id',v_staff,'services',to_jsonb(v_services)); end $$;
create or replace function app_private.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allow jsonb:='{"organization_settings":["booking_enabled","booking_horizon_days","booking_lead_minutes","slot_step_minutes","default_return_days","retention_due_soon_days","retention_lapsed_days","barber_can_edit_availability"],"branches":["name","slug","address","phone","timezone","active"],"branch_settings":["booking_enabled"],"branch_business_hours":["weekday","opens_at","closes_at"],"branch_closures":["starts_at","ends_at","kind","reason"],"staff":["name","slug","profile_id","active","color"],"staff_branch_assignments":["staff_id","active"],"services":["name","slug","description","default_duration_minutes","active","category","color","composition_mode","base_service_id","suggested_return_days","requires_maintenance","website_category","consultation_required"],"branch_services":["service_id","active","duration_minutes","price_minor"],"staff_service_capabilities":["staff_id","service_id"],"staff_availability_rules":["staff_id","weekday","starts_at","ends_at","valid_from","valid_until"],"staff_availability_exceptions":["staff_id","local_date","starts_at","ends_at","available","reason"],"staff_time_off":["staff_id","starts_at","ends_at","reason"],"customers":["name","normalized_phone","email","birthday","home_branch_id","preferred_staff_id","return_interval_days","followup_after","do_not_contact","archived_at"],"customer_notes":["customer_id","body"],"customer_preferences":["customer_id","key","value"],"customer_tags":["customer_id","tag"],"goals":["staff_id","name","metric","period","target_value","starts_at","ends_at","active"]}'::jsonb; v_fields text[]; v_cols text; v_values text; v_updates text; v_payload jsonb; v_existing jsonb; v_result jsonb; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_branch uuid; v_owner boolean; v_staff uuid; v_customer uuid; v_goal_tz text; v_request uuid:=app_private.request_id(); r record;
begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501'; end if;
 if not v_allow ? p_entity or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>8192 or p_data='{}'::jsonb then raise exception 'invalid_payload' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where not (v_allow->p_entity) ? k) then raise exception 'invalid_fields' using errcode='22023'; end if;
 perform app_private.lock_organization(p_org);
 if p_id is not null then
 execute format('select to_jsonb(t.*) from public.%I t where id=$1 and organization_id=$2 for update',p_entity) into v_existing using p_id,p_org;
 if v_existing is null then raise exception 'not_found' using errcode='P0002'; end if;
 end if;
 v_branch:=coalesce((v_existing->>'branch_id')::uuid,p_branch);
 if v_existing ? 'branch_id' and (v_existing->>'branch_id')::uuid is distinct from p_branch then raise exception 'branch_immutable' using errcode='23514'; end if;
 if p_entity='branches' then v_branch:=v_id; end if;
 v_staff:=coalesce((p_data->>'staff_id')::uuid,(v_existing->>'staff_id')::uuid);
 if p_data->>'active'='false' and p_entity in ('staff','branches','staff_branch_assignments') and exists(select 1 from public.appointments a where a.organization_id=p_org and a.ends_at>now() and a.status in ('scheduled','confirmed','checked_in','in_service') and (p_entity<>'staff' or a.staff_id=v_id) and (p_entity<>'branches' or a.branch_id=v_id) and (p_entity<>'staff_branch_assignments' or (a.branch_id=v_branch and a.staff_id=v_staff))) then raise exception 'future_bookings_must_be_reassigned' using errcode='23514'; end if;
 if p_entity='goals' then select coalesce((select timezone from public.branches where id=v_branch),o.timezone) into v_goal_tz from public.organizations o where id=p_org; if (p_data->>'starts_at')::timestamptz at time zone v_goal_tz <> date_trunc('day',(p_data->>'starts_at')::timestamptz at time zone v_goal_tz) or (p_data->>'ends_at')::timestamptz at time zone v_goal_tz <> date_trunc('day',(p_data->>'ends_at')::timestamptz at time zone v_goal_tz) then raise exception 'goal_requires_whole_local_days' using errcode='23514'; end if; end if;
 if p_entity='goals' and ((p_data->>'ends_at')::timestamptz-(p_data->>'starts_at')::timestamptz)>interval '366 days' then raise exception 'goal_period_too_long' using errcode='22023'; end if;
 v_owner:=app_private.has_org_role(p_org,array['organization_owner']);
 v_staff:=coalesce((p_data->>'staff_id')::uuid,(v_existing->>'staff_id')::uuid);
 v_customer:=coalesce((p_data->>'customer_id')::uuid,(v_existing->>'customer_id')::uuid);
 if p_entity in ('organization_settings','staff','services','staff_service_capabilities') then
  if not v_owner then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity='branches' then
  if not v_owner and (p_id is null or not app_private.has_org_role(p_org,array['manager']) or not app_private.can_access_branch(p_org,p_id) or p_data ? 'active') then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity in ('customers','customer_notes','customer_preferences','customer_tags') then
  if not v_owner and not app_private.can_operate_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_entity='customers' then
   if p_id is not null and not app_private.can_read_customer(p_org,p_id) then raise exception 'forbidden' using errcode='42501'; end if;
   if not v_owner then
    if p_id is null and not p_data?'home_branch_id' then p_data:=p_data||jsonb_build_object('home_branch_id',p_branch); end if;
    if p_data?'home_branch_id' and not app_private.can_access_branch(p_org,(p_data->>'home_branch_id')::uuid) then raise exception 'forbidden' using errcode='42501'; end if;
   end if;
  elsif not app_private.can_read_customer(p_org,v_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity in ('staff_availability_rules','staff_availability_exceptions','staff_time_off') then
  if not v_owner and not (app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,v_branch)) and not (v_staff=app_private.current_staff_id(p_org) and app_private.can_access_branch(p_org,v_branch) and exists(select 1 from public.organization_settings where organization_id=p_org and barber_can_edit_availability)) then raise exception 'forbidden' using errcode='42501'; end if;
  if not app_private.can_read_staff(p_org,v_staff) then raise exception 'forbidden' using errcode='42501'; end if;
 else
  if not v_owner and not (app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,v_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 end if;
 if p_entity='staff_branch_assignments' and not v_owner and not app_private.can_read_staff(p_org,v_staff) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_entity='staff' and p_data->>'profile_id' is not null and not exists(select 1 from public.organization_memberships where organization_id=p_org and profile_id=(p_data->>'profile_id')::uuid and role='barber' and active) then raise exception 'staff_account_must_be_barber_member' using errcode='23514'; end if;
 v_payload:=p_data||jsonb_build_object('id',v_id,'organization_id',p_org);
 if p_entity in ('branch_settings','branch_business_hours','branch_closures','staff_branch_assignments','branch_services','staff_availability_rules','staff_availability_exceptions','staff_time_off','customer_notes','goals') then v_payload:=v_payload||jsonb_build_object('branch_id',v_branch); end if;
 select array_agg(k order by k) into v_fields from jsonb_object_keys(v_payload) k;
 select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into v_cols,v_values from unnest(v_fields) k;
 if p_id is null then
 execute format('insert into public.%I as target (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(target.*)',p_entity,v_cols,v_values,p_entity) into v_result using v_payload;
 else
 select string_agg(format('%I=r.%I',k,k),',') into v_updates from jsonb_object_keys(p_data) k;
 execute format('update public.%I as target set %s from jsonb_populate_record(null::public.%I,$1) r where target.id=$2 and target.organization_id=$3 returning to_jsonb(target.*)',p_entity,v_updates,p_entity) into v_result using v_payload,v_id,p_org;
 end if;
 if p_entity='branches' and p_id is null then insert into public.branch_settings(organization_id,branch_id) values(p_org,v_id); end if;
 if p_entity in ('branch_business_hours','branch_closures','staff_availability_rules','staff_availability_exceptions','staff_time_off') then
 for r in select a.* from public.appointments a where a.organization_id=p_org and a.starts_at>=now() and a.status in ('scheduled','confirmed','checked_in','in_service') and (v_branch is null or a.branch_id=v_branch) and (v_staff is null or a.staff_id=v_staff) loop
  if not app_private.effective_availability(p_org,r.branch_id,r.staff_id,(r.starts_at at time zone (select timezone from public.branches where id=r.branch_id))::date,false,null) @> r.during then raise exception 'schedule_conflicts_with_bookings' using errcode='23514'; end if;
 end loop; end if;
 perform app_private.record_audit(p_org,v_branch,p_entity||case when p_id is null then '.created' else '.updated' end,p_entity,v_id,jsonb_build_object('changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_data) k)),v_request);
 if p_entity='customers' and p_id is null then perform app_private.emit_event(p_org,p_branch,v_id,'customer.created','{}',v_request); end if;
 if p_entity in ('staff_availability_rules','staff_availability_exceptions','staff_time_off') then perform app_private.emit_event(p_org,v_branch,v_staff,'staff.availability_changed','{}',v_request); end if;
 return v_result;
end $$;

-- Preserve the original engine and its source='public' security checks.
alter function app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text) rename to public_booking_unattributed;
revoke all on function app_private.public_booking_unattributed(text,text,text,text[],text,timestamptz,jsonb,uuid,text) from public,anon,authenticated;
create function app_private.public_booking(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_start timestamptz,p_customer_data jsonb,p_key uuid,p_honeypot text,p_attribution text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; v_result jsonb; v_org uuid; v_saved text; v_id uuid; begin
 perform app_private.check_gateway(p_secret,'booking');
 if p_attribution is not null and p_attribution<>'website' then raise exception 'invalid_attribution' using errcode='22023'; end if;
 r:=app_private.resolve_public_request(p_slug,p_branch_slug,p_services,p_staff_slug); v_org:=(r->>'organization_id')::uuid;
 perform app_private.lock_organization(v_org);
 insert into app_private.booking_attributions(organization_id,key,attribution) values(v_org,p_key,p_attribution) on conflict do nothing;
 select attribution into v_saved from app_private.booking_attributions where organization_id=v_org and key=p_key;
 if v_saved is distinct from p_attribution then raise exception 'idempotency_conflict' using errcode='22023'; end if;
 v_result:=app_private.public_booking_unattributed(p_secret,p_slug,p_branch_slug,p_services,p_staff_slug,p_start,p_customer_data,p_key,p_honeypot);
 if p_attribution is not null then
  update public.appointments set booking_attribution=p_attribution where organization_id=v_org and public_reference=(v_result->>'reference')::uuid and booking_attribution is null returning id into v_id;
  if v_id is not null then
   perform app_private.emit_event(v_org,(r->>'branch_id')::uuid,v_id,'booking.attributed',jsonb_build_object('attribution',p_attribution),app_private.request_id());
   perform app_private.record_audit(v_org,(r->>'branch_id')::uuid,'appointment.attributed','appointments',v_id,jsonb_build_object('attribution',p_attribution),app_private.request_id());
  end if;
 end if;
 return v_result; end $$;
create function app_private.public_booking(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_start timestamptz,p_customer_data jsonb,p_key uuid,p_honeypot text) returns jsonb language sql security definer set search_path='' as $$ select app_private.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,null) $$;
create function public.public_booking(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_start timestamptz,p_customer_data jsonb,p_key uuid,p_honeypot text,p_attribution text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) $$;
revoke all on function app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text),app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text,text),public.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text),app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text,text),public.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text,text) to anon;
