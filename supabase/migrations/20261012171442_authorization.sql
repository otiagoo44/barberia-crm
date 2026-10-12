-- Authorization is resolved from live memberships, never user_metadata.
create function app_private.current_profile() returns uuid language sql stable security definer set search_path='' as $$ select id from public.profiles where id=(select auth.uid()) and active $$;
create function app_private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from app_private.platform_admins where profile_id=app_private.current_profile()) $$;
create function app_private.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$ select app_private.is_platform_admin() or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=p_org and m.profile_id=app_private.current_profile() and m.active and o.active) $$;
create function app_private.has_org_role(p_org uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$ select app_private.is_platform_admin() or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=p_org and m.profile_id=app_private.current_profile() and m.active and o.active and m.role=any(p_roles)) $$;
create function app_private.current_staff_id(p_org uuid) returns uuid language sql stable security definer set search_path='' as $$ select s.id from public.staff s where s.organization_id=p_org and s.profile_id=app_private.current_profile() and s.active and app_private.has_org_role(p_org,array['barber']) $$;
create function app_private.can_access_branch(p_org uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.is_platform_admin() or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=p_org and m.profile_id=app_private.current_profile() and m.active and o.active and exists(select 1 from public.branches b where b.organization_id=p_org and b.id=p_branch and b.active) and (m.all_branches or exists(select 1 from public.membership_branch_access a where a.organization_id=p_org and a.membership_id=m.id and a.branch_id=p_branch))) $$;
create function app_private.current_organization_id(p_slug text) returns uuid language sql stable security definer set search_path='' as $$ select id from public.organizations where slug=p_slug and app_private.is_org_member(id) $$;
create function app_private.can_operate_branch(p_org uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$ select app_private.has_org_role(p_org,array['organization_owner','manager','receptionist']) and app_private.can_access_branch(p_org,p_branch) $$;
create function app_private.can_read_staff(p_org uuid,p_staff uuid) returns boolean language sql stable security definer set search_path='' as $$ select app_private.has_org_role(p_org,array['organization_owner']) or p_staff=app_private.current_staff_id(p_org) or (app_private.has_org_role(p_org,array['manager','receptionist']) and exists(select 1 from public.staff_branch_assignments a where a.organization_id=p_org and a.staff_id=p_staff and app_private.can_access_branch(p_org,a.branch_id))) $$;
create function app_private.can_read_customer(p_org uuid,p_customer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.has_org_role(p_org,array['organization_owner']) or (
 app_private.has_org_role(p_org,array['manager','receptionist']) and (
 exists(select 1 from public.customers c where c.organization_id=p_org and c.id=p_customer and app_private.can_access_branch(p_org,c.home_branch_id)) or
 exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=p_customer and app_private.can_access_branch(p_org,a.branch_id)) or
 exists(select 1 from public.walk_in_entries w where w.organization_id=p_org and w.customer_id=p_customer and app_private.can_access_branch(p_org,w.branch_id))
 )) or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=p_customer and a.staff_id=app_private.current_staff_id(p_org) and app_private.can_access_branch(p_org,a.branch_id)) $$;
