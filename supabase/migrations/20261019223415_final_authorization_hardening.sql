-- Forward-only hardening. No business data or executed migrations are rewritten.
-- Outbox references must carry the tenant even under accidental privileged SQL.
alter table public.automation_jobs add constraint automation_jobs_tenant_event_fk
 foreign key(organization_id,event_id) references public.domain_events(organization_id,id) not valid;
alter table public.notifications add constraint notifications_tenant_event_fk
 foreign key(organization_id,event_id) references public.domain_events(organization_id,id) not valid;
alter table public.automation_jobs validate constraint automation_jobs_tenant_event_fk;
alter table public.notifications validate constraint notifications_tenant_event_fk;
alter table public.automation_jobs drop constraint automation_jobs_event_id_fkey;
alter table public.notifications drop constraint notifications_event_id_fkey;
create index automation_jobs_tenant_event_idx on public.automation_jobs(organization_id,event_id);
create index notifications_tenant_event_idx on public.notifications(organization_id,event_id);

-- Platform status grants bootstrap/support, never implicit tenant membership.
create or replace function app_private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m
 join public.organizations o on o.id=m.organization_id
 where m.organization_id=p_org and m.profile_id=app_private.current_profile()
 and m.active and o.active)
$$;
create or replace function app_private.has_org_role(p_org uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m
 join public.organizations o on o.id=m.organization_id
 where m.organization_id=p_org and m.profile_id=app_private.current_profile()
 and m.active and o.active and m.role=any(p_roles))
$$;
create or replace function app_private.can_access_branch(p_org uuid,p_branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m
 join public.organizations o on o.id=m.organization_id
 where m.organization_id=p_org and m.profile_id=app_private.current_profile()
 and m.active and o.active
 and exists(select 1 from public.branches b where b.organization_id=p_org and b.id=p_branch)
 and (m.all_branches or exists(select 1 from public.membership_branch_access a
 where a.organization_id=p_org and a.membership_id=m.id and a.branch_id=p_branch)))
$$;
create or replace function app_private.can_read_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_profile=app_private.current_profile() or exists(
 select 1 from public.organization_memberships m where m.profile_id=p_profile
 and app_private.has_org_role(m.organization_id,array['organization_owner']))
$$;
create or replace function app_private.finance_access(p_org uuid,p_branch uuid,p_level text default 'report') returns boolean
language sql stable security definer set search_path='' as $$
 select p_level in ('report','operate') and app_private.is_org_member(p_org)
 and (p_branch is null or app_private.can_access_branch(p_org,p_branch))
 and (app_private.has_org_role(p_org,array['organization_owner','finance']) or
 (p_branch is not null and (app_private.has_org_role(p_org,array['manager']) or
 (p_level='operate' and app_private.has_org_role(p_org,array['receptionist'])))))
$$;
-- Catalog read models already omit settings for these roles; enforce at direct SELECT too.
drop policy finance_catalog_read on public.finance_settings;
create policy finance_settings_read on public.finance_settings for select to authenticated
using(app_private.has_org_role(organization_id,array['organization_owner','finance']));
-- Platform bootstrap evidence has no tenant and remains visible to platform admins.
-- Tenant audit records still require ordinary membership and business scope.
alter policy management_read on public.audit_logs using (
 (organization_id is null and app_private.is_platform_admin())
 or app_private.has_org_role(organization_id,array['organization_owner'])
 or (branch_id is not null and app_private.has_org_role(organization_id,array['manager'])
     and app_private.can_access_branch(organization_id,branch_id))
 or (action like 'finance.%' and
     ((branch_id is null and app_private.has_org_role(organization_id,array['finance']))
      or (branch_id is not null and app_private.finance_access(organization_id,branch_id,'report'))))
);

