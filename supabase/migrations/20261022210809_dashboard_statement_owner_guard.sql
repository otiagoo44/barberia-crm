-- Lift only the uniform owner arm of can_read_customer into a statement initPlan.
-- That arm already authorizes every customer of the queried organization.
-- Its live profile/membership/organization/MFA/session checks still run in this
-- statement; no cross-request cache and no policy/grant/financial changes.
-- Non-owner rows retain the original can_read_customer predicate unchanged.
do $dashboard_guard$
declare source text; helper text; needle text; occurrences integer;
begin
  helper := pg_get_functiondef('app_private.can_read_customer(uuid,uuid)'::regprocedure);
  if position('app_private.has_org_role(p_org,array[''organization_owner'']) or' in helper)=0 then
    raise exception 'owner_customer_guard_mismatch';
  end if;
  source := pg_get_functiondef('app_private.dashboard(uuid,uuid,uuid,date,date)'::regprocedure);
  needle := 'and app_private.can_read_customer(p_org,c.id)';
  occurrences := (length(source)-length(replace(source,needle,'')))/length(needle);
  if occurrences <> 2 then raise exception 'dashboard_customer_projection_mismatch'; end if;
  execute replace(source,needle,
    'and ((select app_private.has_org_role(p_org,array[''organization_owner''])) or app_private.can_read_customer(p_org,c.id))');
end $dashboard_guard$;
