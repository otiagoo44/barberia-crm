-- Historical capacity is preserved as source intervals; absent snapshots yield unknown capacity.
create table public.capacity_snapshots(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),branch_id uuid not null,staff_id uuid not null,local_date date not null,
 available_intervals tstzmultirange not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id),
 unique(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),foreign key(organization_id,staff_id) references public.staff(organization_id,id)
);
create index capacity_source_idx on public.capacity_snapshots(organization_id,branch_id,staff_id,local_date,created_at desc);
alter table public.capacity_snapshots enable row level security;
revoke all on public.capacity_snapshots from public,anon,authenticated;
grant select on public.capacity_snapshots to authenticated;
create policy capacity_read on public.capacity_snapshots for select to authenticated using(app_private.can_access_branch(organization_id,branch_id) and app_private.can_read_staff(organization_id,staff_id));
create trigger capacity_append_only before update or delete on public.capacity_snapshots for each row execute function app_private.deny_history_mutation();
alter table public.daily_metrics alter column available_minutes drop not null;
alter table public.daily_service_metrics add column production_value_minor bigint not null default 0,add column priced_completed_count integer not null default 0;
alter table public.automation_jobs add column dedupe_key text;
create unique index jobs_dedupe_idx on public.automation_jobs(organization_id,dedupe_key) where dedupe_key is not null;
-- Recurring availability cannot place the same person in two locations simultaneously.
alter table public.staff_availability_rules add constraint staff_rules_cross_branch_exclusion exclude using gist (
 staff_id with =,branch_id with <>,weekday with =,
 int4range((extract(epoch from starts_at)/60)::integer,(extract(epoch from ends_at)/60)::integer,'[)') with &&,
 daterange(valid_from,case when valid_until is null then null else valid_until+1 end,'[)') with &&
);
create function app_private.compute_metric_day(p_org uuid,p_branch uuid,p_staff uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_tz text; v_capacity integer; v_intervals tstzmultirange; v_result jsonb; begin
 select timezone into v_tz from public.branches where organization_id=p_org and id=p_branch;
 if p_date>=(now() at time zone v_tz)::date then v_intervals:=app_private.effective_availability(p_org,p_branch,p_staff,p_date,false,null);
 else select available_intervals into v_intervals from public.capacity_snapshots where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and local_date=p_date and created_at<((p_date+1)::timestamp at time zone v_tz) order by created_at desc,id desc limit 1; end if;
 if v_intervals is not null then select coalesce(sum(extract(epoch from upper(r)-lower(r))/60),0)::integer into v_capacity from unnest(v_intervals) x(r); end if;
 select jsonb_build_object('appointments_count',count(*),'completed_count',count(*) filter(where status='completed'),'services_completed',coalesce(sum((select count(*) from public.appointment_services s where s.appointment_id=a.id)) filter(where status='completed'),0),'cancelled_count',count(*) filter(where status='cancelled'),'no_show_count',count(*) filter(where status='no_show'),'booked_minutes',coalesce(sum(duration_minutes) filter(where status in ('scheduled','confirmed','checked_in','in_service','completed')),0),'completed_minutes',coalesce(sum(duration_minutes) filter(where status='completed'),0),'available_minutes',v_capacity,'priced_completed_count',count(*) filter(where status='completed' and price_minor is not null),'production_value_minor',coalesce(sum(price_minor) filter(where status='completed'),0),'rebookings_count',count(*) filter(where status='completed' and exists(select 1 from public.appointments next where next.organization_id=p_org and next.rebooked_from_id=a.id and next.status not in ('cancelled','no_show','rescheduled')))) into v_result from public.appointments a where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and starts_at>=p_date::timestamp at time zone v_tz and starts_at<(p_date+1)::timestamp at time zone v_tz;
 return v_result; end $$;
create function app_private.rebuild_metric_day(p_org uuid,p_branch uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
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
 end $$;
create view public.daily_branch_metrics with(security_invoker=true) as select organization_id,branch_id,local_date,sum(appointments_count) appointments_count,sum(completed_count) completed_count,sum(services_completed) services_completed,sum(booked_minutes) booked_minutes,sum(available_minutes) available_minutes,sum(production_value_minor) production_value_minor from public.daily_metrics group by organization_id,branch_id,local_date;
create view public.daily_organization_metrics with(security_invoker=true) as select organization_id,local_date,sum(appointments_count) appointments_count,sum(completed_count) completed_count,sum(services_completed) services_completed,sum(booked_minutes) booked_minutes,sum(available_minutes) available_minutes,sum(production_value_minor) production_value_minor from public.daily_metrics group by organization_id,local_date;
create view public.daily_staff_metrics with(security_invoker=true) as select * from public.daily_metrics;
revoke all on public.daily_branch_metrics,public.daily_organization_metrics,public.daily_staff_metrics from public,anon,authenticated;
grant select on public.daily_branch_metrics,public.daily_organization_metrics,public.daily_staff_metrics to authenticated;
create function app_private.dashboard(p_org uuid,p_branch uuid,p_staff uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 select jsonb_build_object('totals',(select to_jsonb(t)||jsonb_build_object('utilization',case when available_minutes>0 and unknown_capacity_days=0 then round(booked_minutes::numeric/available_minutes*100,1) else null end,'rebooking_rate',case when completed>0 then round(rebookings::numeric/completed*100,1) else null end,'average_priced_ticket_minor',case when priced_completed>0 then round(production_value_minor/priced_completed) else null end) from totals t),
 'by_staff',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.staff_id,s.name,sum((m.metrics->>'completed_count')::bigint) completed,sum((m.metrics->>'booked_minutes')::bigint) booked_minutes,sum((m.metrics->>'available_minutes')::bigint) available_minutes from all_metrics m join public.staff s on s.id=m.staff_id group by m.staff_id,s.name order by completed desc,s.name) q),'[]'::jsonb),
 'by_branch',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.branch_id,b.name,sum((m.metrics->>'completed_count')::bigint) completed,sum((m.metrics->>'booked_minutes')::bigint) booked_minutes,sum((m.metrics->>'available_minutes')::bigint) available_minutes from all_metrics m join public.branches b on b.id=m.branch_id group by m.branch_id,b.name order by completed desc,b.name) q),'[]'::jsonb),
 'by_day',coalesce((select jsonb_agg(to_jsonb(q) order by local_date) from (select local_date,sum((metrics->>'booked_minutes')::bigint) booked_minutes,sum((metrics->>'available_minutes')::bigint) available_minutes,sum((metrics->>'completed_count')::bigint) completed from all_metrics group by local_date) q),'[]'::jsonb),
 'by_service',coalesce((select jsonb_agg(to_jsonb(q)) from (select m.service_id,s.name,sum(m.completed_count) completed from public.daily_service_metrics m join public.services s on s.id=m.service_id where m.organization_id=p_org and m.local_date between p_from and p_to and (p_branch is null or m.branch_id=p_branch) and (p_staff is null or m.staff_id=p_staff) and app_private.can_access_branch(p_org,m.branch_id) and app_private.can_read_staff(p_org,m.staff_id) group by m.service_id,s.name order by completed desc) q),'[]'::jsonb),
 'historical_through',coalesce((select max(local_date) from historical),null),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where g.organization_id=p_org and g.active and g.starts_at<=((p_to+1)::timestamp at time zone 'UTC') and g.ends_at>=p_from::timestamp at time zone 'UTC' and (app_private.has_org_role(p_org,array['organization_owner']) or (g.branch_id is not null and app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,g.branch_id)) or g.staff_id=app_private.current_staff_id(p_org)) and (p_branch is null or g.branch_id=p_branch or g.branch_id is null) and (p_staff is null or g.staff_id=p_staff or g.staff_id is null)),'[]'::jsonb)) into v_result;
 return v_result; end $$;
