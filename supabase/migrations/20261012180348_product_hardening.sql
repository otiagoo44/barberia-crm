-- Small product hardening layer; source summaries stay recalculable from completed appointments.
create function app_private.request_id() returns uuid language plpgsql set search_path='' as $$
declare v text; begin v:=current_setting('request.headers',true)::jsonb->>'x-request-id';
 if v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return v::uuid; end if; return gen_random_uuid(); end $$;
revoke all on function app_private.request_id() from public,anon,authenticated;
alter table public.services add column requires_maintenance boolean not null default false;
create table public.customer_service_returns(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),customer_id uuid not null,service_id uuid not null,branch_id uuid not null,last_visit_at timestamptz not null,expected_return_at timestamptz not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id),unique(organization_id,id),unique(organization_id,customer_id,service_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),foreign key(organization_id,service_id) references public.services(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create index service_returns_due_idx on public.customer_service_returns(organization_id,expected_return_at,id);
create index service_returns_service_idx on public.customer_service_returns(organization_id,service_id);
create index service_returns_branch_idx on public.customer_service_returns(organization_id,branch_id);
alter table public.customer_service_returns enable row level security;
revoke all on public.customer_service_returns from public,anon,authenticated;
grant select on public.customer_service_returns to authenticated;
create policy service_returns_read on public.customer_service_returns for select to authenticated using(app_private.can_read_customer(organization_id,customer_id) and app_private.can_access_branch(organization_id,branch_id));
create trigger protect_record before insert or update on public.customer_service_returns for each row execute function app_private.touch_and_protect_tenant();
create table public.daily_customer_activity(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),branch_id uuid not null,staff_id uuid not null,customer_id uuid not null,local_date date not null,returning_customer boolean not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id),unique(organization_id,id),unique(organization_id,branch_id,staff_id,customer_id,local_date),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),foreign key(organization_id,staff_id) references public.staff(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create index customer_activity_period_idx on public.daily_customer_activity(organization_id,local_date,branch_id,staff_id);
create index customer_activity_customer_idx on public.daily_customer_activity(organization_id,customer_id);
create index customer_activity_branch_idx on public.daily_customer_activity(organization_id,branch_id);
create index customer_activity_staff_idx on public.daily_customer_activity(organization_id,staff_id);
create index customers_created_idx on public.customers(organization_id,created_at,id);
alter table public.daily_customer_activity enable row level security;
revoke all on public.daily_customer_activity from public,anon,authenticated;
grant select on public.daily_customer_activity to authenticated;
create policy customer_activity_read on public.daily_customer_activity for select to authenticated using(app_private.can_access_branch(organization_id,branch_id) and app_private.can_read_staff(organization_id,staff_id));
create trigger protect_record before insert or update on public.daily_customer_activity for each row execute function app_private.touch_and_protect_tenant();
create function app_private.estimate_return_days(p_org uuid,p_customer uuid,p_appointment uuid) returns integer language plpgsql stable security definer set search_path='' as $$
declare v_days integer; begin
 select return_interval_days into v_days from public.customers where organization_id=p_org and id=p_customer;
 if v_days is not null then return v_days; end if;
 select min(s.suggested_return_days) into v_days from public.appointment_services aps join public.services s on s.organization_id=aps.organization_id and s.id=aps.service_id where aps.organization_id=p_org and aps.appointment_id=p_appointment and aps.composition_mode in ('standalone','override') and aps.duration_minutes>0;
 if v_days is not null then return v_days; end if;
 with recent as (select completed_at from public.appointments where organization_id=p_org and customer_id=p_customer and status='completed' order by completed_at desc limit 8), gaps as (select extract(epoch from completed_at-lag(completed_at) over(order by completed_at))/86400 as days from recent)
 select round(percentile_cont(0.5) within group(order by days))::integer into v_days from gaps where days between 1 and 365 having count(*)>=2;
 if v_days is not null then return v_days; end if;
 select default_return_days into v_days from public.organization_settings where organization_id=p_org;return v_days; end $$;
create function app_private.refresh_service_returns(p_org uuid,p_appointment uuid) returns void language sql security definer set search_path='' as $$
 insert into public.customer_service_returns(organization_id,customer_id,service_id,branch_id,last_visit_at,expected_return_at)
 select p_org,a.customer_id,s.id,a.branch_id,a.completed_at,a.completed_at+make_interval(days=>s.suggested_return_days)
 from public.appointments a join public.appointment_services aps on aps.organization_id=a.organization_id and aps.appointment_id=a.id join public.services s on s.organization_id=aps.organization_id and s.id=aps.service_id
 where a.organization_id=p_org and a.id=p_appointment and a.status='completed' and s.requires_maintenance and s.suggested_return_days is not null and aps.duration_minutes>0
 on conflict(organization_id,customer_id,service_id) do update set branch_id=excluded.branch_id,last_visit_at=excluded.last_visit_at,expected_return_at=excluded.expected_return_at $$;
revoke all on function app_private.estimate_return_days(uuid,uuid,uuid),app_private.refresh_service_returns(uuid,uuid) from public,anon,authenticated;
create function app_private.membership_directory(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select m.id,m.profile_id,m.role,m.active,m.all_branches,m.created_at,p.full_name as profile_name,u.email,(select coalesce(jsonb_agg(a.branch_id),'[]'::jsonb) from public.membership_branch_access a where a.membership_id=m.id) branches from public.organization_memberships m join public.profiles p on p.id=m.profile_id join auth.users u on u.id=p.id where m.organization_id=p_org order by m.created_at desc,m.id desc limit 100) q),'has_more',false);
end $$;
create function app_private.maintenance_due(p_org uuid,p_branch uuid,p_cursor jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.has_org_role(p_org,array['organization_owner','manager','receptionist']) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 with page as(select r.id,r.customer_id,r.service_id,r.expected_return_at,c.name,c.normalized_phone,s.name as service_name from public.customer_service_returns r join public.customers c on c.organization_id=r.organization_id and c.id=r.customer_id join public.services s on s.id=r.service_id join public.organization_settings os on os.organization_id=r.organization_id
 where r.organization_id=p_org and (p_branch is null or r.branch_id=p_branch) and r.expected_return_at<=now()+make_interval(days=>os.retention_due_soon_days) and c.archived_at is null and not c.do_not_contact and (c.followup_after is null or c.followup_after<=now()) and app_private.can_read_customer(p_org,c.id) and app_private.can_access_branch(p_org,r.branch_id) and (p_cursor is null or (r.expected_return_at,r.id)>((p_cursor->>'expected_return_at')::timestamptz,(p_cursor->>'id')::uuid)) order by r.expected_return_at,r.id limit 51)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(q) order by expected_return_at,id) from(select * from page limit 50)q),'[]'::jsonb),'has_more',(select count(*)>50 from page),'next_cursor',(select jsonb_build_object('id',id,'expected_return_at',expected_return_at) from page offset 49 limit 1)) into v_result;return v_result;end $$;
