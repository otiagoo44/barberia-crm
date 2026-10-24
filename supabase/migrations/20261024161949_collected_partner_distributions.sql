-- Explicit opt-in policy. No tenant configuration, commercial DML or history backfill.
alter table public.payments add constraint payments_branch_identity unique(organization_id,branch_id,id);
alter table public.staff_advances add constraint advances_branch_identity unique(organization_id,branch_id,id);
create table public.partner_cash_policies (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 branch_id uuid not null, policy_id uuid not null, first_month date not null,
 partner_ids uuid[] not null check(cardinality(partner_ids)=2 and partner_ids[1]<>partner_ids[2]),
 recognition text not null check(recognition='settled_collections_including_advances'),
 initial_losses_minor public.money_minor not null check(initial_losses_minor=0),
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(organization_id,policy_id),
 check(extract(day from first_month)=1),
 foreign key(organization_id,branch_id,policy_id) references public.partner_distribution_policies(organization_id,branch_id,id)
);
create table public.partner_cash_activation_approvals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 policy_id uuid not null, approver_id uuid not null references public.profiles(id),
 evidence jsonb not null, evidence_hash text not null,
 created_at timestamptz not null default now(),
 unique(organization_id,policy_id,approver_id),
 foreign key(organization_id,branch_id,policy_id) references public.partner_distribution_policies(organization_id,branch_id,id)
);
-- Reconcile each receipt/refund once. The original POS estimate remains untouched.
-- tax/withholding are explicit cash deductions; their fiscal classification is external.
create table public.payment_reconciliations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 payment_id uuid not null, eligible_at timestamptz not null, settled_at timestamptz not null,
 eligibility text not null check(eligibility in ('earned','advance_resolved','refund')),
 recognized_on date not null, gross_minor public.money_minor not null,
 processing_cost_minor public.money_minor not null, tax_minor public.money_minor not null,
 processing_credit_minor public.money_minor not null,
 withholding_minor public.money_minor not null, other_cost_minor public.money_minor not null,
 net_minor bigint not null, evidence_reference text not null check(length(btrim(evidence_reference)) between 5 and 250),
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(organization_id,payment_id), unique(organization_id,id),
 foreign key(organization_id,branch_id,payment_id) references public.payments(organization_id,branch_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create index payment_reconciliation_period on public.payment_reconciliations(organization_id,branch_id,recognized_on);
create table public.partner_period_approvals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 period_id uuid not null, snapshot_hash text not null, approver_id uuid not null references public.profiles(id),
 -- Keep the verified UUID as audit evidence without retaining an ephemeral
 -- auth.sessions row: sign-out/revocation must remain able to delete sessions.
 session_id uuid not null, approved_at timestamptz not null default now(),
 reference text not null check(length(btrim(reference)) between 5 and 250),
 unique(organization_id,period_id,approver_id),
 foreign key(organization_id,branch_id,period_id) references public.partner_distribution_periods(organization_id,branch_id,id)
);
create table public.partner_loss_ledger (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 origin_period_id uuid not null, applied_period_id uuid not null, amount_minor bigint not null check(amount_minor<>0),
 created_at timestamptz not null default now(),
 unique(organization_id,origin_period_id,applied_period_id),
 check((origin_period_id=applied_period_id)=(amount_minor>0)),
 foreign key(organization_id,branch_id,origin_period_id) references public.partner_distribution_periods(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,applied_period_id) references public.partner_distribution_periods(organization_id,branch_id,id)
);
create table public.partner_advance_applications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 allocation_id uuid not null, advance_id uuid not null, amount_minor public.money_minor not null check(amount_minor>0),
 created_at timestamptz not null default now(),
 unique(organization_id,allocation_id,advance_id),
 foreign key(organization_id,branch_id,allocation_id) references public.partner_distribution_allocations(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,advance_id) references public.staff_advances(organization_id,branch_id,id)
);
create index partner_advance_source on public.partner_advance_applications(organization_id,advance_id);
create index partner_loss_scope on public.partner_loss_ledger(organization_id,branch_id,origin_period_id);
create table public.partner_advance_classifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 advance_id uuid not null, treatment text not null check(treatment in ('owner_withdrawal','employee_advance')),
 reference text not null check(length(btrim(reference)) between 5 and 250),
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(organization_id,advance_id),
 foreign key(organization_id,branch_id,advance_id) references public.staff_advances(organization_id,branch_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
-- Unpaid invoices are deliberately outside expenses (which records money paid).
create table public.expense_payables (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, branch_id uuid not null,
 description text not null check(length(btrim(description)) between 3 and 500),
 amount_minor public.money_minor not null check(amount_minor>0), due_on date not null,
 reference text not null check(length(btrim(reference)) between 5 and 250),
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(organization_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
do $security$
declare t text;
begin
 foreach t in array array['partner_cash_policies','partner_cash_activation_approvals','payment_reconciliations','partner_period_approvals','partner_loss_ledger','partner_advance_applications','partner_advance_classifications','expense_payables'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy finance_read on public.%I for select to authenticated using(app_private.has_org_role(organization_id,array[''organization_owner'',''finance'']) and app_private.can_access_branch(organization_id,branch_id))',t);
  execute format('create index on public.%I(organization_id,branch_id)',t);
  execute format('create trigger append_only before update or delete on public.%I for each row execute function app_private.deny_history_mutation()',t);
 end loop;
end $security$;

-- Existing balances gain exactly one deduction per owner advance application.
create or replace function app_private.partner_balance(p_org uuid,p_allocation uuid) returns bigint
language sql stable security invoker set search_path='' as $$
 select a.amount_minor
 +coalesce((select sum(amount_minor) from public.partner_distribution_adjustments where organization_id=p_org and allocation_id=a.id),0)
 -coalesce((select sum(amount_minor*direction) from public.partner_distribution_payments where organization_id=p_org and allocation_id=a.id),0)
 -coalesce((select sum(amount_minor) from public.partner_withdrawal_allocations where organization_id=p_org and allocation_id=a.id),0)
 -coalesce((select sum(amount_minor) from public.partner_advance_applications where organization_id=p_org and allocation_id=a.id),0)
 from public.partner_distribution_allocations a where organization_id=p_org and id=p_allocation
$$;

-- Stable source identifiers are part of the hash; equal totals cannot conceal a change.
create function app_private.cash_distribution_snapshot(p_org uuid,p_branch uuid,lo date,hi date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; policy public.partner_cash_policies; receipts jsonb; costs jsonb; advances jsonb; losses jsonb;
 gross bigint; net bigint; paid bigint; carried bigint; result bigint; missing integer; unclassified integer;
begin
 select cp.* into strict policy from public.partner_cash_policies cp join public.partner_distribution_policies p on p.organization_id=cp.organization_id and p.id=cp.policy_id where cp.organization_id=p_org and cp.branch_id=p_branch order by p.version desc limit 1;
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'),coalesce(sum(p.direction*r.gross_minor),0),coalesce(sum(r.net_minor),0)
 into receipts,gross,net from public.payment_reconciliations r join public.payments p on p.organization_id=r.organization_id and p.id=r.payment_id
 where r.organization_id=p_org and r.branch_id=p_branch and r.recognized_on between lo and hi;
 -- Every captured amount up to cutoff must be either recognized or explicitly deferred
 -- by an earned/settled date. An unreconciled card receipt blocks a final proposal.
 select count(*) into missing from public.payments p where p.organization_id=p_org and p.branch_id=p_branch
 and (p.occurred_at at time zone tz)::date<=hi
 and not exists(select 1 from public.payment_reconciliations r where r.organization_id=p_org and r.payment_id=p.id);
 select count(*) into unclassified from public.staff_advances a join public.expenses e on e.organization_id=a.organization_id and e.id=a.expense_id
 where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=any(policy.partner_ids) and not a.deductible and e.status='posted' and (a.occurred_at at time zone tz)::date<=hi
 and not exists(select 1 from public.partner_advance_classifications c where c.organization_id=p_org and c.advance_id=a.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount_minor,'direction',direction) order by id,direction),'[]'),coalesce(sum(amount_minor*direction),0)
 into costs,paid from (
  select id,amount_minor,1 direction from public.expenses where organization_id=p_org and branch_id=p_branch
   and category_kind_snapshot in ('operating','salary','commission_payment') and not (staff_id=any(policy.partner_ids) and category_kind_snapshot='commission_payment') and (occurred_at at time zone tz)::date between lo and hi
  union all select id,amount_minor,-1 from public.expenses where organization_id=p_org and branch_id=p_branch
   and category_kind_snapshot in ('operating','salary','commission_payment') and not (staff_id=any(policy.partner_ids) and category_kind_snapshot='commission_payment') and (reversed_at at time zone tz)::date between lo and hi
 ) e;
 select coalesce(jsonb_agg(jsonb_build_object('origin',origin_period_id,'remaining',remaining) order by origin_period_id),'[]'),coalesce(sum(remaining),0)
 into losses,carried from (
  select l.origin_period_id,sum(l.amount_minor) remaining from public.partner_loss_ledger l
  join public.partner_distribution_periods p on p.organization_id=l.organization_id and p.id=l.applied_period_id
  where l.organization_id=p_org and l.branch_id=p_branch and p.period_end<lo group by l.origin_period_id having sum(l.amount_minor)>0
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'staff_id',staff_id,'remaining',remaining) order by occurred_at,id),'[]') into advances from (
 select a.id,a.staff_id,a.occurred_at,a.amount_minor
 -coalesce((select sum(w.amount_minor) from public.partner_advance_applications w join public.partner_distribution_allocations al on al.organization_id=w.organization_id and al.id=w.allocation_id join public.partner_distribution_periods p on p.organization_id=al.organization_id and p.id=al.period_id where w.organization_id=p_org and w.advance_id=a.id and p.period_end<lo),0) remaining
 from public.staff_advances a join public.expenses e on e.organization_id=a.organization_id and e.id=a.expense_id
 where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=any(policy.partner_ids) and not a.deductible and e.status='posted'
 and exists(select 1 from public.partner_advance_classifications c where c.organization_id=p_org and c.advance_id=a.id and c.treatment='owner_withdrawal')
 and (a.occurred_at at time zone tz)::date<=hi
 and not exists(select 1 from public.settlement_advances sa where sa.organization_id=p_org and sa.advance_id=a.id)
 and not exists(select 1 from public.partner_withdrawal_allocations w where w.organization_id=p_org and w.advance_id=a.id)
 ) a where remaining>0;
 result:=net-paid;
 return jsonb_build_object('recognition','settled_collections_including_advances','policy_id',policy.policy_id,'partners',policy.partner_ids,
 'receipts',receipts,'paid_expenses',costs,'advances',advances,'loss_origins',losses,'incomplete_receipts',missing,'unclassified_withdrawals',unclassified,
 'gross_collections_minor',gross,'net_settled_minor',net,'paid_expenses_minor',paid,'before_losses_minor',result,
 'losses_opening_minor',carried,'losses_recovered_minor',least(greatest(result,0),carried),
 'losses_remaining_minor',greatest(carried-result,0),'distributable_minor',greatest(result-carried,0),
 'per_partner_minor',floor(greatest(result-carried,0)::numeric/2)::bigint,'remainder_minor',greatest(result-carried,0)%2);
end $$;
revoke all on function app_private.cash_distribution_snapshot(uuid,uuid,date,date) from public,anon,authenticated,service_role;

-- Preserve the legacy engine for tenants without an explicit cash policy.
alter function app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid) rename to partner_distribution_command_sales;
revoke all on function app_private.partner_distribution_command_sales(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated,service_role;
create function app_private.partner_distribution_command(p_org uuid,p_branch uuid,p_action text,d jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; sid uuid; policy public.partner_cash_policies; base public.partner_distribution_policies;
 period public.partner_distribution_periods; payment public.payments; allocation public.partner_distribution_allocations;
 snapshot jsonb; hash text; reply jsonb; v uuid; partners uuid[]; lo date; hi date; tz text; ref text;
 earned timestamptz; settled timestamptz; day date; fee bigint; tax bigint; withholding bigint; other bigint;
 net bigint; credit bigint; remaining bigint; applied bigint; item jsonb; row record;
begin
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 perform app_private.lock_organization(p_org);
 -- Recheck after waiting: revocation and live AAL2 cannot be bypassed by dedupe.
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 select cp.* into policy from public.partner_cash_policies cp join public.partner_distribution_policies p on p.organization_id=cp.organization_id and p.id=cp.policy_id where cp.organization_id=p_org and cp.branch_id=p_branch order by p.version desc limit 1;
 if policy.id is null and p_action<>'configure_cash' then
  if exists(select 1 from public.organizations where id=p_org and slug='1717-barberia') then raise exception 'cash_policy_required' using errcode='23514';end if;
  return app_private.partner_distribution_command_sales(p_org,p_branch,p_action,d,p_key);
 end if;
 if not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'owner_approval_required' using errcode='42501';end if;
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>8192 or p_key is null then raise exception 'invalid_distribution' using errcode='22023';end if;
 actor:=app_private.current_profile(); sid:=(auth.jwt()->>'session_id')::uuid;
 select b.timezone into tz from public.branches b join public.organizations o on o.id=b.organization_id where b.organization_id=p_org and b.id=p_branch and b.active and o.currency='PYG';
 if tz is null then raise exception 'active_pyg_branch_required' using errcode='23514';end if;
 reply:=app_private.idempotency_begin(p_org,actor::text,'finance.cash.'||p_action,p_key,jsonb_build_object('branch',p_branch,'data',d));
 if reply is not null then return reply;end if;
 ref:=coalesce(d->>'reference',d->>'evidence_reference');
 if p_action='configure_cash' then
  if policy.id is not null or d->>'confirmed' is distinct from 'true' or d->>'recognition' is distinct from 'settled_collections_including_advances'
  or d->>'initial_losses_confirmed_zero' is distinct from 'true' then raise exception 'explicit_cash_policy_required' using errcode='23514';end if;
  lo:=(d->>'first_month')::date;
  if lo is null or extract(day from lo)<>1 then raise exception 'first_month_required' using errcode='22023';end if;
  select profit_share_staff_ids into partners from public.finance_settings where organization_id=p_org and remuneration_model='equal_profit_share';
  if cardinality(partners) is distinct from 2 or partners[1]=partners[2] or
  (select count(distinct s.profile_id) from public.staff s join public.organization_memberships m on m.organization_id=s.organization_id and m.profile_id=s.profile_id join public.profiles pr on pr.id=s.profile_id where s.organization_id=p_org and s.id=any(partners) and s.active and pr.active and m.active and m.role='organization_owner')<>2
  then raise exception 'two_linked_owners_required' using errcode='23514';end if;
  if exists(select 1 from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch)
  then raise exception 'existing_periods_require_migration_review' using errcode='23514';end if;
  insert into public.partner_distribution_policies(organization_id,branch_id,version,enabled,periodicity,approval_role,withdrawals_mode,evidence_reference,losses_reference,created_by)
  select p_org,p_branch,coalesce(max(version),0)+1,false,'monthly','owner','explicit_advance',ref,'Monthly loss recovery; explicit zero opening balance',actor from public.partner_distribution_policies where organization_id=p_org and branch_id=p_branch returning * into base;
  insert into public.partner_cash_policies(organization_id,branch_id,policy_id,first_month,partner_ids,recognition,initial_losses_minor,created_by)
  values(p_org,p_branch,base.id,lo,partners,'settled_collections_including_advances',0,actor) returning id into v;
 elsif p_action='approve_activation' then
  select * into base from public.partner_distribution_policies where organization_id=p_org and id=policy.policy_id;
  if base.enabled or not exists(select 1 from public.staff where organization_id=p_org and id=any(policy.partner_ids) and profile_id=actor and active) then raise exception 'activation_not_available' using errcode='23514';end if;
  foreach ref in array array['owner_accounts','smtp','mfa','pos_contract','policy','staging','backup_restore','alerts','pilot'] loop
   if jsonb_typeof(d->'gates'->ref) is distinct from 'string' or length(btrim(d->'gates'->>ref)) not between 5 and 250 then raise exception 'external_gate_evidence_required' using errcode='23514';end if;
  end loop;
  hash:=encode(extensions.digest((d->'gates')::text,'sha256'),'hex');
  insert into public.partner_cash_activation_approvals(organization_id,branch_id,policy_id,approver_id,evidence,evidence_hash)
  values(p_org,p_branch,policy.policy_id,actor,d->'gates',hash) returning id into v;
  if (select count(distinct a.approver_id) from public.partner_cash_activation_approvals a join public.organization_memberships m on m.organization_id=a.organization_id and m.profile_id=a.approver_id and m.active and m.role='organization_owner' join public.staff s on s.organization_id=a.organization_id and s.profile_id=a.approver_id and s.id=any(policy.partner_ids) and s.active where a.organization_id=p_org and a.policy_id=policy.policy_id and a.evidence_hash=hash and exists(select 1 from auth.mfa_factors f where f.user_id=a.approver_id and f.status='verified'))=2 then
   insert into public.partner_distribution_policies(organization_id,branch_id,version,enabled,periodicity,approval_role,withdrawals_mode,evidence_reference,losses_reference,created_by)
   values(p_org,p_branch,base.version+1,true,'monthly','owner','explicit_advance',base.evidence_reference,base.losses_reference,actor) returning * into base;
   insert into public.partner_cash_policies(organization_id,branch_id,policy_id,first_month,partner_ids,recognition,initial_losses_minor,created_by)
   values(p_org,p_branch,base.id,policy.first_month,policy.partner_ids,policy.recognition,0,actor);
  end if;
 elsif p_action='classify_withdrawal' then
  if d->>'treatment' not in ('owner_withdrawal','employee_advance') or d->>'treatment' is null or not exists(
    select 1 from public.staff_advances a join public.expenses e on e.organization_id=a.organization_id and e.id=a.expense_id
    where a.organization_id=p_org and a.branch_id=p_branch and a.id=(d->>'advance')::uuid and a.staff_id=any(policy.partner_ids) and not a.deductible and e.status='posted'
    and not exists(select 1 from public.settlement_advances sa where sa.organization_id=p_org and sa.advance_id=a.id)
    and not exists(select 1 from public.partner_withdrawal_allocations w where w.organization_id=p_org and w.advance_id=a.id)
  ) then raise exception 'identified_partner_advance_required' using errcode='23514';end if;
  insert into public.partner_advance_classifications(organization_id,branch_id,advance_id,treatment,reference,created_by)
  values(p_org,p_branch,(d->>'advance')::uuid,d->>'treatment',ref,actor) returning id into v;
 elsif p_action='record_payable' then
  insert into public.expense_payables(organization_id,branch_id,description,amount_minor,due_on,reference,created_by)
  values(p_org,p_branch,d->>'description',app_private.finance_amount(d->'amount_minor'),(d->>'due_on')::date,ref,actor) returning id into v;
 elsif p_action='reconcile_payment' then
  select * into payment from public.payments where organization_id=p_org and branch_id=p_branch and id=(d->>'payment')::uuid;
  if payment.id is null or d->>'eligibility_confirmed' is distinct from 'true' or d->>'eligibility' not in ('earned','advance_resolved','refund') or d->>'eligibility' is null or ((payment.direction=-1) is distinct from (d->>'eligibility'='refund')) then raise exception 'resolved_payment_eligibility_required' using errcode='23514';end if;
  earned:=(d->>'eligible_at')::timestamptz; settled:=(d->>'settled_at')::timestamptz;
  if earned is null or settled is null or settled<payment.occurred_at or settled>now() or earned>now() then raise exception 'actual_settlement_required' using errcode='23514';end if;
  fee:=app_private.finance_amount(d->'processing_cost_minor');tax:=app_private.finance_amount(d->'tax_minor');
  withholding:=app_private.finance_amount(d->'withholding_minor');other:=app_private.finance_amount(d->'other_cost_minor');
  credit:=app_private.finance_amount(d->'processing_credit_minor');
  if credit>0 and (payment.direction<>-1 or credit>coalesce((select processing_cost_minor from public.payment_reconciliations where organization_id=p_org and payment_id=payment.reversal_of_id),0)) then raise exception 'processor_credit_evidence_required' using errcode='23514';end if;
  net:=payment.direction*payment.amount_minor-fee-tax-withholding-other+credit;
  if (d->>'net_minor')::bigint is distinct from net or (payment.direction=1 and net<0) then raise exception 'settlement_difference_requires_reconciliation' using errcode='23514';end if;
  day:=(greatest(payment.occurred_at,earned,settled) at time zone tz)::date;
  if day<policy.first_month or exists(select 1 from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and status in ('approved','closed') and period_end>=day) then raise exception 'closed_recognition_period' using errcode='23514';end if;
  insert into public.payment_reconciliations(organization_id,branch_id,payment_id,eligible_at,settled_at,eligibility,recognized_on,gross_minor,processing_cost_minor,processing_credit_minor,tax_minor,withholding_minor,other_cost_minor,net_minor,evidence_reference,created_by)
  values(p_org,p_branch,payment.id,earned,settled,d->>'eligibility',day,payment.amount_minor,fee,credit,tax,withholding,other,net,ref,actor) returning id into v;
 else
  select * into base from public.partner_distribution_policies where organization_id=p_org and id=policy.policy_id;
  -- Production activation is intentionally a separate, externally gated operation.
  if base.enabled is distinct from true then raise exception 'distribution_activation_gates_open' using errcode='23514';end if;
  if p_action='prepare' then
   lo:=(d->>'from')::date;hi:=(d->>'to')::date;
   if lo is null or hi is null or extract(day from lo)<>1 or hi<>(lo+interval '1 month'-interval '1 day')::date or hi>=(now() at time zone tz)::date then raise exception 'completed_month_required' using errcode='23514';end if;
   if lo<>coalesce((select max(period_end)+1 from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and status in ('approved','closed')),policy.first_month) then raise exception 'consecutive_period_required' using errcode='23514';end if;
   snapshot:=app_private.cash_distribution_snapshot(p_org,p_branch,lo,hi);
   if (snapshot->>'incomplete_receipts')::integer<>0 or (snapshot->>'unclassified_withdrawals')::integer<>0 then raise exception 'incomplete_distribution_result' using errcode='23514';end if;
   hash:=encode(extensions.digest(snapshot::text,'sha256'),'hex');
   insert into public.partner_distribution_periods(organization_id,branch_id,policy_id,period_start,period_end,currency,snapshot,snapshot_hash,result_minor,remainder_minor,created_by)
   values(p_org,p_branch,policy.policy_id,lo,hi,'PYG',snapshot,hash,(snapshot->>'distributable_minor')::bigint,(snapshot->>'remainder_minor')::bigint,actor) returning id into v;
   insert into public.partner_distribution_allocations(organization_id,branch_id,period_id,staff_id,denominator,amount_minor)
   select p_org,p_branch,v,x,2,(snapshot->>'per_partner_minor')::bigint from unnest(policy.partner_ids) x;
  else
   if p_action in ('approve','close') then
    select * into period from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and id=(d->>'id')::uuid for update;
   else
    select * into allocation from public.partner_distribution_allocations where organization_id=p_org and branch_id=p_branch and id=(d->>'allocation')::uuid for update;
    select * into period from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and id=allocation.period_id for update;
   end if;
   if period.id is null or period.policy_id<>policy.policy_id then raise exception 'distribution_not_found' using errcode='23514';end if;
   snapshot:=app_private.cash_distribution_snapshot(p_org,p_branch,period.period_start,period.period_end);
   hash:=encode(extensions.digest(snapshot::text,'sha256'),'hex');
   if hash<>period.snapshot_hash then raise exception 'stale_distribution_snapshot_prepare_again' using errcode='23514';end if;
   if p_action='approve' then
    if period.status<>'draft' or d->>'reconciled' is distinct from 'true' then raise exception 'reconciliation_required' using errcode='23514';end if;
    if not exists(select 1 from public.staff s where s.organization_id=p_org and s.id=any(policy.partner_ids) and s.profile_id=actor and s.active) then raise exception 'partner_owner_required' using errcode='42501';end if;
    insert into public.partner_period_approvals(organization_id,branch_id,period_id,snapshot_hash,approver_id,session_id,reference)
    values(p_org,p_branch,period.id,hash,actor,sid,ref);
    -- Both identities must STILL be owners with a live, unexpired session and a verified factor.
    if (select count(distinct a.approver_id) from public.partner_period_approvals a join public.staff s on s.organization_id=a.organization_id and s.profile_id=a.approver_id and s.id=any(policy.partner_ids) and s.active join public.organization_memberships m on m.organization_id=a.organization_id and m.profile_id=a.approver_id and m.active and m.role='organization_owner' join public.profiles pr on pr.id=m.profile_id and pr.active join auth.sessions se on se.id=a.session_id and se.user_id=a.approver_id where a.organization_id=p_org and a.period_id=period.id and a.snapshot_hash=hash and (se.not_after is null or se.not_after>now()) and exists(select 1 from auth.mfa_factors f where f.user_id=a.approver_id and f.status='verified'))=2 then
     update public.partner_distribution_periods set status='approved',approved_at=now(),approved_by=actor,reconciliation_reference=ref where id=period.id;
     remaining:=(snapshot->>'losses_recovered_minor')::bigint;
     for item in select value from jsonb_array_elements(snapshot->'loss_origins') loop
      applied:=least(remaining,(item->>'remaining')::bigint);
      if applied>0 then insert into public.partner_loss_ledger(organization_id,branch_id,origin_period_id,applied_period_id,amount_minor) values(p_org,p_branch,(item->>'origin')::uuid,period.id,-applied);end if;
      remaining:=remaining-applied;
     end loop;
     if (snapshot->>'before_losses_minor')::bigint<0 then insert into public.partner_loss_ledger(organization_id,branch_id,origin_period_id,applied_period_id,amount_minor) values(p_org,p_branch,period.id,period.id,-(snapshot->>'before_losses_minor')::bigint);end if;
     for row in select * from public.partner_distribution_allocations where organization_id=p_org and period_id=period.id order by id loop
      remaining:=row.amount_minor;
      for item in select value from jsonb_array_elements(snapshot->'advances') where value->>'staff_id'=row.staff_id::text loop
       applied:=least(remaining,(item->>'remaining')::bigint);
       if applied>0 then insert into public.partner_advance_applications(organization_id,branch_id,allocation_id,advance_id,amount_minor) values(p_org,p_branch,row.id,(item->>'id')::uuid,applied);end if;
       remaining:=remaining-applied;
      end loop;
     end loop;
    end if;
    v:=period.id;
   elsif p_action in ('pay','reverse_payment','close') then
    if period.status<>'approved' or (select count(distinct a.approver_id) from public.partner_period_approvals a join public.organization_memberships m on m.organization_id=a.organization_id and m.profile_id=a.approver_id and m.role='organization_owner' and m.active join public.profiles pr on pr.id=m.profile_id and pr.active join public.staff s on s.organization_id=a.organization_id and s.profile_id=a.approver_id and s.id=any(policy.partner_ids) and s.active where a.organization_id=p_org and a.period_id=period.id and a.snapshot_hash=hash)<>2 then raise exception 'dual_approval_required' using errcode='23514';end if;
    -- Legacy payout uses the same immutable allocations, ledger, balance, cash, dedupe and audit.
    reply:=app_private.partner_distribution_command_sales(p_org,p_branch,p_action,d,p_key);
    return app_private.idempotency_finish(p_org,actor::text,'finance.cash.'||p_action,p_key,reply);
   else raise exception 'cash_distribution_action_not_allowed' using errcode='23514';end if;
  end if;
 end if;
 reply:=jsonb_build_object('id',v);
 perform app_private.record_audit(p_org,p_branch,'finance.cash.'||p_action,'partner_distributions',v,jsonb_build_object('data',d,'session_id',sid),app_private.request_id());
 return app_private.idempotency_finish(p_org,actor::text,'finance.cash.'||p_action,p_key,reply);
end $$;
revoke all on function app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid) to authenticated;

-- Applied owner advances cannot be refunded independently or reused as employee advances.
create function app_private.protect_partner_advance() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status and exists(select 1 from public.staff_advances a join public.partner_advance_applications w on w.organization_id=a.organization_id and w.advance_id=a.id where a.organization_id=old.organization_id and a.expense_id=old.id) then raise exception 'allocated_advance_requires_adjustment' using errcode='23514';end if;
 return new;
end $$;
create trigger protect_partner_advance before update on public.expenses for each row execute function app_private.protect_partner_advance();
revoke all on function app_private.protect_partner_advance() from public,anon,authenticated,service_role;

-- Expose approvals, frozen components and reconciliation state through the existing read API.
alter function app_private.partner_distributions(uuid,uuid,date,date) rename to partner_distributions_sales;
revoke all on function app_private.partner_distributions_sales(uuid,uuid,date,date) from public,anon,authenticated,service_role;
create function app_private.partner_distributions(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; policy public.partner_cash_policies;
begin
 result:=app_private.partner_distributions_sales(p_org,p_branch,p_from,p_to)||jsonb_build_object('cash_schema_version',1);
 select cp.* into policy from public.partner_cash_policies cp join public.partner_distribution_policies p on p.organization_id=cp.organization_id and p.id=cp.policy_id where cp.organization_id=p_org and cp.branch_id=p_branch order by p.version desc limit 1;
 if policy.id is not null then
  result:=jsonb_set(result,'{cash_policy}',to_jsonb(policy));
  result:=jsonb_set(result,'{periods}',coalesce((select jsonb_agg(x||jsonb_build_object('approvals',(select coalesce(jsonb_agg(jsonb_build_object('approver_id',a.approver_id,'snapshot_hash',a.snapshot_hash,'approved_at',a.approved_at)),'[]') from public.partner_period_approvals a where a.organization_id=p_org and a.period_id=(x->>'id')::uuid))) from jsonb_array_elements(result->'periods') x),'[]'));
 end if;
 return app_private.exact_financial_json(result);
end $$;
revoke all on function app_private.partner_distributions(uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.partner_distributions(uuid,uuid,date,date) to authenticated;

-- Prevent backdating new money into a frozen month. A refund/reversal uses its
-- real later date and is carried by the next proposal, never by rewriting history.
create function app_private.protect_cash_period_dates() returns trigger language plpgsql set search_path='' as $$
declare stamp timestamptz; tz text;
begin
 if not exists(select 1 from public.partner_cash_policies where organization_id=new.organization_id and branch_id=new.branch_id) then return new;end if;
 if tg_op='UPDATE' then
  if new.reversed_at is not distinct from old.reversed_at then return new;end if;
  stamp:=new.reversed_at;
 else stamp:=new.occurred_at;end if;
 select timezone into tz from public.branches where organization_id=new.organization_id and id=new.branch_id;
 if exists(select 1 from public.partner_distribution_periods where organization_id=new.organization_id and branch_id=new.branch_id and status in ('approved','closed') and period_end>=(stamp at time zone tz)::date) then raise exception 'closed_financial_period_use_current_adjustment' using errcode='23514';end if;
 return new;
end $$;
create trigger closed_cash_period before insert on public.payments for each row execute function app_private.protect_cash_period_dates();
create trigger closed_cash_period before insert or update on public.expenses for each row execute function app_private.protect_cash_period_dates();
revoke all on function app_private.protect_cash_period_dates() from public,anon,authenticated,service_role;
