-- Finance permissions and transaction guards; website contract comes from 20261012210000.
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
