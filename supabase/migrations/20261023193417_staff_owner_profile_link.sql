-- A professional is a resource; linking one must not demote an organization owner.
-- Preserve the existing authorization, organization lock, MFA, live session and
-- tenant checks in manage_record. No grants or policies are broadened.
do $owner_staff$
declare source text; needle text;
begin
 source := pg_get_functiondef('app_private.manage_record_core(uuid,text,uuid,uuid,jsonb,boolean)'::regprocedure);
 needle := 'if p_entity=''staff'' and p_data->>''profile_id'' is not null and not exists(select 1 from public.organization_memberships where organization_id=p_org and profile_id=(p_data->>''profile_id'')::uuid and role=''barber'' and active) then raise exception ''staff_account_must_be_barber_member'' using errcode=''23514''; end if;';
 if position(needle in source)=0 then raise exception 'staff_profile_guard_mismatch'; end if;
 execute replace(source,needle,
  'if p_entity=''staff'' and p_data->>''profile_id'' is not null and not exists('||
  'select 1 from public.organization_memberships m join public.profiles p on p.id=m.profile_id '||
  'where m.organization_id=p_org and m.profile_id=(p_data->>''profile_id'')::uuid '||
  'and m.role in (''barber'',''organization_owner'') and m.active and p.active) '||
  'then raise exception ''staff_account_must_be_active_owner_or_barber'' using errcode=''23514''; end if;');
end $owner_staff$;
