-- Separate gateway authentication from private, owner-only worker operations.
-- Public RPCs retain their existing secrets and grants. No client can call the core.
create or replace function app_private.worker_tick_core() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_branch record; v_customer record; v_event uuid; v_date date;
begin

 for v_branch in
  select b.id,b.organization_id,b.timezone from public.branches b
  join public.organizations o on o.id=b.organization_id
  where b.active and o.active and not exists(
   select 1 from public.automation_jobs j where j.organization_id=b.organization_id
   and j.dedupe_key='metrics:'||b.id||':'||date_trunc('hour',now())::text
  ) order by b.organization_id,b.id limit 200
 loop
  v_date:=(now() at time zone v_branch.timezone)::date;
  insert into public.automation_jobs(organization_id,branch_id,job_type,payload,dedupe_key)
  values(v_branch.organization_id,v_branch.id,'metrics_rebuild',jsonb_build_object('local_dates',jsonb_build_array(v_date,v_date-1)),
   'metrics:'||v_branch.id||':'||date_trunc('hour',now())::text)
  on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 for v_customer in
  select c.id,c.organization_id,c.home_branch_id,c.expected_return_at from public.customers c
  join public.organizations o on o.id=c.organization_id
  where o.active and c.archived_at is null and not c.do_not_contact and c.expected_return_at<=now()
  and (c.followup_after is null or c.followup_after<=now()) and not exists(
   select 1 from public.automation_jobs j where j.organization_id=c.organization_id
   and j.dedupe_key='retention:'||c.id||':'||c.expected_return_at::text
  ) order by c.expected_return_at limit 100
 loop
  perform app_private.lock_organization(v_customer.organization_id);
  if exists(select 1 from public.automation_jobs where organization_id=v_customer.organization_id
   and dedupe_key='retention:'||v_customer.id||':'||v_customer.expected_return_at::text) then continue; end if;
  insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id)
  values(v_customer.organization_id,v_customer.home_branch_id,v_customer.id,'customer.due','{}',gen_random_uuid()) returning id into v_event;
  insert into public.automation_jobs(organization_id,branch_id,event_id,job_type,payload,dedupe_key)
  values(v_customer.organization_id,v_customer.home_branch_id,v_event,'retention_reminder',jsonb_build_object('customer_id',v_customer.id),
   'retention:'||v_customer.id||':'||v_customer.expected_return_at::text)
  on conflict(organization_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 delete from app_private.rate_limits where window_start<now()-interval '1 day';
 delete from app_private.idempotency_keys where created_at<now()-interval '30 days';
 return '{"ok":true}'::jsonb;
end $$;
revoke all on function app_private.worker_tick_core() from public,anon,authenticated,service_role;
create or replace function app_private.worker_tick(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.check_gateway(p_secret,'worker');
 return app_private.worker_tick_core();
end $$;

create or replace function app_private.claim_jobs_core(p_limit integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb; begin

 if p_limit not between 1 and 20 then raise exception 'invalid_limit' using errcode='22023'; end if;
 update public.automation_jobs set status='dead',leased_until=null,lease_token=null,last_error_code='attempts_exhausted' where attempts>=max_attempts and (status in ('pending','retry') or (status='running' and leased_until<now()));
 with claim as (select id from public.automation_jobs where attempts<max_attempts and ((status in ('pending','retry') and available_at<=now()) or (status='running' and leased_until<now())) order by available_at,id limit p_limit for update skip locked), updated as (
 update public.automation_jobs j set status='running',attempts=attempts+1,leased_until=now()+interval '2 minutes',lease_token=gen_random_uuid() from claim where j.id=claim.id returning j.id,j.lease_token,j.job_type)
 select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into v_result from updated; return v_result; end $$;
revoke all on function app_private.claim_jobs_core(integer) from public,anon,authenticated,service_role;
create or replace function app_private.claim_jobs(p_secret text,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.check_gateway(p_secret,'worker');
 return app_private.claim_jobs_core(p_limit);
end $$;

create or replace function app_private.process_job_core(p_id uuid,p_lease uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.automation_jobs; v_date date; begin

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
revoke all on function app_private.process_job_core(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function app_private.process_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.check_gateway(p_secret,'worker');
 return app_private.process_job_core(p_id,p_lease);
end $$;

create function app_private.fail_job_core(p_id uuid,p_lease uuid) returns jsonb language plpgsql security invoker set search_path='' as $$ begin

 update public.automation_jobs set status=case when attempts>=max_attempts then 'dead' else 'retry' end,available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer*30)),leased_until=null,lease_token=null,last_error_code='worker_processing_failed' where id=p_id and status='running' and lease_token=p_lease;
 return '{"ok":true}'::jsonb; end $$;
revoke all on function app_private.fail_job_core(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function app_private.fail_job(p_secret text,p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.check_gateway(p_secret,'worker');
 return app_private.fail_job_core(p_id,p_lease);
end $$;

create function app_private.run_scheduled_jobs() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job jsonb; result jsonb; completed integer:=0; failed integer:=0; awaiting integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('barberia:scheduled-worker',0)) then
  return '{"skipped":true}'::jsonb;
 end if;
 perform app_private.worker_tick_core();
 for job in select value from jsonb_array_elements(app_private.claim_jobs_core(20)) loop
  begin
   result:=app_private.process_job_core((job->>'id')::uuid,(job->>'lease_token')::uuid);
   if result->>'status'='awaiting_configuration' then awaiting:=awaiting+1; else completed:=completed+1; end if;
  exception when others then
   failed:=failed+1;
   perform app_private.fail_job_core((job->>'id')::uuid,(job->>'lease_token')::uuid);
  end;
 end loop;
 return jsonb_build_object('completed',completed,'failed',failed,'awaiting_configuration',awaiting);
end $$;
revoke all on function app_private.run_scheduled_jobs() from public,anon,authenticated,service_role;
comment on function app_private.run_scheduled_jobs() is 'Owner-only pg_cron entrypoint; no public API, gateway secret or external provider credentials.';
