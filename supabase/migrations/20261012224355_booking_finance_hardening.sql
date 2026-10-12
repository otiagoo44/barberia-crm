-- Additive website booking contract; catalogue remains authoritative.
alter table public.services add column website_category text check(website_category in ('corte','barba','infantil','cejas','lavado','rulos','tinte','otro'));
alter table public.services add column consultation_required boolean not null default false;
create or replace function app_private.public_catalog(p_secret text,p_slug text,p_branch_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; begin
 perform app_private.check_gateway(p_secret,'booking');
 select o.id into v_org from public.organizations o join public.organization_settings os on os.organization_id=o.id where o.slug=p_slug and o.active and os.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select jsonb_build_object('name',o.name,'slug',o.slug,'logo_url',o.logo_url,'brand_color',o.brand_color,'currency',o.currency,'website_booking_version',1,'branches',
 (select coalesce(jsonb_agg(jsonb_build_object('name',b.name,'slug',b.slug,'address',b.address,'phone',b.phone,'timezone',b.timezone,'services',
 (select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'description',s.description,'duration_minutes',coalesce(bs.duration_minutes,s.default_duration_minutes),'composition_mode',s.composition_mode,'base_service_slug',(select slug from public.services where id=s.base_service_id),'price_minor',bs.price_minor,'website_category',s.website_category,'consultation_required',s.consultation_required) order by s.name),'[]'::jsonb) from public.branch_services bs join public.services s on s.organization_id=bs.organization_id and s.id=bs.service_id where bs.organization_id=v_org and bs.branch_id=b.id and bs.active and s.active),
 'staff',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,'services',(select coalesce(jsonb_agg(sv.slug),'[]'::jsonb) from public.staff_service_capabilities c join public.services sv on sv.id=c.service_id where c.organization_id=v_org and c.staff_id=s.id)) order by s.name),'[]'::jsonb) from public.staff s join public.staff_branch_assignments sa on sa.organization_id=s.organization_id and sa.staff_id=s.id where s.organization_id=v_org and sa.branch_id=b.id and sa.active and s.active)) order by b.name),'[]'::jsonb) from public.branches b join public.branch_settings bs on bs.organization_id=b.organization_id and bs.branch_id=b.id where b.organization_id=v_org and b.active and bs.booking_enabled and (p_branch_slug is null or b.slug=p_branch_slug))) into v_result from public.organizations o where o.id=v_org;
 return v_result; end $$;
