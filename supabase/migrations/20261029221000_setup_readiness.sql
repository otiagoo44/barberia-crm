-- Enrich the diagnostic only; authentication/MFA enforcement is unchanged.
alter function app_private.setup_team(uuid,uuid) rename to setup_team_before_calendar;
revoke all on function app_private.setup_team_before_calendar(uuid,uuid) from public,anon,authenticated,service_role;
create function app_private.setup_team(p_org uuid,p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.setup_team_before_calendar(p_org,p_branch);
 return result||jsonb_build_object('people',coalesce((select jsonb_agg(person||jsonb_build_object('mfa_required',
 exists(select 1 from public.staff s join public.organization_memberships m on m.profile_id=s.profile_id join public.organizations o on o.id=m.organization_id and o.active where s.organization_id=p_org and s.id=(person->>'staff_id')::uuid and m.active and m.role in ('organization_owner','finance','manager'))
 or exists(select 1 from public.staff s join app_private.platform_admins a on a.profile_id=s.profile_id where s.organization_id=p_org and s.id=(person->>'staff_id')::uuid)
 or (person->>'verified_factors')::integer>0,
 'password_change_required',exists(
  select 1 from public.staff s join app_private.required_password_changes pc on pc.profile_id=s.profile_id and pc.completed_at is null
  where s.organization_id=p_org and s.id=(person->>'staff_id')::uuid)))
  from jsonb_array_elements(result->'people') person),'[]'::jsonb));
end $$;
revoke all on function app_private.setup_team(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.setup_team(uuid,uuid) to authenticated;
