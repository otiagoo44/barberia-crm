-- Batch only coordinates existing domain writes; their conflict checks, RLS,
-- audit and events remain authoritative. No deletion or implicit weekly copy.
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
   result:=result||jsonb_build_array(app_private.manage_record(p_org,'staff_availability_exceptions',null,p_branch,
    block||jsonb_build_object('staff_id',p_staff,'local_date',p_date,'reason',coalesce(block->>'reason','Bloque confirmado para la fecha'))));
  end if;
 end loop;
 return app_private.idempotency_finish(p_org,actor::text,'daily_blocks',p_key,jsonb_build_object('items',result));
end $$;
create function public.save_daily_blocks(p_org uuid,p_branch uuid,p_staff uuid,p_date date,p_blocks jsonb,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.save_daily_blocks($1,$2,$3,$4,$5,$6) $$;
revoke all on function app_private.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid),public.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid),public.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid) to authenticated;