-- An explicit, read-only support operation. No names, customers, staff, money,
-- membership grants or arbitrary queries. Every successful access requires a ticket.
create function app_private.platform_support_snapshot(p_org uuid,p_branch uuid,p_ticket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not app_private.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_ticket is null or length(btrim(p_ticket)) not between 3 and 200 then
  raise exception 'support_ticket_required' using errcode='22023'; end if;
 select jsonb_build_object('organization_id',o.id,'organization_active',o.active,
  'branch_id',b.id,'branch_active',b.active,'booking_enabled',s.booking_enabled,
  'pending_jobs',(select count(*) from public.automation_jobs j where j.organization_id=o.id
    and j.branch_id=b.id and j.status in ('pending','retry','running')),
  'dead_jobs',(select count(*) from public.automation_jobs j where j.organization_id=o.id
    and j.branch_id=b.id and j.status='dead')) into result
 from public.organizations o join public.branches b on b.organization_id=o.id
 join public.branch_settings s on s.organization_id=o.id and s.branch_id=b.id
 where o.id=p_org and b.id=p_branch;
 if result is null then raise exception 'not_found' using errcode='P0002'; end if;
 perform app_private.record_audit(p_org,p_branch,'platform.support_snapshot','branches',p_branch,
  jsonb_build_object('ticket',btrim(p_ticket),'projection','operational_health_v1'),app_private.request_id());
 return result;
end $$;
revoke all on function app_private.platform_support_snapshot(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function app_private.platform_support_snapshot(uuid,uuid,text) to authenticated;
create function public.platform_support_snapshot(p_org uuid,p_branch uuid,p_ticket text) returns jsonb
language sql security invoker set search_path='' as $$
 select app_private.platform_support_snapshot($1,$2,$3)
$$;
revoke all on function public.platform_support_snapshot(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_support_snapshot(uuid,uuid,text) to authenticated;

-- Guarded source extensions preserve the deployed profit-sharing and worker paths.
-- A mismatch aborts the migration instead of silently dropping existing behavior.
do $hardening$
declare source text; original text; replacement text; target regprocedure;
begin
 target:='app_private.manage_membership(uuid,text,text,boolean,uuid[],boolean)'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$if p_role in ('organization_owner','finance') then p_all_branches:=true; end if;$old$;
 replacement:=$new$if p_role='organization_owner' then p_all_branches:=true; end if;$new$;
 if position(original in source)=0 then raise exception 'finance_membership_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 target:='app_private.finance_command(uuid,uuid,text,jsonb,uuid)'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$if p_action in ('configure','configure_settings') then$old$;
 replacement:=$new$if p_branch is not null and not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action in ('configure','configure_settings') then$new$;
 if position(original in source)=0 then raise exception 'finance_command_scope_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 target:='app_private.worker_tick_core()'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$delete from app_private.idempotency_keys where created_at<now()-interval '30 days';$old$;
 replacement:=$new$delete from app_private.idempotency_keys where created_at<now()-interval '30 days' and operation not like 'finance.%';$new$;
 if position(original in source)=0 then raise exception 'worker_retention_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 target:='app_private.process_job_core(uuid,uuid)'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$if j.status<>'running' or j.lease_token is distinct from p_lease or j.leased_until<now() then$old$;
 replacement:=$new$if j.id is null or p_lease is null or j.leased_until is null or j.status<>'running' or j.lease_token is distinct from p_lease or j.leased_until<=now() then$new$;
 if position(original in source)=0 then raise exception 'worker_lease_patch_mismatch'; end if;
 execute replace(source,original,replacement);

 foreach target in array array[
  'app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid)'::regprocedure,
  'app_private.list_customers(uuid,uuid,text,jsonb,integer,text)'::regprocedure,
  'app_private.customer_timeline(uuid,uuid,timestamptz,uuid,integer)'::regprocedure,
  'app_private.claim_jobs_core(integer)'::regprocedure
 ] loop
  source:=pg_get_functiondef(target);
  if position('p_limit not between' in source)=0 then raise exception 'limit_patch_mismatch: %',target; end if;
  execute replace(source,'p_limit not between','p_limit is null or p_limit not between');
 end loop;
 target:='app_private.finance_read(uuid,uuid,text,date,date,integer,integer,text,uuid)'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$if p_branch is null or$old$;
 replacement:=$new$if p_from is null or p_to is null or p_offset is null or p_query is null or p_view is null or p_branch is null or$new$;
 if position(original in source)=0 then raise exception 'finance_bounds_patch_mismatch'; end if;
 execute replace(source,original,replacement);
 target:='app_private.dashboard(uuid,uuid,uuid,date,date)'::regprocedure;
 source:=pg_get_functiondef(target);
 if position('if p_to<p_from' in source)=0 then raise exception 'dashboard_bounds_patch_mismatch'; end if;
 execute replace(source,'if p_to<p_from','if p_from is null or p_to is null or p_to<p_from');
 target:='app_private.list_agenda(uuid,uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone)'::regprocedure;
 source:=pg_get_functiondef(target);
 if position('if not app_private.can_access_branch' in source)=0 then raise exception 'agenda_bounds_patch_mismatch'; end if;
 execute replace(source,'if not app_private.can_access_branch','if p_from is null or p_to is null or not app_private.can_access_branch');

 target:='app_private.finance_import(uuid,uuid,text,jsonb,uuid)'::regprocedure;
 source:=pg_get_functiondef(target);
 original:=$old$if actor is null or not app_private.has_org_role(p_org,array['organization_owner','finance']) or$old$;
 replacement:=$new$if actor is null or not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch) or$new$;
 if position(original in source)=0 then raise exception 'import_scope_patch_mismatch'; end if;
 source:=replace(source,original,replacement);
 original:=$old$for row_data in select value from jsonb_array_elements(p_data->'rows') loop$old$;
 replacement:=$new$-- Omitted rows retain provenance, but cannot become movements on confirmation.
 update public.finance_import_rows set review_status='EXCLUDED',
 anomalies=anomalies||'["OMITTED_FROM_PREVIEW"]'::jsonb
 where organization_id=p_org and batch_id=batch.id and review_status<>'EXCLUDED';
 for row_data in select value from jsonb_array_elements(p_data->'rows') loop$new$;
 if position(original in source)=0 then raise exception 'import_preview_patch_mismatch'; end if;
 source:=replace(source,original,replacement);
 original:=$old$batch.preview_hash<>p_data->>'preview_hash'$old$;
 replacement:=$new$batch.preview_hash is distinct from p_data->>'preview_hash'$new$;
 if position(original in source)=0 then raise exception 'import_hash_patch_mismatch'; end if;
 execute replace(source,original,replacement);
end $hardening$;

-- Serialize authorization with membership/branch changes. Cheap preflight rejects
-- unrelated actors; all action/record/branch checks run again AFTER the lock.
-- The public booking engine keeps its separately authenticated gateway path.
do $serialization$
declare target regprocedure; source text; changed text; count_functions integer:=0;
begin
 for target in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='app_private' and p.proname=any(array[
 'update_organization','manage_membership','manage_record','create_booking',
 'reschedule_booking','transition_booking','create_walkin','assign_walkin',
 'close_walkin','finance_command','finance_import'
 ]) loop
  source:=pg_get_functiondef(target);
  if position('p_org uuid' in source)=0 or source !~* '\mbegin\M' then
   raise exception 'authorization_serialization_patch_mismatch: %',target; end if;
  -- Remove previous placements; reentrant locks in nested helpers remain safe.
  changed:=replace(source,'perform app_private.lock_organization(p_org);','');
  changed:=regexp_replace(changed,'\mbegin\M',
   E'begin\n if not app_private.is_org_member(p_org) then raise exception ''forbidden'' using errcode=''42501''; end if;\n perform app_private.lock_organization(p_org);','i');
  if changed=source then raise exception 'authorization_serialization_noop: %',target; end if;
  execute changed;
  count_functions:=count_functions+1;
 end loop;
 if count_functions<>11 then raise exception 'authorization_serialization_inventory_mismatch'; end if;
end $serialization$;
comment on function app_private.worker_tick_core() is 'Financial idempotency keys have durable retention; other keys expire after 30 days. Never prune finance keys without a durable replacement dedupe ledger.';