create function app_private.record_export(p_org uuid,p_branch uuid,p_count integer,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not app_private.has_org_role(p_org,array['organization_owner']) and not (app_private.has_org_role(p_org,array['manager']) and p_branch is not null and app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_count not between 0 and 10000 then raise exception 'invalid_export' using errcode='22023'; end if;
 perform app_private.record_audit(p_org,p_branch,'customers.exported','customers',null,jsonb_build_object('rows',p_count),p_request); return '{"ok":true}'::jsonb; end $$;
create function app_private.claim_jobs(p_secret text,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'worker');
 if p_limit not between 1 and 20 then raise exception 'invalid_limit' using errcode='22023'; end if;
 with claim as (select id from public.automation_jobs where (status in ('pending','retry') and available_at<=now()) or (status='running' and leased_until<now()) order by available_at,id limit p_limit for update skip locked), updated as (
 update public.automation_jobs j set status='running',attempts=attempts+1,leased_until=now()+interval '2 minutes',lease_token=gen_random_uuid() from claim where j.id=claim.id returning j.id,j.lease_token,j.job_type)
 select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into v_result from updated; return v_result; end $$;
create function app_private.process_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.automation_jobs; v_date date; begin
 perform app_private.check_gateway(p_secret,'worker');
 select * into j from public.automation_jobs where id=p_id for update;
 if j.status<>'running' or j.lease_token is distinct from p_lease or j.leased_until<now() then raise exception 'invalid_lease' using errcode='42501'; end if;
 if j.job_type='metrics_rebuild' then
 for v_date in select value::date from jsonb_array_elements_text(coalesce(j.payload->'local_dates','[]')) loop perform app_private.rebuild_metric_day(j.organization_id,j.branch_id,v_date); end loop;
 if j.payload ? 'previous_branch' then perform app_private.rebuild_metric_day(j.organization_id,(j.payload->>'previous_branch')::uuid,(j.payload->>'previous_date')::date); end if;
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
create function app_private.fail_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.check_gateway(p_secret,'worker');
 update public.automation_jobs set status=case when attempts>=max_attempts then 'dead' else 'retry' end,available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer*30)),leased_until=null,lease_token=null,last_error_code='worker_processing_failed' where id=p_id and status='running' and lease_token=p_lease;
 return '{"ok":true}'::jsonb; end $$;
