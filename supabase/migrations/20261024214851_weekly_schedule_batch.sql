-- Coordinate the existing scheduler. No alternate availability engine or tenant data.
create function app_private.save_weekly_schedule(p_org uuid,p_branch uuid,p_staff uuid,p_from date,p_days integer[],p_blocks jsonb,p_expected jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app_private.current_profile();tz text;reply jsonb;old_rows jsonb;versions jsonb;block jsonb;r record;items jsonb:='[]';
begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
 perform app_private.lock_organization(p_org);
 if not app_private.has_org_role(p_org,array['organization_owner','manager']) or not app_private.can_access_branch(p_org,p_branch)
 or not exists(select 1 from public.staff s join public.staff_branch_assignments a on a.organization_id=s.organization_id and a.staff_id=s.id where s.organization_id=p_org and s.id=p_staff and s.active and a.branch_id=p_branch and a.active)
 then raise exception 'forbidden' using errcode='42501';end if;
 select timezone into strict tz from public.branches where organization_id=p_org and id=p_branch;
 if p_key is null or p_from is null or p_days is null or cardinality(p_days) not between 1 and 7 or exists(select 1 from unnest(p_days) d where d is null or d not between 0 and 6)
 or (select count(distinct d) from unnest(p_days) d)<>cardinality(p_days)
 or jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks)>42 or octet_length(p_blocks::text)>8192
 or jsonb_typeof(p_expected) is distinct from 'array' or jsonb_array_length(p_expected)>500 then raise exception 'invalid_weekly_blocks' using errcode='22023';end if;
 -- Recheck live authorization before returning even a prior idempotent response.
 reply:=app_private.idempotency_begin(p_org,actor::text,'weekly_schedule',p_key,jsonb_build_object('branch',p_branch,'staff',p_staff,'from',p_from,'days',p_days,'blocks',p_blocks,'expected',p_expected));
 if reply is not null then return reply;end if;
 if p_from<=(now() at time zone tz)::date or p_from>(now() at time zone tz)::date+366 then raise exception 'prospective_schedule_required' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') into old_rows from public.staff_availability_rules x where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=any(p_days);
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'updated_at',x.updated_at)),'[]') into versions from public.staff_availability_rules x where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=any(p_days);
 if jsonb_array_length(versions)<>jsonb_array_length(p_expected) or exists(select 1 from jsonb_to_recordset(p_expected) e(id uuid,updated_at timestamptz) where not exists(select 1 from public.staff_availability_rules x where x.organization_id=p_org and x.branch_id=p_branch and x.staff_id=p_staff and x.weekday=any(p_days) and x.id=e.id and x.updated_at=e.updated_at))
 or (select count(distinct value->>'id') from jsonb_array_elements(p_expected))<>jsonb_array_length(p_expected) then raise exception 'stale_weekly_schedule' using errcode='40001';end if;
 for block in select value from jsonb_array_elements(p_blocks) loop
  if jsonb_typeof(block) is distinct from 'object' or not block ?& array['weekday','starts_at','ends_at'] or exists(select 1 from jsonb_object_keys(block) k where k not in ('weekday','starts_at','ends_at'))
   or not ((block->>'weekday')::integer=any(p_days)) or block->>'starts_at' is null or block->>'ends_at' is null
   or (block->>'starts_at')::time >= (block->>'ends_at')::time then raise exception 'invalid_weekly_blocks' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_blocks) with ordinality a(v,n) join jsonb_array_elements(p_blocks) with ordinality b(v,n) on a.n<b.n and a.v->>'weekday'=b.v->>'weekday'
  where (a.v->>'starts_at')::time<(b.v->>'ends_at')::time and (b.v->>'starts_at')::time<(a.v->>'ends_at')::time) then raise exception 'invalid_weekly_blocks' using errcode='22023';end if;
 -- Past and current-day history remains queryable. Future-only versions are
 -- superseded with their full rows frozen in the audit event below.
 for r in select id from public.staff_availability_rules where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=any(p_days) and (valid_from is null or valid_from<p_from) and (valid_until is null or valid_until>=p_from) loop
  perform app_private.manage_record_core(p_org,'staff_availability_rules',r.id,p_branch,jsonb_build_object('valid_until',p_from-1),true);
 end loop;
 delete from public.staff_availability_rules where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and weekday=any(p_days) and valid_from>=p_from;
 for block in select value from jsonb_array_elements(p_blocks) loop
  items:=items||jsonb_build_array(app_private.manage_record_core(p_org,'staff_availability_rules',null,p_branch,block||jsonb_build_object('staff_id',p_staff,'valid_from',p_from),true));
 end loop;
 perform app_private.assert_schedule_appointments(p_org,p_branch,p_staff);
 perform app_private.record_audit(p_org,p_branch,'weekly_schedule.replaced','staff',p_staff,jsonb_build_object('effective_from',p_from,'days',p_days,'before',old_rows,'after',items),p_key);
 return app_private.idempotency_finish(p_org,actor::text,'weekly_schedule',p_key,jsonb_build_object('items',items));
end $$;
create function public.save_weekly_schedule(p_org uuid,p_branch uuid,p_staff uuid,p_from date,p_days integer[],p_blocks jsonb,p_expected jsonb,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.save_weekly_schedule($1,$2,$3,$4,$5,$6,$7,$8) $$;
revoke all on function app_private.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid),public.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid),public.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid) to authenticated;

