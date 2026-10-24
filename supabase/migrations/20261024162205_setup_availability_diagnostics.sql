-- Explicit business safeguards; empty for every tenant until an authorized plan
-- records them. An available override cannot reopen a confirmed weekly break.
create table public.staff_unavailability_rules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 branch_id uuid not null, staff_id uuid not null, weekday integer not null check(weekday between 0 and 6),
 starts_at time not null, ends_at time not null check(ends_at>starts_at),
 valid_from date not null, valid_until date check(valid_until is null or valid_until>=valid_from),
 reason text not null check(length(btrim(reason)) between 5 and 250),
 created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),
 unique(organization_id,branch_id,staff_id,weekday,starts_at,valid_from),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,staff_id) references public.staff(organization_id,id)
);
alter table public.staff_unavailability_rules enable row level security;
revoke all on public.staff_unavailability_rules from public,anon,authenticated,service_role;
grant select on public.staff_unavailability_rules to authenticated;
create policy schedule_read on public.staff_unavailability_rules for select to authenticated using(app_private.has_org_role(organization_id,array['organization_owner','manager']) and app_private.can_access_branch(organization_id,branch_id));
create trigger append_only before update or delete on public.staff_unavailability_rules for each row execute function app_private.deny_history_mutation();
alter function app_private.effective_availability(uuid,uuid,uuid,date,boolean,uuid) rename to effective_availability_without_safeguards;
revoke all on function app_private.effective_availability_without_safeguards(uuid,uuid,uuid,date,boolean,uuid) from public,anon,authenticated,service_role;
create function app_private.effective_availability(p_org uuid,p_branch uuid,p_staff uuid,p_date date,p_subtract_bookings boolean default true,p_exclude uuid default null) returns tstzmultirange
language plpgsql stable security definer set search_path='' as $$
declare result tstzmultirange; blocked tstzmultirange; tz text;
begin
 result:=app_private.effective_availability_without_safeguards(p_org,p_branch,p_staff,p_date,p_subtract_bookings,p_exclude);
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 select coalesce(range_agg(tstzrange((p_date+starts_at) at time zone tz,(p_date+ends_at) at time zone tz,'[)')),'{}'::tstzmultirange) into blocked
 from public.staff_unavailability_rules where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=extract(dow from p_date) and valid_from<=p_date and (valid_until is null or valid_until>=p_date);
 return result-blocked;
end $$;
revoke all on function app_private.effective_availability(uuid,uuid,uuid,date,boolean,uuid) from public,anon,authenticated,service_role;

-- Read the same interval engine used by booking; exceptions are not the schedule.
create function app_private.setup_availability(p_org uuid,p_branch uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare people jsonb;
begin
 if not app_private.has_org_role(p_org,array['organization_owner']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'owner_required' using errcode='42501';end if;
 if p_day is null then raise exception 'day_required' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('staff_id',s.id,
 'configured',exists(select 1 from public.staff_availability_rules r where r.organization_id=p_org and r.branch_id=p_branch and r.staff_id=s.id and (r.valid_until is null or r.valid_until>=p_day))
 or exists(select 1 from public.staff_availability_exceptions e where e.organization_id=p_org and e.branch_id=p_branch and e.staff_id=s.id and e.local_date>=p_day and e.available),
 'scheduled_today',exists(select 1 from public.staff_availability_rules r where r.organization_id=p_org and r.branch_id=p_branch and r.staff_id=s.id and r.weekday=extract(dow from p_day) and (r.valid_from is null or r.valid_from<=p_day) and (r.valid_until is null or r.valid_until>=p_day))
 or exists(select 1 from public.staff_availability_exceptions e where e.organization_id=p_org and e.branch_id=p_branch and e.staff_id=s.id and e.local_date=p_day and e.available),
 'effective',app_private.effective_availability(p_org,p_branch,s.id,p_day,false,null)<>'{}'::tstzmultirange,
 'remaining',app_private.effective_availability(p_org,p_branch,s.id,p_day,true,null)<>'{}'::tstzmultirange) order by s.id),'[]') into people
 from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id
 where s.organization_id=p_org and a.branch_id=p_branch and s.active and a.active;
 return jsonb_build_object('day',p_day,'people',people);
end $$;
create function public.setup_availability(p_org uuid,p_branch uuid,p_day date) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.setup_availability($1,$2,$3) $$;
revoke all on function public.setup_availability(uuid,uuid,date),app_private.setup_availability(uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.setup_availability(uuid,uuid,date),app_private.setup_availability(uuid,uuid,date) to authenticated;

-- Manual transitions retain the state machine. Only enrich audit evidence;
-- no cron, fee, cancellation or new no-show rule is introduced.
do $arrival_audit$
declare source text; needle text;
begin
 source:=pg_get_functiondef('app_private.transition_booking(uuid,uuid,text,uuid,text)'::regprocedure);
 needle:='jsonb_build_object(''from'',a.status,''to'',p_status),v_request';
 if position(needle in source)=0 then raise exception 'arrival_audit_definition_mismatch';end if;
 execute replace(source,needle,'jsonb_build_object(''from'',a.status,''to'',p_status,''manual'',true,''late_minutes'',case when p_status=''checked_in'' then greatest(floor(extract(epoch from (now()-a.starts_at))/60)::integer,0) else null end),v_request');
end $arrival_audit$;
