-- Transactional write boundary: no direct INSERT/UPDATE/DELETE grants for clients.
create function app_private.record_audit(p_org uuid,p_branch uuid,p_action text,p_entity text,p_id uuid,p_metadata jsonb,p_request uuid) returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(organization_id,branch_id,actor_id,action,entity_type,entity_id,metadata,request_id)
 values(p_org,p_branch,app_private.current_profile(),p_action,p_entity,p_id,p_metadata,p_request) $$;
create function app_private.emit_event(p_org uuid,p_branch uuid,p_entity uuid,p_type text,p_payload jsonb,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id) values(p_org,p_branch,p_entity,p_type,p_payload,p_request) returning id into v_id;
 insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload) values(p_org,p_branch,v_id,'in_app_notification',jsonb_build_object('event_type',p_type,'entity_id',p_entity));
 if p_type like 'appointment.%' then
 insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload) values(p_org,p_branch,v_id,'metrics_rebuild',p_payload);
 if p_type in ('appointment.created','appointment.rescheduled','appointment.cancelled') then
 insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload) values(p_org,p_branch,v_id,'booking_notification',jsonb_build_object('appointment_id',p_entity)); end if;
 end if;
 return v_id; end $$;
create function app_private.idempotency_begin(p_org uuid,p_scope text,p_operation text,p_key uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r app_private.idempotency_keys; v_hash text:=md5(p_payload::text); begin
 if p_key is null then raise exception 'idempotency_required' using errcode='22023'; end if;
 insert into app_private.idempotency_keys(organization_id,actor_scope,operation,key,fingerprint) values(p_org,p_scope,p_operation,p_key,v_hash) on conflict do nothing;
 select * into r from app_private.idempotency_keys where organization_id=p_org and actor_scope=p_scope and operation=p_operation and key=p_key for update;
 if r.fingerprint <> v_hash then raise exception 'idempotency_payload_mismatch' using errcode='22023'; end if;
 return r.response; end $$;
create function app_private.idempotency_finish(p_org uuid,p_scope text,p_operation text,p_key uuid,p_response jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 update app_private.idempotency_keys set response=p_response where organization_id=p_org and actor_scope=p_scope and operation=p_operation and key=p_key; return p_response; end $$;
create function app_private.lock_organization(p_org uuid) returns void language sql set search_path='' as $$ select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text,0)) $$;
create function app_private.create_organization(p_name text,p_slug text,p_timezone text,p_currency text,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; begin
 if not app_private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_owner and active) then raise exception 'invalid_owner' using errcode='22023'; end if;
 insert into public.organizations(name,slug,timezone,currency,created_by) values(p_name,p_slug,p_timezone,p_currency,app_private.current_profile()) returning id into v_org;
 insert into public.organization_settings(organization_id) values(v_org);
 insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values(v_org,p_owner,'organization_owner',true);
 perform app_private.record_audit(v_org,null,'organization.created','organizations',v_org,jsonb_build_object('owner_id',p_owner),gen_random_uuid());
 return jsonb_build_object('id',v_org); end $$;
