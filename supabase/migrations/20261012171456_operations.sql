-- Operational reads are bounded and permission checked inside the privileged helper.
create function app_private.list_customers(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.is_org_member(p_org) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit not between 1 and 100 or length(coalesce(p_query,''))>80 or p_retention not in ('all','due_soon','due','overdue','lapsed') then raise exception 'invalid_query' using errcode='22023'; end if;
 with scoped as (
 select c.*,case when c.expected_return_at is null then 'active' when c.expected_return_at>now()+make_interval(days=>s.retention_due_soon_days) then 'active' when c.expected_return_at>now() then 'due_soon' when c.expected_return_at>now()-interval '1 day' then 'due' when c.expected_return_at<now()-make_interval(days=>s.retention_lapsed_days) then 'lapsed' else 'overdue' end as retention_status
 from public.customers c join public.organization_settings s on s.organization_id=c.organization_id
 where c.organization_id=p_org and c.archived_at is null and app_private.can_read_customer(p_org,c.id)
 and (p_branch is null or c.home_branch_id=p_branch or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=p_branch))
 and (coalesce(p_query,'')='' or c.name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or c.normalized_phone like replace(replace(p_query,'%',''),'_','')||'%')
 and (p_cursor is null or (c.created_at,c.id)<((p_cursor->>'created_at')::timestamptz,(p_cursor->>'id')::uuid))
 ), page as (
 select * from scoped where p_retention='all' or (retention_status=p_retention and not do_not_contact and (followup_after is null or followup_after<=now())) order by created_at desc,id desc limit p_limit+1
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from (select * from page order by created_at desc,id desc limit p_limit) p),'[]'::jsonb),'has_more',(select count(*)>p_limit from page),'next_cursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at desc,id desc offset p_limit-1 limit 1)) into v_result;
 return v_result; end $$;
create function app_private.customer_detail(p_org uuid,p_customer uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object('customer',to_jsonb(c),'stats',(select jsonb_build_object('visits',count(*) filter(where a.status='completed'),'no_shows',count(*) filter(where a.status='no_show'),'cancellations',count(*) filter(where a.status='cancelled'),'last_visit_at',max(a.completed_at),'known_production_value_minor',sum(a.price_minor) filter(where a.status='completed'),'priced_visits',count(*) filter(where a.status='completed' and a.price_minor is not null)) from public.appointments a where a.organization_id=p_org and a.customer_id=p_customer and app_private.can_read_appointment(p_org,a.id)),
 'preferences',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]'::jsonb) from public.customer_preferences where organization_id=p_org and customer_id=p_customer),
 'tags',(select coalesce(jsonb_agg(tag),'[]'::jsonb) from public.customer_tags where organization_id=p_org and customer_id=p_customer)) into v_result from public.customers c where c.organization_id=p_org and c.id=p_customer;
 return v_result; end $$;
create function app_private.customer_timeline(p_org uuid,p_customer uuid,p_before timestamptz,p_before_id uuid,p_limit integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit not between 1 and 50 then raise exception 'invalid_limit' using errcode='22023'; end if;
 with events as (
 select h.id,h.created_at,'appointment.'||h.to_status as type,jsonb_build_object('appointment_id',a.id,'starts_at',a.starts_at,'staff_id',a.staff_id,'status',h.to_status,'metadata',h.metadata) as data from public.appointment_status_history h join public.appointments a on a.organization_id=h.organization_id and a.id=h.appointment_id where a.organization_id=p_org and a.customer_id=p_customer and app_private.can_read_appointment(p_org,a.id)
 union all select n.id,n.created_at,'note',jsonb_build_object('body',n.body) from public.customer_notes n where n.organization_id=p_org and n.customer_id=p_customer
 ), page as (select * from events where p_before is null or (created_at,id)<(p_before,p_before_id) order by created_at desc,id desc limit p_limit+1)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from (select * from page order by created_at desc,id desc limit p_limit) p),'[]'::jsonb),'has_more',(select count(*)>p_limit from page)) into v_result;
 return v_result; end $$;