-- Owner-only diagnostic, returns counts/booleans, never factor secrets or Auth
-- identifiers. Other accounts' MFA cannot be checked through listFactors().
create function app_private.setup_team(p_org uuid,p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not app_private.has_org_role(p_org,array['organization_owner']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'owner_required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('staff_id',s.id,'name',s.name,'assigned',exists(select 1 from public.staff_branch_assignments a where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=s.id and a.active),
 'capabilities',(select count(*) from public.staff_service_capabilities c join public.branch_services b on b.organization_id=c.organization_id and b.service_id=c.service_id join public.services v on v.organization_id=b.organization_id and v.id=b.service_id where c.organization_id=p_org and c.staff_id=s.id and b.branch_id=p_branch and b.active and v.active),
 'linked',s.profile_id is not null,'email_confirmed',exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=s.profile_id and u.email_confirmed_at is not null and p.active),
 'membership',exists(select 1 from public.organization_memberships m where m.organization_id=p_org and m.profile_id=s.profile_id and m.active and (m.all_branches or exists(select 1 from public.membership_branch_access mb where mb.organization_id=p_org and mb.membership_id=m.id and mb.branch_id=p_branch))),
 'verified_factors',(select count(*) from auth.mfa_factors f where f.user_id=s.profile_id and f.status='verified')) order by s.name),'[]') into result from public.staff s where s.organization_id=p_org and s.active;
 return jsonb_build_object('people',result,'weekly_editor_supported',true);
end $$;
create function public.setup_team(p_org uuid,p_branch uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.setup_team($1,$2) $$;
revoke all on function app_private.setup_team(uuid,uuid),public.setup_team(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.setup_team(uuid,uuid),public.setup_team(uuid,uuid) to authenticated;

-- Enrich the existing owner diagnostic; only effective_availability decides
-- whether a slot exists. These labels explain the observation, never open slots.
alter function app_private.setup_availability(uuid,uuid,date) rename to setup_availability_before_weekly_editor;
revoke all on function app_private.setup_availability_before_weekly_editor(uuid,uuid,date) from public,anon,authenticated,service_role;
create function app_private.setup_availability(p_org uuid,p_branch uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;person jsonb;people jsonb:='[]';tz text;instant timestamptz:=now();clock time;sid uuid;state text;opened boolean;
begin
 result:=app_private.setup_availability_before_weekly_editor(p_org,p_branch,p_day);
 select timezone into strict tz from public.branches where organization_id=p_org and id=p_branch;
 clock:=(instant at time zone tz)::time;
 for person in select value from jsonb_array_elements(result->'people') loop
  sid:=(person->>'staff_id')::uuid;
  opened:=exists(select 1 from public.branch_business_hours b where b.organization_id=p_org and b.branch_id=p_branch and b.weekday=extract(dow from p_day) and (p_day<>(instant at time zone tz)::date or (b.opens_at<=clock and b.closes_at>clock)))
   or exists(select 1 from public.branch_closures b where b.organization_id=p_org and b.branch_id=p_branch and b.kind='open' and b.starts_at<(p_day+1)::timestamp at time zone tz and b.ends_at>p_day::timestamp at time zone tz and (p_day<>(instant at time zone tz)::date or (b.starts_at<=instant and b.ends_at>instant)));
  if p_day=(instant at time zone tz)::date and app_private.effective_availability(p_org,p_branch,sid,p_day,false,null) @> instant then
   state:=case when app_private.effective_availability(p_org,p_branch,sid,p_day,true,null) @> instant then 'available' else 'exhausted' end;
  elsif not opened then state:='closed';
  elsif p_day=(instant at time zone tz)::date and exists(select 1 from public.staff_unavailability_rules u where u.organization_id=p_org and u.branch_id=p_branch and u.staff_id=sid and u.weekday=extract(dow from p_day) and u.valid_from<=p_day and (u.valid_until is null or u.valid_until>=p_day) and u.starts_at<=clock and u.ends_at>clock) then state:='break';
  elsif p_day=(instant at time zone tz)::date and (exists(select 1 from public.staff_time_off u where u.organization_id=p_org and (u.branch_id is null or u.branch_id=p_branch) and u.staff_id=sid and u.starts_at<=instant and u.ends_at>instant)
   or exists(select 1 from public.staff_availability_exceptions u where u.organization_id=p_org and u.branch_id=p_branch and u.staff_id=sid and u.local_date=p_day and not u.available and u.starts_at<=clock and u.ends_at>clock)
   or exists(select 1 from public.branch_closures u where u.organization_id=p_org and u.branch_id=p_branch and u.kind='closed' and u.starts_at<=instant and u.ends_at>instant)) then state:='blocked';
  elsif p_day=(instant at time zone tz)::date then state:='outside_shift';
  elsif not (person->>'configured')::boolean then state:='not_configured';
  elsif not (person->>'effective')::boolean then state:=case when (person->>'scheduled_today')::boolean then 'blocked' else 'outside_shift' end;
  elsif not (person->>'remaining')::boolean then state:='exhausted';
  else state:='available';end if;
  people:=people||jsonb_build_array(person||jsonb_build_object('state',state));
 end loop;
 return result||jsonb_build_object('people',people);
end $$;
revoke all on function app_private.setup_availability(uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function app_private.setup_availability(uuid,uuid,date) to authenticated;
