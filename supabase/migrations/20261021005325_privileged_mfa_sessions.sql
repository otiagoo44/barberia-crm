-- Forward-only. Supabase Auth owns sessions/factors. Never trust user_metadata.
create function app_private.session_is_live() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
 where s.user_id=(select auth.uid())
 and s.id::text=(select auth.jwt()->>'session_id')
 and (s.not_after is null or s.not_after>now()))
$$;
create function app_private.requires_mfa() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.platform_admins p where p.profile_id=(select auth.uid()))
 or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 where m.profile_id=(select auth.uid()) and m.active and o.active
 and m.role in ('organization_owner','finance','manager'))
 or exists(select 1 from auth.mfa_factors f where f.user_id=(select auth.uid()) and f.status='verified')
$$;
create function app_private.assurance_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.session_is_live() and
 (not app_private.requires_mfa() or coalesce((select auth.jwt()->>'aal'),'aal1')='aal2')
$$;
revoke all on function app_private.session_is_live(),app_private.requires_mfa(),app_private.assurance_allowed() from public,anon,authenticated,service_role;

-- Keep identity readable to enroll/challenge; deny all business privileges at AAL1.
-- Existing helpers still resolve live profile/membership, never platform bypass.
do $gates$
declare target regprocedure; source text;
begin
 foreach target in array array[
 'app_private.is_org_member(uuid)'::regprocedure,
 'app_private.has_org_role(uuid,text[])'::regprocedure,
 'app_private.can_access_branch(uuid,uuid)'::regprocedure,
 'app_private.is_platform_admin()'::regprocedure
 ] loop
  source:=pg_get_functiondef(target);
  if position('SELECT ' in source)=0 and position('select ' in source)=0 then raise exception 'mfa_gate_inventory_mismatch'; end if;
  source:=regexp_replace(source,'\mselect\M','select app_private.assurance_allowed() and','i');
  execute source;
 end loop;
end $gates$;

create function app_private.security_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if app_private.current_profile() is null or not app_private.session_is_live() then
  raise exception 'session_revoked' using errcode='42501';
 end if;
 return jsonb_build_object('required',app_private.requires_mfa(),
 'level',coalesce(auth.jwt()->>'aal','aal1'),
 'allowed',app_private.assurance_allowed());
end $$;
revoke all on function app_private.security_context() from public,anon,authenticated,service_role;
create function public.security_context() returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.security_context() $$;
revoke all on function public.security_context() from public,anon,service_role;
grant execute on function app_private.security_context(),public.security_context() to authenticated;

-- Defense in depth for every exposed business table, including future projections.
-- Own profile remains accessible to authenticate; business RPCs use the gated helpers.
do $policies$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'profiles' loop
  execute format('create policy session_assurance on public.%I as restrictive for all to authenticated using ((select app_private.assurance_allowed())) with check ((select app_private.assurance_allowed()))',t.tablename);
 end loop;
end $policies$;
grant execute on function app_private.assurance_allowed() to authenticated;
comment on function public.security_context() is 'Identity-only MFA/session gate. No tenant data. AAL2 never grants a business role.';