create function app_private.update_organization(p_org uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('name','logo_url','brand_color','timezone','currency','active')) then raise exception 'invalid_fields' using errcode='22023'; end if;
 if p_data ? 'active' and not app_private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 update public.organizations set name=coalesce(p_data->>'name',name),logo_url=case when p_data?'logo_url' then p_data->>'logo_url' else logo_url end,brand_color=coalesce(p_data->>'brand_color',brand_color),timezone=coalesce(p_data->>'timezone',timezone),currency=coalesce(p_data->>'currency',currency),active=coalesce((p_data->>'active')::boolean,active) where id=p_org returning to_jsonb(organizations.*) into v_result;
 perform app_private.record_audit(p_org,null,'organization.updated','organizations',p_org,jsonb_build_object('changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_data) k)),gen_random_uuid());
 return v_result; end $$;
create function app_private.manage_membership(p_org uuid,p_email text,p_role text,p_all_branches boolean,p_branches uuid[],p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid; v_member uuid; v_existing public.organization_memberships; v_branch uuid; v_request uuid:=app_private.request_id(); begin
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_role not in ('organization_owner','manager','receptionist','barber') or p_role is null or p_all_branches is null or p_active is null or cardinality(p_branches)>100 then raise exception 'invalid_membership' using errcode='22023'; end if;
 select u.id into v_profile from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(p_email) and p.active;
 if v_profile is null then raise exception 'account_not_registered' using errcode='22023'; end if;
 perform app_private.lock_organization(p_org);
 select * into v_existing from public.organization_memberships where organization_id=p_org and profile_id=v_profile for update;
 if v_existing.role='organization_owner' and v_existing.active and (p_role<>'organization_owner' or not p_active) and (select count(*) from public.organization_memberships where organization_id=p_org and active and role='organization_owner')<=1 then raise exception 'last_owner_required' using errcode='23514'; end if;
 if exists(select 1 from unnest(coalesce(p_branches,'{}'::uuid[])) b where not exists(select 1 from public.branches where organization_id=p_org and id=b and active)) then raise exception 'invalid_branch' using errcode='23503'; end if;
 if p_role='organization_owner' then p_all_branches:=true; end if;
 if p_role='manager' then p_all_branches:=false; end if;
 insert into public.organization_memberships(organization_id,profile_id,role,all_branches,active) values(p_org,v_profile,p_role,p_all_branches,p_active) on conflict(organization_id,profile_id) do update set role=excluded.role,all_branches=excluded.all_branches,active=excluded.active returning id into v_member;
 delete from public.membership_branch_access where organization_id=p_org and membership_id=v_member;
 foreach v_branch in array coalesce(p_branches,'{}'::uuid[]) loop
 insert into public.membership_branch_access(organization_id,membership_id,branch_id) values(p_org,v_member,v_branch) on conflict do nothing; end loop;
 perform app_private.record_audit(p_org,null,'membership.changed','organization_memberships',v_member,jsonb_build_object('previous_role',v_existing.role,'role',p_role,'active',p_active,'branches',p_branches,'all_branches',p_all_branches),v_request);
 return jsonb_build_object('id',v_member); end $$;
create function app_private.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allow jsonb:='{"organization_settings":["booking_enabled","booking_horizon_days","booking_lead_minutes","slot_step_minutes","default_return_days","retention_due_soon_days","retention_lapsed_days","barber_can_edit_availability"],"branches":["name","slug","address","phone","timezone","active"],"branch_settings":["booking_enabled"],"branch_business_hours":["weekday","opens_at","closes_at"],"branch_closures":["starts_at","ends_at","kind","reason"],"staff":["name","slug","profile_id","active","color"],"staff_branch_assignments":["staff_id","active"],"services":["name","slug","description","default_duration_minutes","active","category","color","composition_mode","base_service_id","suggested_return_days"],"branch_services":["service_id","active","duration_minutes","price_minor"],"staff_service_capabilities":["staff_id","service_id"],"staff_availability_rules":["staff_id","weekday","starts_at","ends_at","valid_from","valid_until"],"staff_availability_exceptions":["staff_id","local_date","starts_at","ends_at","available","reason"],"staff_time_off":["staff_id","starts_at","ends_at","reason"],"customers":["name","normalized_phone","email","birthday","home_branch_id","preferred_staff_id","return_interval_days","followup_after","do_not_contact","archived_at"],"customer_notes":["customer_id","body"],"customer_preferences":["customer_id","key","value"],"customer_tags":["customer_id","tag"],"goals":["staff_id","name","metric","period","target_value","starts_at","ends_at","active"]}'::jsonb; v_fields text[]; v_cols text; v_values text; v_updates text; v_payload jsonb; v_existing jsonb; v_result jsonb; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_branch uuid; v_owner boolean; v_staff uuid; v_customer uuid; v_request uuid:=app_private.request_id(); r record;
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
create function public.create_organization(p_name text,p_slug text,p_timezone text,p_currency text,p_owner uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.create_organization($1,$2,$3,$4,$5) $$;
revoke all on function public.create_organization(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function app_private.create_organization(text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_organization(text,text,text,text,uuid) to authenticated;
grant execute on function app_private.create_organization(text,text,text,text,uuid) to authenticated;
create function public.update_organization(p_org uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.update_organization($1,$2) $$;
revoke all on function public.update_organization(uuid,jsonb) from public,anon,authenticated;
revoke all on function app_private.update_organization(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_organization(uuid,jsonb) to authenticated;
grant execute on function app_private.update_organization(uuid,jsonb) to authenticated;
create function public.manage_membership(p_org uuid,p_email text,p_role text,p_all_branches boolean,p_branches uuid[],p_active boolean) returns jsonb language sql security invoker set search_path='' as $$ select app_private.manage_membership($1,$2,$3,$4,$5,$6) $$;
revoke all on function public.manage_membership(uuid,text,text,boolean,uuid[],boolean) from public,anon,authenticated;
revoke all on function app_private.manage_membership(uuid,text,text,boolean,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.manage_membership(uuid,text,text,boolean,uuid[],boolean) to authenticated;
grant execute on function app_private.manage_membership(uuid,text,text,boolean,uuid[],boolean) to authenticated;
create function public.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.manage_record($1,$2,$3,$4,$5) $$;
revoke all on function public.manage_record(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function app_private.manage_record(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manage_record(uuid,text,uuid,uuid,jsonb) to authenticated;
grant execute on function app_private.manage_record(uuid,text,uuid,uuid,jsonb) to authenticated;
revoke all on function app_private.record_audit(uuid,uuid,text,text,uuid,jsonb,uuid),app_private.emit_event(uuid,uuid,uuid,text,jsonb,uuid),app_private.idempotency_begin(uuid,text,text,uuid,jsonb),app_private.idempotency_finish(uuid,text,text,uuid,jsonb),app_private.lock_organization(uuid) from public,anon,authenticated;
