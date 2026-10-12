-- Interval engine. [start,end) permits adjacent appointments. Overnight shifts split at midnight.
create function app_private.service_plan(p_org uuid,p_branch uuid,p_services uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb; v_duration integer; v_price bigint; v_unknown integer; v_base_count integer; v_count integer; begin
 if cardinality(p_services) not between 1 and 12 or cardinality(p_services)<>(select count(distinct x) from unnest(p_services) x) then raise exception 'invalid_services' using errcode='22023'; end if;
 select count(*) into v_count from public.services s join public.branch_services bs on bs.organization_id=s.organization_id and bs.service_id=s.id where s.organization_id=p_org and s.id=any(p_services) and s.active and bs.branch_id=p_branch and bs.active;
 if v_count<>cardinality(p_services) then raise exception 'invalid_services' using errcode='22023'; end if;
 if exists(select 1 from public.services where organization_id=p_org and id=any(p_services) and composition_mode in ('included','override') and not base_service_id=any(p_services)) then raise exception 'base_service_required' using errcode='22023'; end if;
 if exists(select 1 from public.services where organization_id=p_org and id=any(p_services) and composition_mode='override' group by base_service_id having count(*)>1) then raise exception 'conflicting_overrides' using errcode='22023'; end if;
 select count(*) into v_base_count from public.services where organization_id=p_org and id=any(p_services) and composition_mode='standalone';
 if v_base_count<>1 then raise exception 'one_primary_service_required' using errcode='22023'; end if;
 with items as (
 select s.id,s.name,s.composition_mode,
 case when s.composition_mode='included' or exists(select 1 from public.services x where x.organization_id=p_org and x.id=any(p_services) and x.composition_mode='override' and x.base_service_id=s.id) then 0 else coalesce(bs.duration_minutes,s.default_duration_minutes) end as duration_minutes,
 case when s.composition_mode='included' or exists(select 1 from public.services x where x.organization_id=p_org and x.id=any(p_services) and x.composition_mode='override' and x.base_service_id=s.id) then 0 else bs.price_minor end as price_minor
 from public.services s join public.branch_services bs on bs.organization_id=s.organization_id and bs.service_id=s.id where s.organization_id=p_org and s.id=any(p_services) and bs.branch_id=p_branch
 )
 select jsonb_agg(to_jsonb(items) order by id),sum(duration_minutes),sum(price_minor),count(*) filter(where price_minor is null) into v_items,v_duration,v_price,v_unknown from items;
 if v_duration not between 1 and 480 then raise exception 'invalid_composed_duration' using errcode='22023'; end if;
 return jsonb_build_object('duration_minutes',v_duration,'price_minor',case when v_unknown>0 then null else v_price end,'items',v_items); end $$;
create function app_private.effective_availability(p_org uuid,p_branch uuid,p_staff uuid,p_date date,p_subtract_bookings boolean default true,p_exclude uuid default null) returns tstzmultirange language plpgsql stable security definer set search_path='' as $$
declare v_tz text; v_branch tstzmultirange; v_staff tstzmultirange; v_off tstzmultirange; v_result tstzmultirange; v_day tstzrange; begin
 select b.timezone into v_tz from public.branches b join public.staff_branch_assignments a on a.organization_id=b.organization_id and a.branch_id=b.id join public.staff s on s.id=a.staff_id and s.organization_id=a.organization_id where b.organization_id=p_org and b.id=p_branch and a.staff_id=p_staff and a.active and b.active and s.active;
 if v_tz is null then return '{}'::tstzmultirange; end if;
 v_day:=tstzrange(p_date::timestamp at time zone v_tz,(p_date+1)::timestamp at time zone v_tz,'[)');
 select coalesce(range_agg(tstzrange((p_date+opens_at) at time zone v_tz,(p_date+closes_at) at time zone v_tz,'[)')),'{}'::tstzmultirange) into v_branch from public.branch_business_hours where organization_id=p_org and branch_id=p_branch and weekday=extract(dow from p_date)::integer;
 select v_branch+coalesce(range_agg(tstzrange(starts_at,ends_at,'[)')*v_day),'{}'::tstzmultirange) into v_branch from public.branch_closures where organization_id=p_org and branch_id=p_branch and kind='open' and tstzrange(starts_at,ends_at,'[)')&&v_day;
 select coalesce(range_agg(tstzrange((p_date+starts_at) at time zone v_tz,(p_date+ends_at) at time zone v_tz,'[)')),'{}'::tstzmultirange) into v_staff from public.staff_availability_exceptions where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and local_date=p_date and available;
 if v_staff='{}'::tstzmultirange then
  select coalesce(range_agg(tstzrange((p_date+starts_at) at time zone v_tz,(p_date+ends_at) at time zone v_tz,'[)')),'{}'::tstzmultirange) into v_staff from public.staff_availability_rules where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=extract(dow from p_date)::integer and (valid_from is null or valid_from<=p_date) and (valid_until is null or valid_until>=p_date);
 end if;
 v_result:=v_branch*v_staff*tstzmultirange(v_day);
 select coalesce(range_agg(r),'{}'::tstzmultirange) into v_off from (
 select tstzrange(starts_at,ends_at,'[)') r from public.branch_closures where organization_id=p_org and branch_id=p_branch and kind='closed' and tstzrange(starts_at,ends_at,'[)')&&v_day
 union all select tstzrange(starts_at,ends_at,'[)') from public.staff_time_off where organization_id=p_org and staff_id=p_staff and (branch_id is null or branch_id=p_branch) and tstzrange(starts_at,ends_at,'[)')&&v_day
 union all select tstzrange((p_date+starts_at) at time zone v_tz,(p_date+ends_at) at time zone v_tz,'[)') from public.staff_availability_exceptions where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and local_date=p_date and not available
 ) q;
 v_result:=v_result-v_off;
 if p_subtract_bookings then
 select coalesce(range_agg(during),'{}'::tstzmultirange) into v_off from public.appointments where organization_id=p_org and staff_id=p_staff and status in ('scheduled','confirmed','checked_in','in_service') and (p_exclude is null or id<>p_exclude) and during&&v_day;
 v_result:=v_result-v_off; end if;
 return v_result; end $$;
create function app_private.compatible_staff(p_org uuid,p_branch uuid,p_services uuid[],p_start timestamptz,p_staff uuid,p_exclude uuid default null) returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_duration integer; v_tz text; v_id uuid; begin
 v_duration:=(app_private.service_plan(p_org,p_branch,p_services)->>'duration_minutes')::integer;
 select timezone into v_tz from public.branches where organization_id=p_org and id=p_branch and active;
 select s.id into v_id from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id
 where s.organization_id=p_org and a.branch_id=p_branch and s.active and a.active and (p_staff is null or s.id=p_staff)
 and not exists(select 1 from unnest(p_services) x where not exists(select 1 from public.staff_service_capabilities c where c.organization_id=p_org and c.staff_id=s.id and c.service_id=x))
 and app_private.effective_availability(p_org,p_branch,s.id,(p_start at time zone v_tz)::date,true,p_exclude) @> tstzrange(p_start,p_start+make_interval(mins=>v_duration),'[)')
 order by (select coalesce(sum(b.duration_minutes),0) from public.appointments b where b.organization_id=p_org and b.staff_id=s.id and (b.starts_at at time zone v_tz)::date=(p_start at time zone v_tz)::date and b.status not in ('cancelled','no_show','rescheduled')),s.id limit 1;
 if v_id is null then raise exception 'unavailable' using errcode='23P01'; end if;
 return v_id; end $$;
create function app_private.availability_slots(p_org uuid,p_branch uuid,p_services uuid[],p_date date,p_staff uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_tz text; v_duration integer; v_step integer; v_horizon integer; v_result jsonb; begin
 select b.timezone,s.slot_step_minutes,s.booking_horizon_days into v_tz,v_step,v_horizon from public.branches b join public.organization_settings s on s.organization_id=b.organization_id where b.organization_id=p_org and b.id=p_branch and b.active;
 if v_tz is null or p_date<(now() at time zone v_tz)::date or p_date>(now() at time zone v_tz)::date+v_horizon then raise exception 'invalid_date_range' using errcode='22023'; end if;
 v_duration:=(app_private.service_plan(p_org,p_branch,p_services)->>'duration_minutes')::integer;
 with candidates as (
 select s.id,s.slug,s.name,slot from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id
 cross join lateral unnest(app_private.effective_availability(p_org,p_branch,s.id,p_date,true,null)) ranges(r)
 cross join lateral generate_series(lower(r),upper(r)-make_interval(mins=>v_duration),make_interval(mins=>v_step)) slot
 where s.organization_id=p_org and a.branch_id=p_branch and s.active and a.active and (p_staff is null or s.id=p_staff)
 and not exists(select 1 from unnest(p_services) x where not exists(select 1 from public.staff_service_capabilities c where c.organization_id=p_org and c.staff_id=s.id and c.service_id=x))
 and slot>=now()
 )
 select coalesce(jsonb_agg(jsonb_build_object('staff_id',id,'staff_slug',slug,'staff_name',name,'starts_at',slot,'duration_minutes',v_duration) order by slot,id),'[]'::jsonb) into v_result from candidates;
 return v_result; end $$;
create function app_private.list_availability(p_org uuid,p_branch uuid,p_services uuid[],p_date date,p_staff uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.can_operate_branch(p_org,p_branch) and not (app_private.can_access_branch(p_org,p_branch) and p_staff is not null and p_staff=app_private.current_staff_id(p_org)) then raise exception 'forbidden' using errcode='42501'; end if;
 return app_private.availability_slots(p_org,p_branch,p_services,p_date,p_staff); end $$;
create function app_private.create_booking_internal(p_org uuid,p_branch uuid,p_services uuid[],p_staff uuid,p_start timestamptz,p_customer uuid,p_customer_data jsonb,p_key uuid,p_source text,p_rebooked_from uuid,p_scope text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform app_private.emit_event(p_org,p_branch,v_id,'appointment.created',jsonb_build_object('local_dates',jsonb_build_array((p_start at time zone v_tz)::date)),v_request);
 select jsonb_build_object('id',id,'reference',public_reference,'staff_id',staff_id,'starts_at',starts_at,'ends_at',ends_at,'duration_minutes',duration_minutes) into v_result from public.appointments where id=v_id;
 return app_private.idempotency_finish(p_org,p_scope,'create_booking',p_key,v_result); end $$;
create function app_private.create_booking(p_org uuid,p_branch uuid,p_services uuid[],p_staff uuid,p_start timestamptz,p_customer uuid,p_customer_data jsonb,p_key uuid,p_rebooked_from uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not app_private.can_operate_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_customer is not null and not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 return app_private.create_booking_internal(p_org,p_branch,p_services,p_staff,p_start,p_customer,p_customer_data,p_key,case when p_rebooked_from is null then 'internal' else 'rebooking' end,p_rebooked_from,app_private.current_profile()::text); end $$;
create function app_private.reschedule_booking(p_org uuid,p_id uuid,p_branch uuid,p_staff uuid,p_start timestamptz,p_services uuid[],p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.appointments; v_plan jsonb; v_staff uuid; v_result jsonb; v_request uuid:=app_private.request_id(); v_item jsonb; v_tz text; v_old_tz text; begin
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
 delete from public.appointment_services where organization_id=p_org and appointment_id=p_id;
 for v_item in select value from jsonb_array_elements(v_plan->'items') loop
 insert into public.appointment_services(organization_id,appointment_id,service_id,name_snapshot,duration_minutes,price_minor,composition_mode) values(p_org,p_id,(v_item->>'id')::uuid,v_item->>'name',(v_item->>'duration_minutes')::integer,(v_item->>'price_minor')::bigint,v_item->>'composition_mode'); end loop;
 insert into public.appointment_status_history(organization_id,branch_id,appointment_id,from_status,to_status,metadata,request_id) values(p_org,p_branch,p_id,a.status,'rescheduled',jsonb_build_object('previous_start',a.starts_at,'previous_end',a.ends_at,'previous_staff_id',a.staff_id,'previous_branch_id',a.branch_id,'previous_services',(select jsonb_agg(service_id) from public.appointment_services where appointment_id=p_id)),v_request),(p_org,p_branch,p_id,'rescheduled','scheduled','{}',v_request);
 perform app_private.record_audit(p_org,p_branch,'appointment.rescheduled','appointments',p_id,jsonb_build_object('previous_start',a.starts_at,'starts_at',p_start,'previous_branch',a.branch_id,'branch',p_branch),v_request);
 perform app_private.emit_event(p_org,p_branch,p_id,'appointment.rescheduled',jsonb_build_object('local_dates',jsonb_build_array((p_start at time zone v_tz)::date),'previous_branch',a.branch_id,'previous_date',(a.starts_at at time zone v_old_tz)::date),v_request);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'reschedule',p_key,v_result); end $$;
create function app_private.transition_booking(p_org uuid,p_id uuid,p_status text,p_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select coalesce(c.return_interval_days,(select min(s.suggested_return_days) from public.appointment_services aps join public.services s on s.organization_id=aps.organization_id and s.id=aps.service_id where aps.appointment_id=p_id and aps.composition_mode<>'included'),os.default_return_days) into v_days from public.customers c join public.organization_settings os on os.organization_id=c.organization_id where c.id=a.customer_id and c.organization_id=p_org;
 update public.customers set expected_return_at=case when v_days is null then null else now()+make_interval(days=>v_days) end,followup_after=null where id=a.customer_id and organization_id=p_org;
 end if;
 update public.walk_in_entries set status=case p_status when 'checked_in' then 'assigned' when 'in_service' then 'in_service' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else status end where organization_id=p_org and appointment_id=p_id;
 select timezone into v_tz from public.branches where id=a.branch_id;
 perform app_private.record_audit(p_org,a.branch_id,'appointment.'||p_status,'appointments',p_id,jsonb_build_object('from',a.status,'to',p_status),v_request);
 perform app_private.emit_event(p_org,a.branch_id,p_id,'appointment.'||p_status,jsonb_build_object('local_dates',jsonb_build_array((a.starts_at at time zone v_tz)::date)),v_request);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'transition',p_key,v_result); end $$;
create function app_private.cancel_booking(p_org uuid,p_id uuid,p_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$ begin return app_private.transition_booking(p_org,p_id,'cancelled',p_key,p_reason); end $$;
create function app_private.check_gateway(p_secret text,p_name text) returns void language plpgsql stable security definer set search_path='' as $$ begin
 if p_secret is null or length(p_secret)<32 or not exists(select 1 from app_private.gateway_credentials where name=p_name and active and secret_hash=encode(extensions.digest(p_secret,'sha256'),'hex')) then raise exception 'forbidden' using errcode='42501'; end if; end $$;
create function app_private.rate_limit(p_bucket text,p_limit integer,p_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare v_count integer; begin
 insert into app_private.rate_limits(bucket) values(p_bucket)
 on conflict(bucket) do update set requests=case when app_private.rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else app_private.rate_limits.requests+1 end,window_start=case when app_private.rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else app_private.rate_limits.window_start end returning requests into v_count;
 if v_count>p_limit then raise exception 'rate_limited' using errcode='P0001'; end if;
 end $$;
-- Reads use per-window LIMIT buckets; failed writes cannot consume counters after rollback.
-- Gateway rate checks run in a separate committed request, before booking RPC.
create function app_private.public_rate_check(p_secret text,p_client_hash text,p_write boolean) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.check_gateway(p_secret,'booking');
 if p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_client_hash' using errcode='22023'; end if;
 perform app_private.rate_limit('public:'||p_client_hash||case when p_write then ':write' else ':read' end,case when p_write then 12 else 90 end,60);
 return '{"allowed":true}'::jsonb; end $$;
create function app_private.public_catalog(p_secret text,p_slug text,p_branch_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'booking');
 select o.id into v_org from public.organizations o join public.organization_settings os on os.organization_id=o.id where o.slug=p_slug and o.active and os.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select jsonb_build_object('name',o.name,'slug',o.slug,'logo_url',o.logo_url,'brand_color',o.brand_color,'currency',o.currency,'branches',
 (select coalesce(jsonb_agg(jsonb_build_object('name',b.name,'slug',b.slug,'address',b.address,'phone',b.phone,'timezone',b.timezone,'services',
 (select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'description',s.description,'duration_minutes',coalesce(bs.duration_minutes,s.default_duration_minutes),'composition_mode',s.composition_mode,'base_service_slug',(select slug from public.services where id=s.base_service_id),'price_minor',bs.price_minor) order by s.name),'[]'::jsonb) from public.branch_services bs join public.services s on s.organization_id=bs.organization_id and s.id=bs.service_id where bs.organization_id=v_org and bs.branch_id=b.id and bs.active and s.active),
 'staff',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'services',(select coalesce(jsonb_agg(sv.slug),'[]'::jsonb) from public.staff_service_capabilities c join public.services sv on sv.id=c.service_id where c.organization_id=v_org and c.staff_id=s.id)) order by s.name),'[]'::jsonb) from public.staff s join public.staff_branch_assignments sa on sa.organization_id=s.organization_id and sa.staff_id=s.id where s.organization_id=v_org and sa.branch_id=b.id and sa.active and s.active)) order by b.name),'[]'::jsonb) from public.branches b join public.branch_settings bs on bs.organization_id=b.organization_id and bs.branch_id=b.id where b.organization_id=v_org and b.active and bs.booking_enabled and (p_branch_slug is null or b.slug=p_branch_slug))) into v_result from public.organizations o where o.id=v_org;
 return v_result; end $$;