create function app_private.gateway_health(p_secret text) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin perform app_private.check_gateway(p_secret,'booking'); return jsonb_build_object('ready',to_regclass('public.appointments') is not null and to_regclass('public.customer_service_returns') is not null);end $$;
create or replace function app_private.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allow jsonb:='{"organization_settings":["booking_enabled","booking_horizon_days","booking_lead_minutes","slot_step_minutes","default_return_days","retention_due_soon_days","retention_lapsed_days","barber_can_edit_availability"],"branches":["name","slug","address","phone","timezone","active"],"branch_settings":["booking_enabled"],"branch_business_hours":["weekday","opens_at","closes_at"],"branch_closures":["starts_at","ends_at","kind","reason"],"staff":["name","slug","profile_id","active","color"],"staff_branch_assignments":["staff_id","active"],"services":["name","slug","description","default_duration_minutes","active","category","color","composition_mode","base_service_id","suggested_return_days","requires_maintenance"],"branch_services":["service_id","active","duration_minutes","price_minor"],"staff_service_capabilities":["staff_id","service_id"],"staff_availability_rules":["staff_id","weekday","starts_at","ends_at","valid_from","valid_until"],"staff_availability_exceptions":["staff_id","local_date","starts_at","ends_at","available","reason"],"staff_time_off":["staff_id","starts_at","ends_at","reason"],"customers":["name","normalized_phone","email","birthday","home_branch_id","preferred_staff_id","return_interval_days","followup_after","do_not_contact","archived_at"],"customer_notes":["customer_id","body"],"customer_preferences":["customer_id","key","value"],"customer_tags":["customer_id","tag"],"goals":["staff_id","name","metric","period","target_value","starts_at","ends_at","active"]}'::jsonb; v_fields text[]; v_cols text; v_values text; v_updates text; v_payload jsonb; v_existing jsonb; v_result jsonb; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_branch uuid; v_owner boolean; v_staff uuid; v_customer uuid; v_goal_tz text; v_request uuid:=app_private.request_id(); r record;
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
create or replace function app_private.transition_booking(p_org uuid,p_id uuid,p_status text,p_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; v_result jsonb; v_request uuid:=app_private.request_id(); v_days integer; v_tz text; begin
 if not app_private.can_read_appointment(p_org,p_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 select * into a from public.appointments where organization_id=p_org and id=p_id for update;
 if not app_private.can_operate_branch(p_org,a.branch_id) and not (a.staff_id=app_private.current_staff_id(p_org) and p_status in ('checked_in','in_service','completed')) then raise exception 'forbidden' using errcode='42501'; end if;
 v_result:=app_private.idempotency_begin(p_org,app_private.current_profile()::text,'transition',p_key,jsonb_build_object('id',p_id,'status',p_status,'reason',p_reason));
 if v_result is not null then return v_result; end if;
 if not ((a.status='scheduled' and p_status in ('confirmed','checked_in','cancelled','no_show')) or (a.status='confirmed' and p_status in ('checked_in','cancelled','no_show')) or (a.status='checked_in' and p_status in ('in_service','cancelled')) or (a.status='in_service' and p_status='completed')) then raise exception 'invalid_transition' using errcode='23514'; end if;
 if p_status='no_show' and a.starts_at>now() then raise exception 'no_show_before_start' using errcode='23514'; end if;
 if p_status in ('checked_in','in_service','completed') and a.starts_at>now()+interval '30 minutes' then raise exception 'service_not_due' using errcode='23514'; end if;
 update public.appointments set status=p_status,checked_in_at=case when p_status='checked_in' then now() else checked_in_at end,started_at=case when p_status='in_service' then now() else started_at end,completed_at=case when p_status='completed' then now() else completed_at end,cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,cancellation_reason=case when p_status='cancelled' then p_reason else cancellation_reason end where id=p_id returning to_jsonb(appointments.*) into v_result;
 insert into public.appointment_status_history(organization_id,branch_id,appointment_id,from_status,to_status,request_id) values(p_org,a.branch_id,p_id,a.status,p_status,v_request);
 if p_status='completed' then
 v_days:=app_private.estimate_return_days(p_org,a.customer_id,p_id);
 perform app_private.refresh_service_returns(p_org,p_id);
 update public.customers set expected_return_at=case when v_days is null then null else now()+make_interval(days=>v_days) end,followup_after=null where id=a.customer_id and organization_id=p_org;
 end if;
 update public.walk_in_entries set status=case p_status when 'checked_in' then 'assigned' when 'in_service' then 'in_service' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else status end where organization_id=p_org and appointment_id=p_id;
 select timezone into v_tz from public.branches where id=a.branch_id;
 perform app_private.record_audit(p_org,a.branch_id,'appointment.'||p_status,'appointments',p_id,jsonb_build_object('from',a.status,'to',p_status),v_request);
 perform app_private.emit_event(p_org,a.branch_id,p_id,'appointment.'||p_status,jsonb_build_object('local_dates',jsonb_build_array((a.starts_at at time zone v_tz)::date)),v_request);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'transition',p_key,v_result); end $$;
create or replace function app_private.create_booking(p_org uuid,p_branch uuid,p_services uuid[],p_staff uuid,p_start timestamptz,p_customer uuid,p_customer_data jsonb,p_key uuid,p_rebooked_from uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not app_private.can_operate_branch(p_org,p_branch) and not (p_rebooked_from is not null and p_customer is not null and p_customer_data is null and p_staff=app_private.current_staff_id(p_org) and app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_customer is not null and not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 return app_private.create_booking_internal(p_org,p_branch,p_services,p_staff,p_start,p_customer,p_customer_data,p_key,case when p_rebooked_from is null then 'internal' else 'rebooking' end,p_rebooked_from,app_private.current_profile()::text); end $$;
create or replace function app_private.update_organization(p_org uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('name','logo_url','brand_color','timezone','currency','active')) then raise exception 'invalid_fields' using errcode='22023'; end if;
 if p_data ? 'active' and not app_private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 if p_data?'currency' and p_data->>'currency'<>(select currency from public.organizations where id=p_org) and (exists(select 1 from public.appointments where organization_id=p_org and price_minor is not null) or exists(select 1 from public.branch_services where organization_id=p_org and price_minor is not null)) then raise exception 'currency_locked_after_pricing' using errcode='23514'; end if;
 update public.organizations set name=coalesce(p_data->>'name',name),logo_url=case when p_data?'logo_url' then p_data->>'logo_url' else logo_url end,brand_color=coalesce(p_data->>'brand_color',brand_color),timezone=coalesce(p_data->>'timezone',timezone),currency=coalesce(p_data->>'currency',currency),active=coalesce((p_data->>'active')::boolean,active) where id=p_org returning to_jsonb(organizations.*) into v_result;
 perform app_private.record_audit(p_org,null,'organization.updated','organizations',p_org,jsonb_build_object('changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_data) k)),gen_random_uuid());
 return v_result; end $$;
create or replace function app_private.reschedule_booking(p_org uuid,p_id uuid,p_branch uuid,p_staff uuid,p_start timestamptz,p_services uuid[],p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; v_plan jsonb; v_staff uuid; v_result jsonb; v_request uuid:=app_private.request_id(); v_item jsonb; v_old_services jsonb; v_tz text; v_old_tz text; begin
 if not app_private.can_read_appointment(p_org,p_id) or not app_private.can_operate_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 select * into a from public.appointments where organization_id=p_org and id=p_id for update;
 if not app_private.can_operate_branch(p_org,a.branch_id) then raise exception 'forbidden' using errcode='42501'; end if;
 v_result:=app_private.idempotency_begin(p_org,app_private.current_profile()::text,'reschedule',p_key,jsonb_build_object('id',p_id,'branch',p_branch,'staff',p_staff,'start',p_start,'services',p_services));
 if v_result is not null then return v_result; end if;
 if a.status not in ('scheduled','confirmed') or p_start<now() or p_start>now()+make_interval(days=>(select booking_horizon_days from public.organization_settings where organization_id=p_org)) then raise exception 'invalid_transition' using errcode='23514'; end if;
 v_plan:=app_private.service_plan(p_org,p_branch,p_services);
 v_staff:=app_private.compatible_staff(p_org,p_branch,p_services,p_start,p_staff,p_id);
 select timezone into v_tz from public.branches where id=p_branch;
 select timezone into v_old_tz from public.branches where id=a.branch_id;
 update public.appointments set branch_id=p_branch,staff_id=v_staff,starts_at=p_start,ends_at=p_start+make_interval(mins=>(v_plan->>'duration_minutes')::integer),duration_minutes=(v_plan->>'duration_minutes')::integer,price_minor=(v_plan->>'price_minor')::bigint,status='scheduled' where id=p_id returning to_jsonb(appointments.*) into v_result;
 select jsonb_agg(jsonb_build_object('id',service_id,'name',name_snapshot,'duration_minutes',duration_minutes,'price_minor',price_minor)) into v_old_services from public.appointment_services where organization_id=p_org and appointment_id=p_id;
 delete from public.appointment_services where organization_id=p_org and appointment_id=p_id;
 for v_item in select value from jsonb_array_elements(v_plan->'items') loop
 insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) values(p_org,p_id,(v_item->>'id')::uuid,v_item->>'name',(v_item->>'duration_minutes')::integer,(v_item->>'price_minor')::bigint,v_item->>'composition_mode'); end loop;
 insert into public.appointment_status_history(organization_id,branch_id,appointment_id,from_status,to_status,metadata,request_id) values(p_org,p_branch,p_id,a.status,'rescheduled',jsonb_build_object('previous_start',a.starts_at,'previous_end',a.ends_at,'previous_staff_id',a.staff_id,'previous_branch_id',a.branch_id,'previous_services',v_old_services),v_request),(p_org,p_branch,p_id,'rescheduled','scheduled','{}',v_request);
 perform app_private.record_audit(p_org,p_branch,'appointment.rescheduled','appointments',p_id,jsonb_build_object('previous_start',a.starts_at,'starts_at',p_start,'previous_branch',a.branch_id,'branch',p_branch),v_request);
 perform app_private.emit_event(p_org,p_branch,p_id,'appointment.rescheduled',jsonb_build_object('local_dates',jsonb_build_array((p_start at time zone v_tz)::date),'previous_branch',a.branch_id,'previous_date',(a.starts_at at time zone v_old_tz)::date),v_request);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'reschedule',p_key,v_result); end $$;
create or replace function app_private.create_booking_internal(p_org uuid,p_branch uuid,p_services uuid[],p_staff uuid,p_start timestamptz,p_customer uuid,p_customer_data jsonb,p_key uuid,p_source text,p_rebooked_from uuid,p_scope text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_plan jsonb; v_staff uuid; v_customer uuid; v_id uuid; v_result jsonb; v_request uuid:=app_private.request_id(); v_tz text; v_settings public.organization_settings; v_currency text; v_item jsonb; begin
 perform app_private.lock_organization(p_org);
 v_result:=app_private.idempotency_begin(p_org,p_scope,'create_booking',p_key,jsonb_build_object('branch',p_branch,'services',p_services,'staff',p_staff,'start',p_start,'customer',p_customer,'customer_data',p_customer_data,'source',p_source,'rebooked_from',p_rebooked_from));
 if v_result is not null then return v_result; end if;
 select timezone into v_tz from public.branches where organization_id=p_org and id=p_branch and active;
 select * into v_settings from public.organization_settings where organization_id=p_org;
 select currency into v_currency from public.organizations where id=p_org and active;
 if v_tz is null or v_currency is null or p_start is null or p_start>now()+make_interval(days=>v_settings.booking_horizon_days) or p_start<now()-interval '5 minutes' then raise exception 'invalid_booking_time' using errcode='22023'; end if;
 if p_source='public' and (not v_settings.booking_enabled or not exists(select 1 from public.branch_settings where organization_id=p_org and branch_id=p_branch and booking_enabled) or p_start<now()+make_interval(mins=>v_settings.booking_lead_minutes)) then raise exception 'public_booking_unavailable' using errcode='22023'; end if;
 v_plan:=app_private.service_plan(p_org,p_branch,p_services);
 v_staff:=app_private.compatible_staff(p_org,p_branch,p_services,p_start,p_staff,null);
 if p_customer is not null then
 select id into v_customer from public.customers where organization_id=p_org and id=p_customer and archived_at is null;
 else
 if p_customer_data is null or jsonb_typeof(p_customer_data)<>'object' or octet_length(p_customer_data::text)>2048 or exists(select 1 from jsonb_object_keys(p_customer_data) k where k not in ('name','normalized_phone','email')) then raise exception 'invalid_customer' using errcode='22023'; end if;
 -- Existing customer contact is never overwritten by an unauthenticated booking.
 insert into public.customers(organization_id,name,normalized_phone,email,home_branch_id) values(p_org,p_customer_data->>'name',p_customer_data->>'normalized_phone',nullif(p_customer_data->>'email',''),p_branch) on conflict(organization_id,normalized_phone) do nothing returning id into v_customer;
 if v_customer is null then select id into v_customer from public.customers where organization_id=p_org and normalized_phone=p_customer_data->>'normalized_phone' and archived_at is null;
 else perform app_private.emit_event(p_org,p_branch,v_customer,'customer.created','{}',v_request); end if;
 end if;
 if v_customer is null then raise exception 'invalid_customer' using errcode='22023'; end if;
 if p_rebooked_from is not null and not exists(select 1 from public.appointments where organization_id=p_org and id=p_rebooked_from and customer_id=v_customer and status='completed') then raise exception 'invalid_rebooking' using errcode='22023'; end if;
 insert into public.appointments(organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,price_minor,currency,source,rebooked_from_id)
 values(p_org,p_branch,v_customer,v_staff,p_start,p_start+make_interval(mins=>(v_plan->>'duration_minutes')::integer),(v_plan->>'duration_minutes')::integer,(v_plan->>'price_minor')::bigint,v_currency,p_source,p_rebooked_from) returning id into v_id;
 for v_item in select value from jsonb_array_elements(v_plan->'items') loop
 insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) values(p_org,v_id,(v_item->>'id')::uuid,v_item->>'name',(v_item->>'duration_minutes')::integer,(v_item->>'price_minor')::bigint,v_item->>'composition_mode'); end loop;
 insert into public.appointment_status_history(organization_id,branch_id,appointment_id,to_status,request_id) values(p_org,p_branch,v_id,'scheduled',v_request);
 perform app_private.record_audit(p_org,p_branch,'appointment.created','appointments',v_id,jsonb_build_object('source',p_source),v_request);
 perform app_private.emit_event(p_org,p_branch,v_id,'appointment.created',jsonb_build_object('local_dates',jsonb_build_array((p_start at time zone v_tz)::date))||case when p_rebooked_from is null then '{}'::jsonb else (select jsonb_build_object('rebooking_branch',a.branch_id,'rebooking_date',(a.starts_at at time zone b.timezone)::date) from public.appointments a join public.branches b on b.id=a.branch_id where a.id=p_rebooked_from) end,v_request);
 select jsonb_build_object('id',id,'reference',public_reference,'staff_id',staff_id,'starts_at',starts_at,'ends_at',ends_at,'duration_minutes',duration_minutes) into v_result from public.appointments where id=v_id;
 return app_private.idempotency_finish(p_org,p_scope,'create_booking',p_key,v_result); end $$;
create or replace function app_private.rebuild_metric_day(p_org uuid,p_branch uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare r record; m jsonb; v_tz text; begin
 perform app_private.lock_organization(p_org);
 select timezone into v_tz from public.branches where organization_id=p_org and id=p_branch;
 if v_tz is null then raise exception 'invalid_branch' using errcode='22023'; end if;
 for r in select staff_id from public.staff_branch_assignments where organization_id=p_org and branch_id=p_branch union select staff_id from public.appointments where organization_id=p_org and branch_id=p_branch and starts_at>=p_date::timestamp at time zone v_tz and starts_at<(p_date+1)::timestamp at time zone v_tz loop
 if p_date>=(now() at time zone v_tz)::date then insert into public.capacity_snapshots(organization_id,branch_id,staff_id,local_date,available_intervals) values(p_org,p_branch,r.staff_id,p_date,app_private.effective_availability(p_org,p_branch,r.staff_id,p_date,false,null)); end if;
 m:=app_private.compute_metric_day(p_org,p_branch,r.staff_id,p_date);
 insert into public.daily_metrics(organization_id,branch_id,staff_id,local_date,appointments_count,completed_count,services_completed,cancelled_count,no_show_count,booked_minutes,completed_minutes,available_minutes,priced_completed_count,production_value_minor,rebookings_count)
 values(p_org,p_branch,r.staff_id,p_date,(m->>'appointments_count')::integer,(m->>'completed_count')::integer,(m->>'services_completed')::integer,(m->>'cancelled_count')::integer,(m->>'no_show_count')::integer,(m->>'booked_minutes')::integer,(m->>'completed_minutes')::integer,(m->>'available_minutes')::integer,(m->>'priced_completed_count')::integer,(m->>'production_value_minor')::bigint,(m->>'rebookings_count')::integer)
 on conflict(organization_id,branch_id,staff_id,local_date) do update set appointments_count=excluded.appointments_count,completed_count=excluded.completed_count,services_completed=excluded.services_completed,cancelled_count=excluded.cancelled_count,no_show_count=excluded.no_show_count,booked_minutes=excluded.booked_minutes,completed_minutes=excluded.completed_minutes,available_minutes=excluded.available_minutes,priced_completed_count=excluded.priced_completed_count,production_value_minor=excluded.production_value_minor,rebookings_count=excluded.rebookings_count;
 end loop;
 delete from public.daily_service_metrics where organization_id=p_org and branch_id=p_branch and local_date=p_date;
 insert into public.daily_service_metrics(organization_id,branch_id,staff_id,service_id,local_date,completed_count,production_value_minor,priced_completed_count)
 select p_org,p_branch,a.staff_id,s.service_id,p_date,count(*),coalesce(sum(s.price_minor),0),count(*) filter(where s.price_minor is not null) from public.appointments a join public.appointment_services s on s.organization_id=a.organization_id and s.appointment_id=a.id where a.organization_id=p_org and a.branch_id=p_branch and a.status='completed' and a.starts_at>=p_date::timestamp at time zone v_tz and a.starts_at<(p_date+1)::timestamp at time zone v_tz group by a.staff_id,s.service_id;
 delete from public.daily_customer_activity where organization_id=p_org and branch_id=p_branch and local_date=p_date;
 insert into public.daily_customer_activity(organization_id,branch_id,staff_id,customer_id,local_date,returning_customer)
 select p_org,p_branch,a.staff_id,a.customer_id,p_date,bool_or(exists(select 1 from public.appointments prev where prev.organization_id=p_org and prev.customer_id=a.customer_id and prev.status='completed' and prev.completed_at<a.completed_at)) from public.appointments a where a.organization_id=p_org and a.branch_id=p_branch and a.status='completed' and a.starts_at>=p_date::timestamp at time zone v_tz and a.starts_at<(p_date+1)::timestamp at time zone v_tz group by a.staff_id,a.customer_id;
 end $$;
create or replace function app_private.process_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.automation_jobs; v_date date; begin
 perform app_private.check_gateway(p_secret,'worker');
 select * into j from public.automation_jobs where id=p_id for update;
 if j.status<>'running' or j.lease_token is distinct from p_lease or j.leased_until<now() then raise exception 'invalid_lease' using errcode='42501'; end if;
 if j.job_type='metrics_rebuild' then
 for v_date in select value::date from jsonb_array_elements_text(coalesce(j.payload->'local_dates','[]')) loop perform app_private.rebuild_metric_day(j.organization_id,j.branch_id,v_date); end loop;
 if j.payload ? 'previous_branch' then perform app_private.rebuild_metric_day(j.organization_id,(j.payload->>'previous_branch')::uuid,(j.payload->>'previous_date')::date); end if;
 if j.payload ? 'rebooking_branch' then perform app_private.rebuild_metric_day(j.organization_id,(j.payload->>'rebooking_branch')::uuid,(j.payload->>'rebooking_date')::date); end if;
 elsif j.job_type='in_app_notification' then
 insert into public.notifications(organization_id,branch_id,profile_id,title,body,event_id)
 select j.organization_id,j.branch_id,m.profile_id,
 case j.payload->>'event_type' when 'appointment.created' then 'Nueva reserva' when 'appointment.checked_in' then 'Cliente presente' when 'appointment.completed' then 'Servicio completado' when 'walkin.created' then 'Cliente en espera' when 'customer.due' then 'Cliente listo para volver' else 'Actividad de la barbería' end,
 'Revisá la agenda y las acciones del día.',j.event_id
 from public.organization_memberships m join public.profiles p on p.id=m.profile_id where m.organization_id=j.organization_id and m.active and p.active and (m.all_branches or exists(select 1 from public.membership_branch_access a where a.organization_id=j.organization_id and a.membership_id=m.id and a.branch_id=j.branch_id)) and (m.role in ('organization_owner','manager','receptionist') or (m.role='barber' and exists(select 1 from public.staff s join public.appointments a on a.staff_id=s.id where s.organization_id=j.organization_id and s.profile_id=m.profile_id and a.id=(j.payload->>'entity_id')::uuid))) on conflict(event_id,profile_id) do nothing;
 elsif j.job_type in ('booking_notification','retention_reminder','webhook_delivery','export') then
 update public.automation_jobs set status='awaiting_configuration',leased_until=null,lease_token=null where id=p_id; return '{"status":"awaiting_configuration"}'::jsonb;
 else raise exception 'unsupported_job' using errcode='22023'; end if;
 update public.automation_jobs set status='completed',leased_until=null,lease_token=null,last_error_code=null where id=p_id;
 return '{"status":"completed"}'::jsonb; end $$;
create or replace function app_private.claim_jobs(p_secret text,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'worker');
 if p_limit not between 1 and 20 then raise exception 'invalid_limit' using errcode='22023'; end if;
 update public.automation_jobs set status='dead',leased_until=null,lease_token=null,last_error_code='attempts_exhausted' where attempts>=max_attempts and (status in ('pending','retry') or (status='running' and leased_until<now()));
 with claim as (select id from public.automation_jobs where attempts<max_attempts and ((status in ('pending','retry') and available_at<=now()) or (status='running' and leased_until<now())) order by available_at,id limit p_limit for update skip locked), updated as (
 update public.automation_jobs j set status='running',attempts=attempts+1,leased_until=now()+interval '2 minutes',lease_token=gen_random_uuid() from claim where j.id=claim.id returning j.id,j.lease_token,j.job_type)
 select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into v_result from updated; return v_result; end $$;
create or replace function app_private.worker_tick(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b record; c record; v_job uuid; v_event uuid; v_date date; begin
 perform app_private.check_gateway(p_secret,'worker');
 for b in select b.id,b.organization_id,b.timezone from public.branches b join public.organizations o on o.id=b.organization_id where b.active and o.active and not exists(select 1 from public.automation_jobs j where j.organization_id=b.organization_id and j.dedupe_key='metrics:'||b.id||':'||date_trunc('hour',now())::text) order by b.organization_id,b.id limit 200 loop
 v_date:=(now() at time zone b.timezone)::date;
 insert into public.automation_jobs(organization_id,branch_id,job_type,payload,dedupe_key) values(b.organization_id,b.id,'metrics_rebuild',jsonb_build_object('local_dates',jsonb_build_array(v_date,v_date-1)),'metrics:'||b.id||':'||date_trunc('hour',now())::text) on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 for c in select c.id,c.organization_id,c.home_branch_id,c.expected_return_at from public.customers c join public.organizations o on o.id=c.organization_id where o.active and c.archived_at is null and not c.do_not_contact and c.expected_return_at<=now() and (c.followup_after is null or c.followup_after<=now()) and not exists(select 1 from public.automation_jobs j where j.organization_id=c.organization_id and j.dedupe_key='retention:'||c.id||':'||c.expected_return_at::text) order by c.expected_return_at limit 100 loop
 perform app_private.lock_organization(c.organization_id);
 if exists(select 1 from public.automation_jobs where organization_id=c.organization_id and dedupe_key='retention:'||c.id||':'||c.expected_return_at::text) then continue; end if;
 insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id) values(c.organization_id,c.home_branch_id,c.id,'customer.due','{}',gen_random_uuid()) returning id into v_event;
 insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload,dedupe_key) values(c.organization_id,c.home_branch_id,v_event,'retention_reminder',jsonb_build_object('customer_id',c.id),'retention:'||c.id||':'||c.expected_return_at::text) on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 delete from app_private.rate_limits where window_start<now()-interval '1 day';
 delete from app_private.idempotency_keys where created_at<now()-interval '30 days';
 return '{"ok":true}'::jsonb; end $$;
create or replace function app_private.dashboard(p_org uuid,p_branch uuid,p_staff uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.has_org_role(p_org,array['organization_owner','manager','barber']) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) or (p_staff is not null and not app_private.can_read_staff(p_org,p_staff)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_to<p_from or p_to-p_from>366 or p_to>current_date+1 then raise exception 'invalid_period' using errcode='22023'; end if;
 with dimensions as (
 select a.organization_id,a.branch_id,a.staff_id,b.timezone from public.staff_branch_assignments a join public.branches b on b.organization_id=a.organization_id and b.id=a.branch_id where a.organization_id=p_org and (p_branch is null or a.branch_id=p_branch) and (p_staff is null or a.staff_id=p_staff) and app_private.can_access_branch(p_org,a.branch_id) and app_private.can_read_staff(p_org,a.staff_id)
 ), recent as (
 select d.branch_id,d.staff_id,day::date local_date,app_private.compute_metric_day(p_org,d.branch_id,d.staff_id,day::date) metrics from dimensions d cross join lateral generate_series(greatest(p_from,(now() at time zone d.timezone)::date-1)::timestamp,p_to::timestamp,'1 day') day
 ), historical as (
 select m.branch_id,m.staff_id,m.local_date,to_jsonb(m) metrics from public.daily_metrics m join dimensions d on d.branch_id=m.branch_id and d.staff_id=m.staff_id where m.organization_id=p_org and m.local_date>=p_from and m.local_date<=p_to and m.local_date<(now() at time zone d.timezone)::date-1
 ), all_metrics as (select * from recent union all select * from historical),
 totals as (select coalesce(sum((metrics->>'appointments_count')::bigint),0) appointments,coalesce(sum((metrics->>'completed_count')::bigint),0) completed,coalesce(sum((metrics->>'services_completed')::bigint),0) services_completed,coalesce(sum((metrics->>'cancelled_count')::bigint),0) cancelled,coalesce(sum((metrics->>'no_show_count')::bigint),0) no_shows,coalesce(sum((metrics->>'booked_minutes')::bigint),0) booked_minutes,coalesce(sum((metrics->>'completed_minutes')::bigint),0) completed_minutes,sum((metrics->>'available_minutes')::bigint) available_minutes,count(*) filter(where metrics->>'available_minutes' is null) unknown_capacity_days,coalesce(sum((metrics->>'priced_completed_count')::bigint),0) priced_completed,coalesce(sum((metrics->>'production_value_minor')::numeric),0) production_value_minor,coalesce(sum((metrics->>'rebookings_count')::bigint),0) rebookings from all_metrics)
 select jsonb_build_object('totals',(select to_jsonb(t)||jsonb_build_object('new_customers',(select count(*) from public.customers c where c.organization_id=p_org and c.created_at>=p_from::timestamp at time zone (select timezone from public.organizations where id=p_org) and c.created_at<(p_to+1)::timestamp at time zone (select timezone from public.organizations where id=p_org) and app_private.can_read_customer(p_org,c.id) and (p_branch is null or c.home_branch_id=p_branch) and (p_staff is null or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.staff_id=p_staff))),
 'recurring_customers',(select count(distinct customer_id) from(
 select d.customer_id from public.daily_customer_activity d join dimensions dim on dim.branch_id=d.branch_id and dim.staff_id=d.staff_id where d.organization_id=p_org and d.local_date between p_from and p_to and d.local_date<(now() at time zone dim.timezone)::date-1 and d.returning_customer
 union all select a.customer_id from public.appointments a join dimensions dim on dim.branch_id=a.branch_id and dim.staff_id=a.staff_id where a.organization_id=p_org and a.status='completed' and a.starts_at>=greatest(p_from,(now() at time zone dim.timezone)::date-1)::timestamp at time zone dim.timezone and a.starts_at<(p_to+1)::timestamp at time zone dim.timezone and exists(select 1 from public.appointments prev where prev.organization_id=p_org and prev.customer_id=a.customer_id and prev.status='completed' and prev.completed_at<a.completed_at)
 ) recurring),
 'utilization',case when available_minutes>0 and unknown_capacity_days=0 then round(booked_minutes::numeric/available_minutes*100,1) else null end,'rebooking_rate',case when completed>0 then round(rebookings::numeric/completed*100,1) else null end,'average_priced_ticket_minor',case when priced_completed>0 then round(production_value_minor/priced_completed) else null end) from totals t),
 'by_staff',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.staff_id,s.name,sum((m.metrics->>'completed_count')::bigint) completed,sum((m.metrics->>'booked_minutes')::bigint) booked_minutes,sum((m.metrics->>'available_minutes')::bigint) available_minutes from all_metrics m join public.staff s on s.id=m.staff_id group by m.staff_id,s.name order by completed desc,s.name) q),'[]'::jsonb),
 'by_branch',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.branch_id,b.name,sum((m.metrics->>'completed_count')::bigint) completed,sum((m.metrics->>'booked_minutes')::bigint) booked_minutes,sum((m.metrics->>'available_minutes')::bigint) available_minutes from all_metrics m join public.branches b on b.id=m.branch_id group by m.branch_id,b.name order by completed desc,b.name) q),'[]'::jsonb),
 'by_day',coalesce((select jsonb_agg(to_jsonb(q) order by local_date) from (select local_date,sum((metrics->>'booked_minutes')::bigint) booked_minutes,sum((metrics->>'available_minutes')::bigint) available_minutes,sum((metrics->>'completed_count')::bigint) completed from all_metrics group by local_date) q),'[]'::jsonb),
 'by_service',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.service_id,s.name,sum(m.completed_count) completed from public.daily_service_metrics m join public.services s on s.id=m.service_id where m.organization_id=p_org and m.local_date between p_from and p_to and (p_branch is null or m.branch_id=p_branch) and (p_staff is null or m.staff_id=p_staff) and app_private.can_access_branch(p_org,m.branch_id) and app_private.can_read_staff(p_org,m.staff_id) group by m.service_id,s.name order by completed desc) q),'[]'::jsonb),
 'historical_through',coalesce((select max(local_date) from historical),null),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where g.organization_id=p_org and g.active and g.starts_at<=((p_to+1)::timestamp at time zone 'UTC') and g.ends_at>=p_from::timestamp at time zone 'UTC' and (app_private.has_org_role(p_org,array['organization_owner']) or (g.branch_id is not null and app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,g.branch_id)) or g.staff_id=app_private.current_staff_id(p_org)) and (p_branch is null or g.branch_id=p_branch or g.branch_id is null) and (p_staff is null or g.staff_id=p_staff or g.staff_id is null)),'[]'::jsonb)) into v_result;
 return v_result; end $$;
create function public.membership_directory(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.membership_directory($1) $$;revoke all on function public.membership_directory(uuid),app_private.membership_directory(uuid) from public,anon,authenticated;grant execute on function public.membership_directory(uuid),app_private.membership_directory(uuid) to authenticated;
create function public.maintenance_due(p_org uuid,p_branch uuid,p_cursor jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.maintenance_due($1,$2,$3) $$;revoke all on function public.maintenance_due(uuid,uuid,jsonb),app_private.maintenance_due(uuid,uuid,jsonb) from public,anon,authenticated;grant execute on function public.maintenance_due(uuid,uuid,jsonb),app_private.maintenance_due(uuid,uuid,jsonb) to authenticated;
create function public.gateway_health(p_secret text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.gateway_health($1) $$;revoke all on function public.gateway_health(text),app_private.gateway_health(text) from public,anon,authenticated;grant execute on function public.gateway_health(text),app_private.gateway_health(text) to anon;
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['staff_availability_rules','branch_closures','branch_business_hours'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;end loop;end if;end $$;
notify pgrst,'reload schema';
