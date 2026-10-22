-- Batch only coordinates existing domain writes; their conflict checks, RLS,
-- audit and events remain authoritative. No deletion or implicit weekly copy.
-- Extract the existing conflict guard once. A batch validates its final state,
-- rather than rejecting an intermediate morning block before the afternoon is added.
do $extract$
declare source text;signature text;guard text;loop_body text;
begin
 source:=pg_get_functiondef('app_private.manage_record(uuid,text,uuid,uuid,jsonb)'::regprocedure);
 signature:='FUNCTION app_private.manage_record(p_org uuid, p_entity text, p_id uuid, p_branch uuid, p_data jsonb)';
 if position(signature in source)=0 then raise exception 'daily_core_signature_mismatch';end if;
 guard:=substring(source from 'if p_entity in \(''branch_business_hours'',''branch_closures'',''staff_availability_rules'',''staff_availability_exceptions'',''staff_time_off''\) then[\s\S]*?end loop; end if;');
 if guard is null then raise exception 'daily_conflict_guard_mismatch';end if;
 loop_body:=substring(guard from 'for r in[\s\S]*?end loop;');
 execute 'create function app_private.assert_schedule_appointments(p_org uuid,v_branch uuid,v_staff uuid) returns void language plpgsql security invoker set search_path='''' as $body$ declare r record;begin '||loop_body||' end $body$';
 source:=replace(source,signature,'FUNCTION app_private.manage_record_core(p_org uuid, p_entity text, p_id uuid, p_branch uuid, p_data jsonb, p_defer_schedule boolean)');
 source:=replace(source,guard,'if not p_defer_schedule and p_entity in (''branch_business_hours'',''branch_closures'',''staff_availability_rules'',''staff_availability_exceptions'',''staff_time_off'') then perform app_private.assert_schedule_appointments(p_org,v_branch,v_staff);end if;');
 execute source;
end $extract$;
revoke all on function app_private.manage_record_core(uuid,text,uuid,uuid,jsonb,boolean),app_private.assert_schedule_appointments(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create or replace function app_private.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb
language sql security definer set search_path='' as $$ select app_private.manage_record_core($1,$2,$3,$4,$5,false) $$;

create function app_private.save_daily_blocks(p_org uuid,p_branch uuid,p_staff uuid,p_date date,p_blocks jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare block jsonb;actor uuid:=app_private.current_profile();reply jsonb;result jsonb:='[]';
begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
 perform app_private.lock_organization(p_org);
 if not app_private.can_access_branch(p_org,p_branch) or not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501';end if;
 if p_date is null or p_key is null or p_staff is null or jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) not between 1 and 16 or octet_length(p_blocks::text)>8192 then raise exception 'invalid_blocks' using errcode='22023';end if;
 reply:=app_private.idempotency_begin(p_org,actor::text,'daily_blocks',p_key,jsonb_build_object('branch',p_branch,'staff',p_staff,'date',p_date,'blocks',p_blocks));if reply is not null then return reply;end if;
 for block in select value from jsonb_array_elements(p_blocks) loop
  if jsonb_typeof(block) is distinct from 'object' or not (block ?& array['starts_at','ends_at','available'])
  or exists(select 1 from jsonb_object_keys(block) k where k not in ('starts_at','ends_at','available','reason')) then raise exception 'invalid_block_fields' using errcode='22023';end if;
  if not exists(select 1 from public.staff_availability_exceptions where organization_id=p_org and branch_id=p_branch and staff_id=p_staff and local_date=p_date and starts_at=(block->>'starts_at')::time and ends_at=(block->>'ends_at')::time and available=(block->>'available')::boolean) then
   result:=result||jsonb_build_array(app_private.manage_record_core(p_org,'staff_availability_exceptions',null,p_branch,
    block||jsonb_build_object('staff_id',p_staff,'local_date',p_date,'reason',coalesce(block->>'reason','Bloque confirmado para la fecha')),true));
  end if;
 end loop;
 perform app_private.assert_schedule_appointments(p_org,p_branch,p_staff);
 return app_private.idempotency_finish(p_org,actor::text,'daily_blocks',p_key,jsonb_build_object('items',result));
end $$;
create function public.save_daily_blocks(p_org uuid,p_branch uuid,p_staff uuid,p_date date,p_blocks jsonb,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.save_daily_blocks($1,$2,$3,$4,$5,$6) $$;
revoke all on function app_private.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid),public.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid),public.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid) to authenticated;