create function app_private.resolve_public_request(p_slug text,p_branch_slug text,p_services text[],p_staff_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_branch uuid; v_staff uuid; v_services uuid[]; begin
 if cardinality(p_services) not between 1 and 12 or length(p_slug)>63 or length(p_branch_slug)>63 then raise exception 'invalid_request' using errcode='22023'; end if;
 select o.id,b.id into v_org,v_branch from public.organizations o join public.organization_settings os on os.organization_id=o.id join public.branches b on b.organization_id=o.id join public.branch_settings bs on bs.organization_id=o.id and bs.branch_id=b.id where o.slug=p_slug and b.slug=p_branch_slug and o.active and b.active and os.booking_enabled and bs.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select array_agg(id order by id) into v_services from public.services where organization_id=v_org and slug=any(p_services) and active;
 if cardinality(v_services) is distinct from cardinality(p_services) then raise exception 'invalid_services' using errcode='22023'; end if;
 if p_staff_slug is not null then select id into v_staff from public.staff where organization_id=v_org and slug=p_staff_slug and active; if v_staff is null then raise exception 'invalid_staff' using errcode='22023'; end if; end if;
 return jsonb_build_object('organization_id',v_org,'branch_id',v_branch,'staff_id',v_staff,'services',to_jsonb(v_services)); end $$;
create function app_private.public_availability(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'booking');
 r:=app_private.resolve_public_request(p_slug,p_branch_slug,p_services,p_staff_slug);
 select coalesce(jsonb_agg(x.value-'staff_id'),'[]'::jsonb) into v_result from jsonb_array_elements(app_private.availability_slots((r->>'organization_id')::uuid,(r->>'branch_id')::uuid,array(select value::uuid from jsonb_array_elements_text(r->'services')),(p_date),(r->>'staff_id')::uuid)) x where (x.value->>'starts_at')::timestamptz>=now()+make_interval(mins=>(select booking_lead_minutes from public.organization_settings where organization_id=(r->>'organization_id')::uuid));
 return v_result; end $$;
create function app_private.public_booking(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_start timestamptz,p_customer_data jsonb,p_key uuid,p_honeypot text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; v_result jsonb; v_org uuid; begin
 perform app_private.check_gateway(p_secret,'booking');
 if coalesce(p_honeypot,'')<>'' then raise exception 'invalid_request' using errcode='22023'; end if;
 r:=app_private.resolve_public_request(p_slug,p_branch_slug,p_services,p_staff_slug); v_org:=(r->>'organization_id')::uuid;
 v_result:=app_private.create_booking_internal(v_org,(r->>'branch_id')::uuid,array(select value::uuid from jsonb_array_elements_text(r->'services')),(r->>'staff_id')::uuid,p_start,null,p_customer_data,p_key,'public',null,'public:'||coalesce(p_customer_data->>'normalized_phone',''));
 return v_result-'id'-'staff_id'; end $$;
create function public.list_availability(p_org uuid,p_branch uuid,p_services uuid[],p_date date,p_staff uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.list_availability($1,$2,$3,$4,$5) $$;
revoke all on function public.list_availability(uuid,uuid,uuid[],date,uuid) from public,anon,authenticated;
revoke all on function app_private.list_availability(uuid,uuid,uuid[],date,uuid) from public,anon,authenticated;
grant execute on function public.list_availability(uuid,uuid,uuid[],date,uuid),app_private.list_availability(uuid,uuid,uuid[],date,uuid) to authenticated;
create function public.create_booking(p_org uuid,p_branch uuid,p_services uuid[],p_staff uuid,p_start timestamptz,p_customer uuid,p_customer_data jsonb,p_key uuid,p_rebooked_from uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.create_booking($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
revoke all on function public.create_booking(uuid,uuid,uuid[],uuid,timestamptz,uuid,jsonb,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.create_booking(uuid,uuid,uuid[],uuid,timestamptz,uuid,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_booking(uuid,uuid,uuid[],uuid,timestamptz,uuid,jsonb,uuid,uuid),app_private.create_booking(uuid,uuid,uuid[],uuid,timestamptz,uuid,jsonb,uuid,uuid) to authenticated;
create function public.reschedule_booking(p_org uuid,p_id uuid,p_branch uuid,p_staff uuid,p_start timestamptz,p_services uuid[],p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.reschedule_booking($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function public.reschedule_booking(uuid,uuid,uuid,uuid,timestamptz,uuid[],uuid) from public,anon,authenticated;
revoke all on function app_private.reschedule_booking(uuid,uuid,uuid,uuid,timestamptz,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.reschedule_booking(uuid,uuid,uuid,uuid,timestamptz,uuid[],uuid),app_private.reschedule_booking(uuid,uuid,uuid,uuid,timestamptz,uuid[],uuid) to authenticated;
create function public.transition_booking(p_org uuid,p_id uuid,p_status text,p_key uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.transition_booking($1,$2,$3,$4,$5) $$;
revoke all on function public.transition_booking(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function app_private.transition_booking(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.transition_booking(uuid,uuid,text,uuid,text),app_private.transition_booking(uuid,uuid,text,uuid,text) to authenticated;
create function public.cancel_booking(p_org uuid,p_id uuid,p_key uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.cancel_booking($1,$2,$3,$4) $$;
revoke all on function public.cancel_booking(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function app_private.cancel_booking(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_booking(uuid,uuid,uuid,text),app_private.cancel_booking(uuid,uuid,uuid,text) to authenticated;
grant usage on schema app_private to anon;
create function public.public_rate_check(p_secret text,p_client_hash text,p_write boolean) returns jsonb language sql security invoker set search_path='' as $$ select app_private.public_rate_check($1,$2,$3) $$;
revoke all on function public.public_rate_check(text,text,boolean) from public,anon,authenticated;
revoke all on function app_private.public_rate_check(text,text,boolean) from public,anon,authenticated;
grant execute on function public.public_rate_check(text,text,boolean),app_private.public_rate_check(text,text,boolean) to anon;
create function public.public_catalog(p_secret text,p_slug text,p_branch_slug text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.public_catalog($1,$2,$3) $$;
revoke all on function public.public_catalog(text,text,text) from public,anon,authenticated;
revoke all on function app_private.public_catalog(text,text,text) from public,anon,authenticated;
grant execute on function public.public_catalog(text,text,text),app_private.public_catalog(text,text,text) to anon;
create function public.public_availability(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_date date) returns jsonb language sql security invoker set search_path='' as $$ select app_private.public_availability($1,$2,$3,$4,$5,$6) $$;
revoke all on function public.public_availability(text,text,text,text[],text,date) from public,anon,authenticated;
revoke all on function app_private.public_availability(text,text,text,text[],text,date) from public,anon,authenticated;
grant execute on function public.public_availability(text,text,text,text[],text,date),app_private.public_availability(text,text,text,text[],text,date) to anon;
create function public.public_booking(p_secret text,p_slug text,p_branch_slug text,p_services text[],p_staff_slug text,p_start timestamptz,p_customer_data jsonb,p_key uuid,p_honeypot text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
revoke all on function public.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text) from public,anon,authenticated;
revoke all on function app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text),app_private.public_booking(text,text,text,text[],text,timestamptz,jsonb,uuid,text) to anon;
revoke all on function app_private.service_plan(uuid,uuid,uuid[]),app_private.effective_availability(uuid,uuid,uuid,date,boolean,uuid),app_private.compatible_staff(uuid,uuid,uuid[],timestamptz,uuid,uuid),app_private.availability_slots(uuid,uuid,uuid[],date,uuid),app_private.create_booking_internal(uuid,uuid,uuid[],uuid,timestamptz,uuid,jsonb,uuid,text,uuid,text),app_private.check_gateway(text,text),app_private.rate_limit(text,integer,integer),app_private.resolve_public_request(text,text,text[],text) from public,anon,authenticated;