create function app_private.worker_tick(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b record; c record; v_job uuid; v_event uuid; v_date date; begin
 perform app_private.check_gateway(p_secret,'worker');
 for b in select b.id,b.organization_id,b.timezone from public.branches b join public.organizations o on o.id=b.organization_id where b.active and o.active loop
 v_date:=(now() at time zone b.timezone)::date;
 insert into public.automation_jobs(organization_id,branch_id,job_type,payload,dedupe_key) values(b.organization_id,b.id,'metrics_rebuild',jsonb_build_object('local_dates',jsonb_build_array(v_date,v_date-1)),'metrics:'||b.id||':'||date_trunc('hour',now())::text) on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 for c in select c.id,c.organization_id,c.home_branch_id,c.expected_return_at from public.customers c join public.organizations o on o.id=c.organization_id where o.active and c.archived_at is null and not c.do_not_contact and c.expected_return_at<=now() and (c.followup_after is null or c.followup_after<=now()) and not exists(select 1 from public.automation_jobs j where j.organization_id=c.organization_id and j.dedupe_key='retention:'||c.id||':'||c.expected_return_at::text) order by c.expected_return_at limit 100 loop
 insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id) values(c.organization_id,c.home_branch_id,c.id,'customer.due','{}',gen_random_uuid()) returning id into v_event;
 insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload,dedupe_key) values(c.organization_id,c.home_branch_id,v_event,'retention_reminder',jsonb_build_object('customer_id',c.id),'retention:'||c.id||':'||c.expected_return_at::text) on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 delete from app_private.rate_limits where window_start<now()-interval '1 day';
 delete from app_private.idempotency_keys where created_at<now()-interval '30 days';
 return '{"ok":true}'::jsonb; end $$;
create function public.dashboard(p_org uuid,p_branch uuid,p_staff uuid,p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$ select app_private.dashboard($1,$2,$3,$4,$5) $$; revoke all on function public.dashboard(uuid,uuid,uuid,date,date),app_private.dashboard(uuid,uuid,uuid,date,date) from public,anon,authenticated; grant execute on function public.dashboard(uuid,uuid,uuid,date,date),app_private.dashboard(uuid,uuid,uuid,date,date) to authenticated;
create function public.record_export(p_org uuid,p_branch uuid,p_count integer,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.record_export($1,$2,$3,$4) $$; revoke all on function public.record_export(uuid,uuid,integer,uuid),app_private.record_export(uuid,uuid,integer,uuid) from public,anon,authenticated; grant execute on function public.record_export(uuid,uuid,integer,uuid),app_private.record_export(uuid,uuid,integer,uuid) to authenticated;
create function public.claim_jobs(p_secret text,p_limit integer) returns jsonb language sql security invoker set search_path='' as $$ select app_private.claim_jobs($1,$2) $$; revoke all on function public.claim_jobs(text,integer),app_private.claim_jobs(text,integer) from public,anon,authenticated; grant execute on function public.claim_jobs(text,integer),app_private.claim_jobs(text,integer) to anon;
create function public.process_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.process_job($1,$2,$3) $$; revoke all on function public.process_job(text,uuid,uuid),app_private.process_job(text,uuid,uuid) from public,anon,authenticated; grant execute on function public.process_job(text,uuid,uuid),app_private.process_job(text,uuid,uuid) to anon;
create function public.fail_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.fail_job($1,$2,$3) $$; revoke all on function public.fail_job(text,uuid,uuid),app_private.fail_job(text,uuid,uuid) from public,anon,authenticated; grant execute on function public.fail_job(text,uuid,uuid),app_private.fail_job(text,uuid,uuid) to anon;
create function public.worker_tick(p_secret text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.worker_tick($1) $$; revoke all on function public.worker_tick(text),app_private.worker_tick(text) from public,anon,authenticated; grant execute on function public.worker_tick(text),app_private.worker_tick(text) to anon;
revoke all on function app_private.compute_metric_day(uuid,uuid,uuid,date),app_private.rebuild_metric_day(uuid,uuid,date) from public,anon,authenticated;
-- Operational publication only. RLS remains the boundary for authorized subscriptions.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['appointments','walk_in_entries','staff_availability_exceptions','staff_time_off'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop; end if;
end $$;
-- Prevent automatic exposure of future functions and tables.
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges for role postgres in schema app_private revoke execute on functions from public,anon,authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
notify pgrst,'reload schema';