create function app_private.create_walkin(p_org uuid,p_branch uuid,p_customer uuid,p_customer_data jsonb,p_services uuid[],p_preferred_staff uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_customer uuid; v_result jsonb; v_id uuid; v_request uuid:=app_private.request_id(); begin
 if not app_private.can_operate_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_customer is not null and not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 v_result:=app_private.idempotency_begin(p_org,app_private.current_profile()::text,'walkin.create',p_key,jsonb_build_object('branch',p_branch,'customer',p_customer,'customer_data',p_customer_data,'services',p_services,'staff',p_preferred_staff));
 if v_result is not null then return v_result; end if;
 perform app_private.service_plan(p_org,p_branch,p_services);
 if p_preferred_staff is not null and not exists(select 1 from public.staff_branch_assignments a join public.staff s on s.id=a.staff_id where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=p_preferred_staff and a.active and s.active and not exists(select 1 from unnest(p_services) x where not exists(select 1 from public.staff_service_capabilities c where c.organization_id=p_org and c.staff_id=p_preferred_staff and c.service_id=x))) then raise exception 'invalid_staff' using errcode='22023'; end if;
 if p_customer is null then
 if jsonb_typeof(p_customer_data)<>'object' or octet_length(p_customer_data::text)>2048 or exists(select 1 from jsonb_object_keys(p_customer_data) k where k not in ('name','normalized_phone','email')) then raise exception 'invalid_customer' using errcode='22023'; end if;
 insert into public.customers(organization_id,name,normalized_phone,email,home_branch_id) values(p_org,p_customer_data->>'name',p_customer_data->>'normalized_phone',nullif(p_customer_data->>'email',''),p_branch) on conflict(organization_id,normalized_phone) do nothing returning id into v_customer;
 if v_customer is null then select id into v_customer from public.customers where organization_id=p_org and normalized_phone=p_customer_data->>'normalized_phone' and archived_at is null;
 else perform app_private.emit_event(p_org,p_branch,v_customer,'customer.created','{}',v_request); end if;
 else select id into v_customer from public.customers where organization_id=p_org and id=p_customer and archived_at is null; end if;
 if v_customer is null then raise exception 'invalid_customer' using errcode='22023'; end if;
 insert into public.walk_in_entries(organization_id,branch_id,customer_id,requested_service_ids,preferred_staff_id) values(p_org,p_branch,v_customer,p_services,p_preferred_staff) returning id into v_id;
 perform app_private.record_audit(p_org,p_branch,'walkin.created','walk_in_entries',v_id,'{}',v_request);
 perform app_private.emit_event(p_org,p_branch,v_id,'walkin.created','{}',v_request);
 v_result:=jsonb_build_object('id',v_id);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'walkin.create',p_key,v_result); end $$;
