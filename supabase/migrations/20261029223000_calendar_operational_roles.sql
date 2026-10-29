-- A finance-only membership must not gain an operational export by retaining a
-- former staff link. Keep disconnect/status available to the credential owner.
do $roles$
declare definition text;
begin
 definition:=pg_get_functiondef('app_private.calendar_user(uuid,text,jsonb)'::regprocedure);
 if position(' if p_action=''begin'' then' in definition)=0 then raise exception 'calendar_user_guard_inventory_mismatch'; end if;
 definition:=replace(definition,' if p_action=''begin'' then',
 ' if p_action=''begin'' then
  if not app_private.has_org_role(p_org,array[''organization_owner'',''manager'',''receptionist'',''barber'']) then raise exception ''operational_role_required'' using errcode=''42501''; end if;');
 execute definition;
 definition:=pg_get_functiondef('app_private.calendar_worker(text,text,jsonb)'::regprocedure);
 if position('m.active and' in definition)=0 then raise exception 'calendar_worker_guard_inventory_mismatch'; end if;
 definition:=replace(definition,'m.active and','m.active and m.role in (''organization_owner'',''manager'',''receptionist'',''barber'') and');
 execute definition;
end $roles$;
