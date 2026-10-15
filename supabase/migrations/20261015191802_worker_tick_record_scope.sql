-- Loop records must not shadow relation aliases in the loop's own SELECT.
create or replace function app_private.worker_tick(p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_branch record; v_customer record; v_event uuid; v_date date;
begin
 perform app_private.check_gateway(p_secret,'worker');
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