create function app_private.assign_walkin(p_org uuid,p_id uuid,p_staff uuid,p_start timestamptz,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.walk_in_entries; v_booking jsonb; v_result jsonb; v_request uuid:=app_private.request_id(); begin
 select * into w from public.walk_in_entries where organization_id=p_org and id=p_id;
 if not app_private.can_operate_branch(p_org,w.branch_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 select * into w from public.walk_in_entries where organization_id=p_org and id=p_id for update;
 v_result:=app_private.idempotency_begin(p_org,app_private.current_profile()::text,'walkin.assign',p_key,jsonb_build_object('id',p_id,'staff',p_staff,'start',p_start));
 if v_result is not null then return v_result; end if;
 if w.status<>'waiting' or p_start<now()-interval '1 minute' or p_start>now()+interval '30 minutes' then raise exception 'invalid_walkin_assignment' using errcode='23514'; end if;
 v_booking:=app_private.create_booking_internal(p_org,w.branch_id,w.requested_service_ids,coalesce(p_staff,w.preferred_staff_id),p_start,w.customer_id,null,p_key,'walk_in',null,app_private.current_profile()::text||':walkin:'||w.id);
 update public.walk_in_entries set assigned_staff_id=(v_booking->>'staff_id')::uuid,appointment_id=(v_booking->>'id')::uuid,status='assigned' where id=p_id returning to_jsonb(walk_in_entries.*) into v_result;
 perform app_private.emit_event(p_org,w.branch_id,p_id,'walkin.assigned','{}',v_request);
 perform app_private.record_audit(p_org,w.branch_id,'walkin.assigned','walk_in_entries',p_id,jsonb_build_object('appointment_id',v_booking->>'id'),v_request);
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'walkin.assign',p_key,v_result); end $$;
create function app_private.close_walkin(p_org uuid,p_id uuid,p_status text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.walk_in_entries; v_result jsonb; begin
 select * into w from public.walk_in_entries where organization_id=p_org and id=p_id;
 if not app_private.can_operate_branch(p_org,w.branch_id) then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 select * into w from public.walk_in_entries where organization_id=p_org and id=p_id for update;
 v_result:=app_private.idempotency_begin(p_org,app_private.current_profile()::text,'walkin.close',p_key,jsonb_build_object('id',p_id,'status',p_status));
 if v_result is not null then return v_result; end if;
 if w.status<>'waiting' or p_status not in ('cancelled','left') then raise exception 'invalid_transition' using errcode='23514'; end if;
 update public.walk_in_entries set status=p_status where id=p_id returning to_jsonb(walk_in_entries.*) into v_result;
 perform app_private.record_audit(p_org,w.branch_id,'walkin.'||p_status,'walk_in_entries',p_id,'{}',gen_random_uuid());
 return app_private.idempotency_finish(p_org,app_private.current_profile()::text,'walkin.close',p_key,v_result); end $$;
create function app_private.day_status(p_org uuid,p_branch uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_tz text; begin
 if not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
 select timezone into v_tz from public.branches where id=p_branch and organization_id=p_org;
 select jsonb_build_object('staff',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'working',exists(select 1 from public.appointments where organization_id=p_org and staff_id=s.id and status='in_service'),'available_now',app_private.effective_availability(p_org,p_branch,s.id,(now() at time zone v_tz)::date,true,null) @> now())) from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id where s.organization_id=p_org and a.branch_id=p_branch and s.active and a.active and app_private.can_read_staff(p_org,s.id)),'[]'::jsonb),
 'queue',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at,q.id) from (
 select w.*,c.name as customer_name,c.normalized_phone,
 (select min(ceil(extract(epoch from greatest(lower(r),now())-now())/60))::integer from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id cross join lateral unnest(app_private.effective_availability(p_org,p_branch,s.id,(now() at time zone v_tz)::date,true,null)) x(r) where s.organization_id=p_org and a.branch_id=p_branch and s.active and a.active and (w.preferred_staff_id is null or s.id=w.preferred_staff_id) and greatest(lower(r),now())+make_interval(mins=>(app_private.service_plan(p_org,p_branch,w.requested_service_ids)->>'duration_minutes')::integer)<=upper(r) and not exists(select 1 from unnest(w.requested_service_ids) service where not exists(select 1 from public.staff_service_capabilities cap where cap.organization_id=p_org and cap.staff_id=s.id and cap.service_id=service))) as estimated_wait_minutes
 from public.walk_in_entries w join public.customers c on c.organization_id=w.organization_id and c.id=w.customer_id where w.organization_id=p_org and w.branch_id=p_branch and w.status in ('waiting','assigned','in_service') and (app_private.can_operate_branch(p_org,p_branch) or w.assigned_staff_id=app_private.current_staff_id(p_org)) order by w.created_at,w.id limit 100) q),'[]'::jsonb)) into v_result;
 return v_result; end $$;
create function app_private.search_workspace(p_org uuid,p_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501'; end if;
 if length(p_query) not between 2 and 80 then raise exception 'invalid_search' using errcode='22023'; end if;
 select jsonb_build_object('customers',app_private.list_customers(p_org,null,p_query,null,20,'all')->'items',
 'staff',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select id,name from public.staff where organization_id=p_org and app_private.can_read_staff(p_org,id) and name ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%' order by name,id limit 10) q),
 'appointments',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select a.id,a.starts_at,a.status,c.name from public.appointments a join public.customers c on c.organization_id=a.organization_id and c.id=a.customer_id where a.organization_id=p_org and a.starts_at between now()-interval '90 days' and now()+interval '365 days' and app_private.can_read_appointment(p_org,a.id) and (c.name ilike '%'||replace(replace(p_query,'%','\%'),'_','\_')||'%' or c.normalized_phone like replace(p_query,'%','')||'%') order by a.starts_at desc,a.id limit 20) q)) into v_result;
 return v_result; end $$;
