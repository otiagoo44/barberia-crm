-- Reporting is limited to owners, assigned managers and each barber's own data.
-- RECEPTIONIST retains operational agenda access but cannot read report aggregates.
-- Rollback: retain this narrower policy; reverting it would expand access.
do $$ declare t text;p record; begin
  foreach t in array array['daily_metrics','daily_service_metrics','daily_customer_activity','capacity_snapshots'] loop
    for p in select polname from pg_catalog.pg_policy where polrelid=to_regclass('public.'||t) loop
      execute format('drop policy %I on public.%I',p.polname,t);
    end loop;
    execute format('create policy reporting_read on public.%I for select to authenticated using (app_private.has_org_role(organization_id,array[''organization_owner'',''manager'',''barber'']) and app_private.can_access_branch(organization_id,branch_id) and app_private.can_read_staff(organization_id,staff_id))',t);
  end loop;
end $$;