create or replace function app_private.resolve_public_request(p_slug text,p_branch_slug text,p_services text[],p_staff_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_branch uuid; v_staff uuid; v_services uuid[]; begin
 if cardinality(p_services) not between 1 and 12 or length(p_slug)>63 or length(p_branch_slug)>63 then raise exception 'invalid_request' using errcode='22023'; end if;
 select o.id,b.id into v_org,v_branch from public.organizations o join public.organization_settings os on os.organization_id=o.id join public.branches b on b.organization_id=o.id join public.branch_settings bs on bs.organization_id=o.id and bs.branch_id=b.id where o.slug=p_slug and b.slug=p_branch_slug and o.active and b.active and os.booking_enabled and bs.booking_enabled;
 if v_org is null then raise exception 'not_found' using errcode='P0002'; end if;
 select array_agg(id order by id) into v_services from public.services where organization_id=v_org and slug=any(p_services) and active;
 if cardinality(v_services) is distinct from cardinality(p_services) then raise exception 'invalid_services' using errcode='22023'; end if;
 if exists(select 1 from public.services where organization_id=v_org and id=any(v_services) and consultation_required) then raise exception 'consultation_required' using errcode='23514'; end if;
 if p_staff_slug is not null then select id into v_staff from public.staff where organization_id=v_org and slug=p_staff_slug and active; if v_staff is null then raise exception 'invalid_staff' using errcode='22023'; end if; end if;
 return jsonb_build_object('organization_id',v_org,'branch_id',v_branch,'staff_id',v_staff,'services',to_jsonb(v_services)); end $$;
create or replace function app_private.manage_membership(p_org uuid,p_email text,p_role text,p_all_branches boolean,p_branches uuid[],p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid; v_member uuid; v_existing public.organization_memberships; v_branch uuid; v_request uuid:=app_private.request_id(); begin
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_role not in ('organization_owner','manager','receptionist','barber','finance') or p_role is null or p_all_branches is null or p_active is null or cardinality(p_branches)>100 then raise exception 'invalid_membership' using errcode='22023'; end if;
 select u.id into v_profile from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(p_email) and p.active;
 if v_profile is null then raise exception 'account_not_registered' using errcode='22023'; end if;
 perform app_private.lock_organization(p_org);
 select * into v_existing from public.organization_memberships where organization_id=p_org and profile_id=v_profile for update;
 if v_existing.role='organization_owner' and v_existing.active and (p_role<>'organization_owner' or not p_active) and (select count(*) from public.organization_memberships where organization_id=p_org and active and role='organization_owner')<=1 then raise exception 'last_owner_required' using errcode='23514'; end if;
 if exists(select 1 from unnest(coalesce(p_branches,'{}'::uuid[])) b where not exists(select 1 from public.branches where organization_id=p_org and id=b and active)) then raise exception 'invalid_branch' using errcode='23503'; end if;
 if p_role in ('organization_owner','finance') then p_all_branches:=true; end if;
 if p_role='manager' then p_all_branches:=false; end if;
 insert into public.organization_memberships(organization_id,profile_id,role,all_branches,active) values(p_org,v_profile,p_role,p_all_branches,p_active) on conflict(organization_id,profile_id) do update set role=excluded.role,all_branches=excluded.all_branches,active=excluded.active returning id into v_member;
 delete from public.membership_branch_access where organization_id=p_org and membership_id=v_member;
 foreach v_branch in array coalesce(p_branches,'{}'::uuid[]) loop
 insert into public.membership_branch_access(organization_id,membership_id,branch_id) values(p_org,v_member,v_branch) on conflict do nothing; end loop;
 perform app_private.record_audit(p_org,null,'membership.changed','organization_memberships',v_member,jsonb_build_object('previous_role',v_existing.role,'role',p_role,'active',p_active,'branches',p_branches,'all_branches',p_all_branches),v_request);
 return jsonb_build_object('id',v_member); end $$;
create or replace function app_private.manage_record(p_org uuid,p_entity text,p_id uuid,p_branch uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allow jsonb:='{"organization_settings":["booking_enabled","booking_horizon_days","booking_lead_minutes","slot_step_minutes","default_return_days","retention_due_soon_days","retention_lapsed_days","barber_can_edit_availability"],"branches":["name","slug","address","phone","timezone","active"],"branch_settings":["booking_enabled"],"branch_business_hours":["weekday","opens_at","closes_at"],"branch_closures":["starts_at","ends_at","kind","reason"],"staff":["name","slug","profile_id","active","color"],"staff_branch_assignments":["staff_id","active"],"services":["name","slug","description","default_duration_minutes","active","category","color","composition_mode","base_service_id","suggested_return_days","requires_maintenance","website_category","consultation_required"],"branch_services":["service_id","active","duration_minutes","price_minor"],"staff_service_capabilities":["staff_id","service_id"],"staff_availability_rules":["staff_id","weekday","starts_at","ends_at","valid_from","valid_until"],"staff_availability_exceptions":["staff_id","local_date","starts_at","ends_at","available","reason"],"staff_time_off":["staff_id","starts_at","ends_at","reason"],"customers":["name","normalized_phone","email","birthday","home_branch_id","preferred_staff_id","return_interval_days","followup_after","do_not_contact","archived_at"],"customer_notes":["customer_id","body"],"customer_preferences":["customer_id","key","value"],"customer_tags":["customer_id","tag"],"goals":["staff_id","name","metric","period","target_value","starts_at","ends_at","active"]}'::jsonb; v_fields text[]; v_cols text; v_values text; v_updates text; v_payload jsonb; v_existing jsonb; v_result jsonb; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_branch uuid; v_owner boolean; v_staff uuid; v_customer uuid; v_goal_tz text; v_request uuid:=app_private.request_id(); r record;
begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501'; end if;
 if not v_allow ? p_entity or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>8192 or p_data='{}'::jsonb then raise exception 'invalid_payload' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where not (v_allow->p_entity) ? k) then raise exception 'invalid_fields' using errcode='22023'; end if;
 perform app_private.lock_organization(p_org);
 if p_id is not null then
 execute format('select to_jsonb(t.*) from public.%I t where id=$1 and organization_id=$2 for update',p_entity) into v_existing using p_id,p_org;
 if v_existing is null then raise exception 'not_found' using errcode='P0002'; end if;
 end if;
 v_branch:=coalesce((v_existing->>'branch_id')::uuid,p_branch);
 if v_existing ? 'branch_id' and (v_existing->>'branch_id')::uuid is distinct from p_branch then raise exception 'branch_immutable' using errcode='23514'; end if;
 if p_entity='branches' then v_branch:=v_id; end if;
 v_staff:=coalesce((p_data->>'staff_id')::uuid,(v_existing->>'staff_id')::uuid);
 if p_data->>'active'='false' and p_entity in ('staff','branches','staff_branch_assignments') and exists(select 1 from public.appointments a where a.organization_id=p_org and a.ends_at>now() and a.status in ('scheduled','confirmed','checked_in','in_service') and (p_entity<>'staff' or a.staff_id=v_id) and (p_entity<>'branches' or a.branch_id=v_id) and (p_entity<>'staff_branch_assignments' or (a.branch_id=v_branch and a.staff_id=v_staff))) then raise exception 'future_bookings_must_be_reassigned' using errcode='23514'; end if;
 if p_entity='goals' then select coalesce((select timezone from public.branches where id=v_branch),o.timezone) into v_goal_tz from public.organizations o where id=p_org; if (p_data->>'starts_at')::timestamptz at time zone v_goal_tz <> date_trunc('day',(p_data->>'starts_at')::timestamptz at time zone v_goal_tz) or (p_data->>'ends_at')::timestamptz at time zone v_goal_tz <> date_trunc('day',(p_data->>'ends_at')::timestamptz at time zone v_goal_tz) then raise exception 'goal_requires_whole_local_days' using errcode='23514'; end if; end if;
 if p_entity='goals' and ((p_data->>'ends_at')::timestamptz-(p_data->>'starts_at')::timestamptz)>interval '366 days' then raise exception 'goal_period_too_long' using errcode='22023'; end if;
 v_owner:=app_private.has_org_role(p_org,array['organization_owner']);
 v_staff:=coalesce((p_data->>'staff_id')::uuid,(v_existing->>'staff_id')::uuid);
 v_customer:=coalesce((p_data->>'customer_id')::uuid,(v_existing->>'customer_id')::uuid);
 if p_entity in ('organization_settings','staff','services','staff_service_capabilities') then
  if not v_owner then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity='branches' then
  if not v_owner and (p_id is null or not app_private.has_org_role(p_org,array['manager']) or not app_private.can_access_branch(p_org,p_id) or p_data ? 'active') then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity in ('customers','customer_notes','customer_preferences','customer_tags') then
  if not v_owner and not app_private.can_operate_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_entity='customers' then
   if p_id is not null and not app_private.can_read_customer(p_org,p_id) then raise exception 'forbidden' using errcode='42501'; end if;
   if not v_owner then
    if p_id is null and not p_data?'home_branch_id' then p_data:=p_data||jsonb_build_object('home_branch_id',p_branch); end if;
    if p_data?'home_branch_id' and not app_private.can_access_branch(p_org,(p_data->>'home_branch_id')::uuid) then raise exception 'forbidden' using errcode='42501'; end if;
   end if;
  elsif not app_private.can_read_customer(p_org,v_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 elsif p_entity in ('staff_availability_rules','staff_availability_exceptions','staff_time_off') then
  if not v_owner and not (app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,v_branch)) and not (v_staff=app_private.current_staff_id(p_org) and app_private.can_access_branch(p_org,v_branch) and exists(select 1 from public.organization_settings where organization_id=p_org and barber_can_edit_availability)) then raise exception 'forbidden' using errcode='42501'; end if;
  if not app_private.can_read_staff(p_org,v_staff) then raise exception 'forbidden' using errcode='42501'; end if;
 else
  if not v_owner and not (app_private.has_org_role(p_org,array['manager']) and app_private.can_access_branch(p_org,v_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 end if;
 if p_entity='staff_branch_assignments' and not v_owner and not app_private.can_read_staff(p_org,v_staff) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_entity='staff' and p_data->>'profile_id' is not null and not exists(select 1 from public.organization_memberships where organization_id=p_org and profile_id=(p_data->>'profile_id')::uuid and role='barber' and active) then raise exception 'staff_account_must_be_barber_member' using errcode='23514'; end if;
 v_payload:=p_data||jsonb_build_object('id',v_id,'organization_id',p_org);
 if p_entity in ('branch_settings','branch_business_hours','branch_closures','staff_branch_assignments','branch_services','staff_availability_rules','staff_availability_exceptions','staff_time_off','customer_notes','goals') then v_payload:=v_payload||jsonb_build_object('branch_id',v_branch); end if;
 select array_agg(k order by k) into v_fields from jsonb_object_keys(v_payload) k;
 select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into v_cols,v_values from unnest(v_fields) k;
 if p_id is null then
 execute format('insert into public.%I as target (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(target.*)',p_entity,v_cols,v_values,p_entity) into v_result using v_payload;
 else
 select string_agg(format('%I=r.%I',k,k),',') into v_updates from jsonb_object_keys(p_data) k;
 execute format('update public.%I as target set %s from jsonb_populate_record(null::public.%I,$1) r where target.id=$2 and target.organization_id=$3 returning to_jsonb(target.*)',p_entity,v_updates,p_entity) into v_result using v_payload,v_id,p_org;
 end if;
 if p_entity='branches' and p_id is null then insert into public.branch_settings(organization_id,branch_id) values(p_org,v_id); end if;
 if p_entity in ('branch_business_hours','branch_closures','staff_availability_rules','staff_availability_exceptions','staff_time_off') then
 for r in select a.* from public.appointments a where a.organization_id=p_org and a.starts_at>=now() and a.status in ('scheduled','confirmed','checked_in','in_service') and (v_branch is null or a.branch_id=v_branch) and (v_staff is null or a.staff_id=v_staff) loop
  if not app_private.effective_availability(p_org,r.branch_id,r.staff_id,(r.starts_at at time zone (select timezone from public.branches where id=r.branch_id))::date,false,null) @> r.during then raise exception 'schedule_conflicts_with_bookings' using errcode='23514'; end if;
 end loop; end if;
 perform app_private.record_audit(p_org,v_branch,p_entity||case when p_id is null then '.created' else '.updated' end,p_entity,v_id,jsonb_build_object('changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_data) k)),v_request);
 if p_entity='customers' and p_id is null then perform app_private.emit_event(p_org,p_branch,v_id,'customer.created','{}',v_request); end if;
 if p_entity in ('staff_availability_rules','staff_availability_exceptions','staff_time_off') then perform app_private.emit_event(p_org,v_branch,v_staff,'staff.availability_changed','{}',v_request); end if;
 return v_result;
end $$;
-- Rules and financial histories also lock tenant currency and the branch timezone.
create function app_private.finance_configuration_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='organizations' then
 if new.currency<>old.currency and (exists(select 1 from public.checkouts where organization_id=old.id) or exists(select 1 from public.expenses where organization_id=old.id) or exists(select 1 from public.cash_sessions where organization_id=old.id)) then raise exception 'currency_locked_after_finance' using errcode='23514';end if;
 elsif tg_table_name='branches' then
 if new.timezone<>old.timezone and (exists(select 1 from public.checkouts where organization_id=old.organization_id and branch_id=old.id) or exists(select 1 from public.expenses where organization_id=old.organization_id and branch_id=old.id) or exists(select 1 from public.cash_sessions where organization_id=old.organization_id and branch_id=old.id)) then raise exception 'timezone_locked_after_finance' using errcode='23514';end if;
 end if;
 return new;end $$;
revoke all on function app_private.finance_configuration_guard() from public,anon,authenticated;
create trigger finance_currency_guard before update on public.organizations for each row execute function app_private.finance_configuration_guard();
create trigger finance_timezone_guard before update on public.branches for each row execute function app_private.finance_configuration_guard();

create policy financial_audit_read on public.audit_logs for select to authenticated using (
 action like 'finance.%' and (app_private.has_org_role(organization_id,array['finance']) or (branch_id is not null and app_private.finance_access(organization_id,branch_id,'report')))
);
create function app_private.finance_child_guard() returns trigger language plpgsql set search_path='' as $$
declare c public.checkouts;p public.payments;begin
 select * into c from public.checkouts where organization_id=new.organization_id and id=new.checkout_id;
 if c.id is null or c.branch_id<>new.branch_id then raise exception 'checkout_branch_mismatch' using errcode='23503';end if;
 if tg_table_name='checkout_lines' then
 if c.status<>'draft' or new.currency<>c.currency then raise exception 'checkout_lines_sealed' using errcode='23514';end if;
 elsif tg_table_name='payments' then
 if new.direction=1 and c.status<>'draft' then raise exception 'posted_payment_sealed' using errcode='23514';end if;
 if new.direction=-1 then select * into p from public.payments where organization_id=new.organization_id and id=new.reversal_of_id;
 if p.direction<>1 or p.checkout_id<>new.checkout_id or p.amount_minor<>new.amount_minor or p.payment_method_id<>new.payment_method_id then raise exception 'invalid_refund_reference' using errcode='23514';end if;end if;
 elsif not exists(select 1 from public.checkout_lines where organization_id=new.organization_id and id=new.checkout_line_id and checkout_id=new.checkout_id and staff_id=new.staff_id and service_id is not distinct from new.service_id) then raise exception 'commission_line_mismatch' using errcode='23503';end if;
 return new;end $$;
revoke all on function app_private.finance_child_guard() from public,anon,authenticated;
create trigger finance_child before insert on public.checkout_lines for each row execute function app_private.finance_child_guard();
create trigger finance_child before insert on public.payments for each row execute function app_private.finance_child_guard();
create trigger finance_child before insert on public.commission_entries for each row execute function app_private.finance_child_guard();
create function app_private.finance_posted_consistency() returns trigger language plpgsql set search_path='' as $$
declare c public.checkouts;checkout uuid;begin
 checkout:=case when tg_table_name='checkouts' then new.id else (to_jsonb(new)->>'checkout_id')::uuid end;
 select * into c from public.checkouts where organization_id=new.organization_id and id=checkout;
 if c.status='posted' and (c.total_minor<>(select coalesce(sum(amount_minor),0) from public.checkout_lines where organization_id=c.organization_id and checkout_id=c.id) or c.total_minor<>(select coalesce(sum(amount_minor*direction),0) from public.payments where organization_id=c.organization_id and checkout_id=c.id)) then raise exception 'posted_checkout_unbalanced' using errcode='23514';end if;
 return null;end $$;
revoke all on function app_private.finance_posted_consistency() from public,anon,authenticated;
create constraint trigger finance_balance after insert or update on public.checkouts deferrable initially deferred for each row execute function app_private.finance_posted_consistency();
create constraint trigger finance_balance after insert on public.payments deferrable initially deferred for each row execute function app_private.finance_posted_consistency();
create constraint trigger finance_balance after insert or update on public.checkout_lines deferrable initially deferred for each row execute function app_private.finance_posted_consistency();
