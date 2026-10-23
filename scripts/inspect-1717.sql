-- Read-only evidence. Explicit target must be tbcfhagteyqufjkmbxzz.
begin read only;
select version,name from supabase_migrations.schema_migrations order by version;
select o.id,o.name,o.slug,o.timezone,o.currency,o.active,
       b.id branch_id,b.name branch,b.slug branch_slug,b.address,b.phone,b.timezone branch_timezone,
       s.booking_enabled,s.booking_lead_minutes,bs.booking_enabled branch_booking_enabled
from public.organizations o join public.branches b on b.organization_id=o.id
join public.organization_settings s on s.organization_id=o.id
join public.branch_settings bs on bs.organization_id=o.id and bs.branch_id=b.id
where o.slug='1717-barberia' and b.slug='luque';
select s.id,s.slug,s.name,s.active,s.profile_id,a.branch_id,a.active assignment_active
from public.staff s join public.organizations o on o.id=s.organization_id
left join public.staff_branch_assignments a on a.organization_id=o.id and a.staff_id=s.id
where o.slug='1717-barberia';
select s.slug,s.name,s.default_duration_minutes,s.composition_mode,s.base_service_id,
       s.consultation_required,s.website_category,bs.price_minor,bs.duration_minutes,bs.active
from public.services s join public.organizations o on o.id=s.organization_id
left join public.branch_services bs on bs.organization_id=o.id and bs.service_id=s.id
where o.slug='1717-barberia' order by s.slug;
select 'weekly' kind,to_jsonb(r) configuration from public.staff_availability_rules r
join public.organizations o on o.id=r.organization_id where o.slug='1717-barberia'
union all select 'exception',to_jsonb(r) from public.staff_availability_exceptions r
join public.organizations o on o.id=r.organization_id where o.slug='1717-barberia'
union all select 'business_hours',to_jsonb(r) from public.branch_business_hours r
join public.organizations o on o.id=r.organization_id where o.slug='1717-barberia';
select m.code,r.percentage_bps,r.fixed_amount_minor,r.effective_from,r.effective_to,r.evidence_reference
from public.payment_methods m join public.organizations o on o.id=m.organization_id
left join public.payment_method_fee_rules r on r.organization_id=o.id and r.payment_method_id=m.id
where o.slug='1717-barberia' order by m.code,r.effective_from;
select f.remuneration_model,f.profit_share_staff_ids,f.advances_deductible
from public.finance_settings f join public.organizations o on o.id=f.organization_id where o.slug='1717-barberia';
select p.version,p.enabled,p.periodicity,p.approval_role,p.withdrawals_mode,p.losses_reference
from public.partner_distribution_policies p join public.organizations o on o.id=p.organization_id
where o.slug='1717-barberia' order by p.version;
-- Only the two confirmed accounts; no secrets or unrelated customer data.
select c.email,u.id,u.email_confirmed_at is not null email_confirmed,p.active profile_active,
       m.role,m.active membership_active,m.all_branches,
       (select count(*) from auth.mfa_factors f where f.user_id=u.id and f.status='verified') verified_factors,
       exists(select 1 from app_private.platform_admins a where a.profile_id=u.id) platform_admin,
       s.slug linked_staff
from (values ('estebanras15@gmail.com'),('jonatanramos2005oviedo@gmail.com')) c(email)
left join auth.users u on lower(u.email)=c.email
left join public.profiles p on p.id=u.id
left join public.organizations o on o.slug='1717-barberia'
left join public.organization_memberships m on m.profile_id=u.id and m.organization_id=o.id
left join public.staff s on s.profile_id=u.id and s.organization_id=o.id;
commit;
