-- Owner-supplied business rules. Run only after profit_sharing migration.
-- Does not generate sales, shifts, accounts, privileges or historical payments.
begin;
do $setup$
declare org uuid; owner_id uuid; partners uuid[]; previous_claim text;
begin
 select id into strict org from public.organizations where slug='1717-barberia' and active;
 perform app_private.lock_organization(org);
 select array_agg(id order by id) into partners from public.staff
 where organization_id=org and active and slug in ('jonatan','esteban');
 if cardinality(partners) is distinct from 2 then raise exception 'Two confirmed partners required'; end if;
 select m.profile_id into owner_id from public.organization_memberships m join public.profiles p on p.id=m.profile_id
 where m.organization_id=org and m.active and m.role='organization_owner' and p.active order by m.created_at limit 1;
 if owner_id is null then raise exception 'Active owner required'; end if;
 previous_claim:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.finance_command(org,null,'configure_settings',jsonb_build_object('remuneration_model','equal_profit_share','profit_share_staff_ids',partners),gen_random_uuid());
 insert into public.staff_service_capabilities(organization_id,staff_id,service_id)
 select org,s.id,v.id from public.staff s cross join public.services v
 where s.organization_id=org and v.organization_id=org and s.id=any(partners) and v.active
 on conflict do nothing;
 perform app_private.record_audit(org,null,'staff.capabilities_confirmed','organizations',org,
 jsonb_build_object('source','Owner: both partners provide all services; availability entered per day'),gen_random_uuid());
 perform set_config('request.jwt.claim.sub',coalesce(previous_claim,''),true);
end $setup$;
commit;