create function app_private.can_read_appointment(p_org uuid,p_appointment uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.appointments a where a.organization_id=p_org and a.id=p_appointment and app_private.can_access_branch(p_org,a.branch_id) and (app_private.has_org_role(p_org,array['organization_owner','manager','receptionist']) or a.staff_id=app_private.current_staff_id(p_org))) $$;
create function app_private.can_read_profile(p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$ select p_profile=app_private.current_profile() or app_private.is_platform_admin() or exists(select 1 from public.organization_memberships m where m.profile_id=p_profile and app_private.has_org_role(m.organization_id,array['organization_owner'])) $$;
create policy profiles_read on public.profiles for select to authenticated using(app_private.can_read_profile(id));
create policy organizations_read on public.organizations for select to authenticated using(app_private.is_org_member(id));
create policy organization_settings_read on public.organization_settings for select to authenticated using(app_private.is_org_member(organization_id));
create policy memberships_read on public.organization_memberships for select to authenticated using(app_private.has_org_role(organization_id,array['organization_owner']) or (profile_id=app_private.current_profile() and active and app_private.is_org_member(organization_id)));
create policy membership_access_read on public.membership_branch_access for select to authenticated using(app_private.has_org_role(organization_id,array['organization_owner']) or exists(select 1 from public.organization_memberships m where m.id=membership_id and m.profile_id=app_private.current_profile() and m.active));
create policy branches_read on public.branches for select to authenticated using(app_private.can_access_branch(organization_id,id));
create policy staff_read on public.staff for select to authenticated using(app_private.can_read_staff(organization_id,id));
create policy customers_read on public.customers for select to authenticated using(app_private.can_read_customer(organization_id,id));
create policy services_read on public.services for select to authenticated using(app_private.is_org_member(organization_id));
create policy appointments_read on public.appointments for select to authenticated using(app_private.can_read_appointment(organization_id,id));
create policy appointment_services_read on public.appointment_services for select to authenticated using(app_private.can_read_appointment(organization_id,appointment_id));
create policy appointment_history_read on public.appointment_status_history for select to authenticated using(app_private.can_read_appointment(organization_id,appointment_id));
create policy capabilities_read on public.staff_service_capabilities for select to authenticated using(app_private.can_read_staff(organization_id,staff_id));
create policy timeoff_read on public.staff_time_off for select to authenticated using(app_private.can_read_staff(organization_id,staff_id) and (branch_id is null or app_private.can_access_branch(organization_id,branch_id)));
create policy goals_read on public.goals for select to authenticated using(
 (app_private.has_org_role(organization_id,array['organization_owner'])) or
 (app_private.has_org_role(organization_id,array['manager']) and branch_id is not null and app_private.can_access_branch(organization_id,branch_id)) or
 (staff_id=app_private.current_staff_id(organization_id) and (branch_id is null or app_private.can_access_branch(organization_id,branch_id))));
create policy notifications_read on public.notifications for select to authenticated using(profile_id=app_private.current_profile() and app_private.is_org_member(organization_id) and (branch_id is null or app_private.can_access_branch(organization_id,branch_id)));
do $$ declare t text; begin
 foreach t in array array['branch_settings','branch_business_hours','branch_closures','branch_services'] loop
  execute format('create policy scoped_read on public.%I for select to authenticated using(app_private.can_access_branch(organization_id,branch_id))',t);
 end loop;
 foreach t in array array['staff_branch_assignments','staff_availability_rules','staff_availability_exceptions','daily_metrics','daily_service_metrics'] loop
  execute format('create policy scoped_read on public.%I for select to authenticated using(app_private.can_access_branch(organization_id,branch_id) and app_private.can_read_staff(organization_id,staff_id))',t);
 end loop;
 foreach t in array array['customer_notes','customer_preferences','customer_tags'] loop
  execute format('create policy customer_read on public.%I for select to authenticated using(app_private.can_read_customer(organization_id,customer_id))',t);
 end loop;
 foreach t in array array['audit_logs','domain_events','automation_jobs'] loop
  execute format($policy$create policy management_read on public.%I for select to authenticated using(app_private.has_org_role(organization_id,array['organization_owner']) or (branch_id is not null and app_private.has_org_role(organization_id,array['manager']) and app_private.can_access_branch(organization_id,branch_id)))$policy$,t);
 end loop;
end $$;
create policy walkins_read on public.walk_in_entries for select to authenticated using(app_private.can_operate_branch(organization_id,branch_id) or (app_private.can_access_branch(organization_id,branch_id) and assigned_staff_id=app_private.current_staff_id(organization_id)));
create view public.visits with(security_invoker=true) as select id,organization_id,branch_id,customer_id,staff_id,starts_at,completed_at,duration_minutes,price_minor,currency from public.appointments where status='completed';
grant select on public.visits to authenticated;
-- Only authorization helpers used in RLS are executable by authenticated users.
revoke all on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.current_profile() to authenticated;
grant execute on function app_private.is_platform_admin() to authenticated;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.has_org_role(uuid,text[]) to authenticated;
grant execute on function app_private.current_staff_id(uuid) to authenticated;
grant execute on function app_private.can_access_branch(uuid,uuid) to authenticated;
grant execute on function app_private.current_organization_id(text) to authenticated;
grant execute on function app_private.can_operate_branch(uuid,uuid) to authenticated;
grant execute on function app_private.can_read_staff(uuid,uuid) to authenticated;
grant execute on function app_private.can_read_customer(uuid,uuid) to authenticated;
grant execute on function app_private.can_read_appointment(uuid,uuid) to authenticated;
grant execute on function app_private.can_read_profile(uuid) to authenticated;