create index customers_phone_prefix_idx on public.customers(organization_id,normalized_phone text_pattern_ops);
create index staff_name_search_idx on public.staff using gin(name extensions.gin_trgm_ops);
create function app_private.remove_schedule_record(p_org uuid,p_entity text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; v_branch uuid; v_staff uuid; begin
 if p_entity not in ('branch_business_hours','staff_availability_rules','staff_availability_exceptions','staff_service_capabilities') then raise exception 'forbidden' using errcode='42501'; end if;
 perform app_private.lock_organization(p_org);
 execute format('select to_jsonb(t) from public.%I t where organization_id=$1 and id=$2 for update',p_entity) into r using p_org,p_id;
 v_branch:=(r->>'branch_id')::uuid; v_staff:=(r->>'staff_id')::uuid;
 if not app_private.has_org_role(p_org,array['organization_owner']) and not (p_entity<>'staff_service_capabilities' and app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,v_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if r is null then raise exception 'not_found' using errcode='P0002'; end if;
 if exists(select 1 from public.appointments where organization_id=p_org and starts_at>=now() and status in ('scheduled','confirmed','checked_in','in_service') and (v_branch is null or branch_id=v_branch) and (v_staff is null or staff_id=v_staff)) then raise exception 'schedule_has_future_bookings' using errcode='23514'; end if;
 execute format('delete from public.%I where organization_id=$1 and id=$2',p_entity) using p_org,p_id;
 perform app_private.record_audit(p_org,v_branch,p_entity||'.removed',p_entity,p_id,'{}',gen_random_uuid()); return jsonb_build_object('id',p_id); end $$;
create function public.list_customers(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.list_customers($1,$2,$3,$4,$5,$6) $$; revoke all on function public.list_customers(uuid,uuid,text,jsonb,integer,text),app_private.list_customers(uuid,uuid,text,jsonb,integer,text) from public,anon,authenticated; grant execute on function public.list_customers(uuid,uuid,text,jsonb,integer,text),app_private.list_customers(uuid,uuid,text,jsonb,integer,text) to authenticated;
create function public.customer_detail(p_org uuid,p_customer uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.customer_detail($1,$2) $$; revoke all on function public.customer_detail(uuid,uuid),app_private.customer_detail(uuid,uuid) from public,anon,authenticated; grant execute on function public.customer_detail(uuid,uuid),app_private.customer_detail(uuid,uuid) to authenticated;
create function public.customer_timeline(p_org uuid,p_customer uuid,p_before timestamptz,p_before_id uuid,p_limit integer) returns jsonb language sql security invoker set search_path='' as $$ select app_private.customer_timeline($1,$2,$3,$4,$5) $$; revoke all on function public.customer_timeline(uuid,uuid,timestamptz,uuid,integer),app_private.customer_timeline(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated; grant execute on function public.customer_timeline(uuid,uuid,timestamptz,uuid,integer),app_private.customer_timeline(uuid,uuid,timestamptz,uuid,integer) to authenticated;
create function public.create_walkin(p_org uuid,p_branch uuid,p_customer uuid,p_customer_data jsonb,p_services uuid[],p_preferred_staff uuid,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.create_walkin($1,$2,$3,$4,$5,$6,$7) $$; revoke all on function public.create_walkin(uuid,uuid,uuid,jsonb,uuid[],uuid,uuid),app_private.create_walkin(uuid,uuid,uuid,jsonb,uuid[],uuid,uuid) from public,anon,authenticated; grant execute on function public.create_walkin(uuid,uuid,uuid,jsonb,uuid[],uuid,uuid),app_private.create_walkin(uuid,uuid,uuid,jsonb,uuid[],uuid,uuid) to authenticated;
create function public.assign_walkin(p_org uuid,p_id uuid,p_staff uuid,p_start timestamptz,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.assign_walkin($1,$2,$3,$4,$5) $$; revoke all on function public.assign_walkin(uuid,uuid,uuid,timestamptz,uuid),app_private.assign_walkin(uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated; grant execute on function public.assign_walkin(uuid,uuid,uuid,timestamptz,uuid),app_private.assign_walkin(uuid,uuid,uuid,timestamptz,uuid) to authenticated;
create function public.close_walkin(p_org uuid,p_id uuid,p_status text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.close_walkin($1,$2,$3,$4) $$; revoke all on function public.close_walkin(uuid,uuid,text,uuid),app_private.close_walkin(uuid,uuid,text,uuid) from public,anon,authenticated; grant execute on function public.close_walkin(uuid,uuid,text,uuid),app_private.close_walkin(uuid,uuid,text,uuid) to authenticated;
create function public.day_status(p_org uuid,p_branch uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.day_status($1,$2) $$; revoke all on function public.day_status(uuid,uuid),app_private.day_status(uuid,uuid) from public,anon,authenticated; grant execute on function public.day_status(uuid,uuid),app_private.day_status(uuid,uuid) to authenticated;
create function public.search_workspace(p_org uuid,p_query text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.search_workspace($1,$2) $$; revoke all on function public.search_workspace(uuid,text),app_private.search_workspace(uuid,text) from public,anon,authenticated; grant execute on function public.search_workspace(uuid,text),app_private.search_workspace(uuid,text) to authenticated;
create function public.remove_schedule_record(p_org uuid,p_entity text,p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.remove_schedule_record($1,$2,$3) $$; revoke all on function public.remove_schedule_record(uuid,text,uuid),app_private.remove_schedule_record(uuid,text,uuid) from public,anon,authenticated; grant execute on function public.remove_schedule_record(uuid,text,uuid),app_private.remove_schedule_record(uuid,text,uuid) to authenticated;
