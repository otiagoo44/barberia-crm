-- An opt-in record of approved allocations and actual distributions. No history
-- import, no automatic periods, no commission settlement reinterpretation.
create table public.partner_distribution_policies (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 branch_id uuid not null, version integer not null check(version>0), enabled boolean not null default false,
 periodicity text not null check(periodicity in ('manual','weekly','monthly')),
 approval_role text not null check(approval_role in ('owner','owner_or_finance')),
 withdrawals_mode text not null check(withdrawals_mode in ('blocked','explicit_advance')),
 evidence_reference text not null check(length(btrim(evidence_reference)) between 5 and 250),
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(organization_id,id),unique(organization_id,branch_id,id),unique(organization_id,branch_id,version),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create table public.partner_distribution_periods (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),branch_id uuid not null,
 policy_id uuid not null, period_start date not null,period_end date not null,
 currency text not null check(currency='PYG'),status text not null default 'draft' check(status in ('draft','approved','closed')),
 snapshot jsonb not null, snapshot_hash text not null, cutoff_at timestamptz not null default now(),
 result_minor bigint not null, remainder_minor public.money_minor not null,
 created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),
 approved_at timestamptz,approved_by uuid references public.profiles(id),closed_at timestamptz,
 reconciliation_reference text check(length(btrim(reconciliation_reference)) between 5 and 250),
 check(period_end>=period_start and period_end-period_start<=365),
 check((status in ('approved','closed'))=(approved_at is not null)),check((status='closed')=(closed_at is not null)),
 unique(organization_id,id),unique(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,policy_id) references public.partner_distribution_policies(organization_id,branch_id,id),
 exclude using gist(organization_id with =,branch_id with =,daterange(period_start,period_end,'[]') with &&) where(status in ('approved','closed'))
);
create table public.partner_distribution_allocations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,period_id uuid not null,
 staff_id uuid not null,numerator integer not null default 1 check(numerator=1),denominator integer not null check(denominator=2),
 amount_minor public.money_minor not null, created_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,branch_id,id),unique(organization_id,period_id,staff_id),
 foreign key(organization_id,branch_id,period_id) references public.partner_distribution_periods(organization_id,branch_id,id),
 foreign key(organization_id,staff_id) references public.staff(organization_id,id)
);
create table public.partner_distribution_payments (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,allocation_id uuid not null,
 amount_minor public.money_minor not null check(amount_minor>0), direction smallint not null check(direction in (-1,1)),
 reverses_id uuid, payment_method_id uuid not null, cash_session_id uuid,
 occurred_at timestamptz not null,reference text not null check(length(btrim(reference)) between 3 and 250),
 created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),
 unique(organization_id,id),unique(organization_id,reverses_id),
 check((direction=-1)=(reverses_id is not null)),
 foreign key(organization_id,branch_id,allocation_id) references public.partner_distribution_allocations(organization_id,branch_id,id),
 foreign key(organization_id,reverses_id) references public.partner_distribution_payments(organization_id,id),
 foreign key(organization_id,payment_method_id) references public.payment_methods(organization_id,id),
 foreign key(organization_id,branch_id,cash_session_id) references public.cash_sessions(organization_id,branch_id,id)
);
create table public.partner_distribution_adjustments (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,allocation_id uuid not null,
 amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=9000000000000),
 reason text not null check(length(btrim(reason)) between 5 and 500),related_period_id uuid,
 created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),unique(organization_id,id),
 foreign key(organization_id,branch_id,allocation_id) references public.partner_distribution_allocations(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,related_period_id) references public.partner_distribution_periods(organization_id,branch_id,id)
);
create table public.partner_withdrawal_allocations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,allocation_id uuid not null,
 advance_id uuid not null,amount_minor public.money_minor not null check(amount_minor>0),
 reference text not null check(length(btrim(reference)) between 5 and 250),
 created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),unique(organization_id,id),
 unique(organization_id,advance_id),
 foreign key(organization_id,branch_id,allocation_id) references public.partner_distribution_allocations(organization_id,branch_id,id),
 foreign key(organization_id,advance_id) references public.staff_advances(organization_id,id)
);
-- Cash entries remain in the existing cash ledger, never operating expenses.
alter table public.cash_movements add column partner_payment_id uuid,
 add constraint cash_partner_payment_fk foreign key(organization_id,partner_payment_id) references public.partner_distribution_payments(organization_id,id),
 add constraint cash_partner_payment_unique unique(organization_id,partner_payment_id);

do $security$
declare t text;
begin
 foreach t in array array['partner_distribution_policies','partner_distribution_periods','partner_distribution_allocations','partner_distribution_payments','partner_distribution_adjustments','partner_withdrawal_allocations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy distribution_read on public.%I for select to authenticated using(app_private.has_org_role(organization_id,array[''organization_owner'',''finance'']) and app_private.can_access_branch(organization_id,branch_id))',t);
  execute format('create index on public.%I(organization_id,branch_id)',t);
  if t<>'partner_distribution_periods' then
   execute format('create trigger append_only before update or delete on public.%I for each row execute function app_private.deny_history_mutation()',t);
  end if;
 end loop;
end $security$;
create index partner_payments_allocation on public.partner_distribution_payments(organization_id,allocation_id);
create index partner_adjustments_allocation on public.partner_distribution_adjustments(organization_id,allocation_id);
create index partner_withdrawals_allocation on public.partner_withdrawal_allocations(organization_id,allocation_id);
create index partner_allocations_staff on public.partner_distribution_allocations(organization_id,staff_id);
create function app_private.distribution_period_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'immutable_distribution' using errcode='23514';end if;
 if (to_jsonb(new)-array['status','approved_at','approved_by','closed_at','reconciliation_reference']) is distinct from
    (to_jsonb(old)-array['status','approved_at','approved_by','closed_at','reconciliation_reference'])
 or not ((old.status='draft' and new.status='approved') or (old.status='approved' and new.status='closed')) then
  raise exception 'immutable_distribution' using errcode='23514';
 end if;
 return new;
end $$;
create trigger immutable_period before update or delete on public.partner_distribution_periods for each row execute function app_private.distribution_period_guard();
revoke all on function app_private.distribution_period_guard() from public,anon,authenticated,service_role;

create function app_private.partner_balance(p_org uuid,p_allocation uuid) returns bigint
language sql stable security invoker set search_path='' as $$
 select a.amount_minor+coalesce((select sum(amount_minor) from public.partner_distribution_adjustments where organization_id=p_org and allocation_id=a.id),0)
 -coalesce((select sum(amount_minor*direction) from public.partner_distribution_payments where organization_id=p_org and allocation_id=a.id),0)
 -coalesce((select sum(amount_minor) from public.partner_withdrawal_allocations where organization_id=p_org and allocation_id=a.id),0)
 from public.partner_distribution_allocations a where organization_id=p_org and id=p_allocation
$$;
revoke all on function app_private.partner_balance(uuid,uuid) from public,anon,authenticated,service_role;

create function app_private.partner_distribution_command(p_org uuid,p_branch uuid,p_action text,d jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app_private.current_profile(); reply jsonb; v uuid; policy public.partner_distribution_policies;
 period public.partner_distribution_periods; allocation public.partner_distribution_allocations;
 original public.partner_distribution_payments; method public.payment_methods; advance public.staff_advances;
 summary jsonb; snap jsonb; partners uuid[]; amt bigint; amount_remaining bigint; session_id uuid; when_at timestamptz;
 lo date;hi date; tz text; currency_code text; req uuid:=app_private.request_id();
begin
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 perform app_private.lock_organization(p_org);
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch)
 or not exists(select 1 from public.branches where organization_id=p_org and id=p_branch and active) then raise exception 'forbidden' using errcode='42501';end if;
 if p_action is null or p_key is null or d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>8192 then raise exception 'invalid_distribution' using errcode='22023';end if;
 reply:=app_private.idempotency_begin(p_org,actor::text,'finance.partner.'||p_action,p_key,jsonb_build_object('branch',p_branch,'data',d));
 if reply is not null then return reply;end if;
 select * into policy from public.partner_distribution_policies where organization_id=p_org and branch_id=p_branch order by version desc limit 1;
 select b.timezone,o.currency into tz,currency_code from public.branches b join public.organizations o on o.id=b.organization_id where b.organization_id=p_org and b.id=p_branch;
 if p_action='configure' then
  if not app_private.has_org_role(p_org,array['organization_owner']) or d->>'confirmed' is distinct from 'true' then raise exception 'owner_confirmation_required' using errcode='42501';end if;
  insert into public.partner_distribution_policies(organization_id,branch_id,version,enabled,periodicity,approval_role,withdrawals_mode,evidence_reference,created_by)
  values(p_org,p_branch,coalesce(policy.version,0)+1,coalesce((d->>'enabled')::boolean,false),d->>'periodicity',d->>'approval_role',d->>'withdrawals_mode',d->>'evidence_reference',actor) returning id into v;
 else
  if policy.enabled is distinct from true or currency_code<>'PYG' then raise exception 'distribution_policy_not_confirmed' using errcode='23514';end if;
  if policy.approval_role='owner' and not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'owner_approval_required' using errcode='42501';end if;
  if p_action='prepare' then
   lo:=(d->>'from')::date;hi:=(d->>'to')::date;
   if lo is null or hi is null or hi<lo or hi-lo>365 or hi>=(now() at time zone tz)::date then raise exception 'completed_period_required' using errcode='22023';end if;
   if (policy.periodicity='weekly' and (extract(isodow from lo)<>1 or hi<>lo+6)) or
      (policy.periodicity='monthly' and (extract(day from lo)<>1 or hi<>(lo+interval '1 month'-interval '1 day')::date)) then raise exception 'policy_period_mismatch' using errcode='22023';end if;
   select profit_share_staff_ids into partners from public.finance_settings where organization_id=p_org and remuneration_model='equal_profit_share';
   if cardinality(partners) is distinct from 2 then raise exception 'two_confirmed_partners_required' using errcode='23514';end if;
   summary:=app_private.finance_read(p_org,p_branch,'summary',lo,hi,50,0,'',null);
   if summary->'profit_sharing'->>'profit_minor' is null then raise exception 'incomplete_distribution_result' using errcode='23514';end if;
   snap:=jsonb_build_object('totals',summary->'totals','profit_sharing',summary->'profit_sharing');
   insert into public.partner_distribution_periods(organization_id,branch_id,policy_id,period_start,period_end,currency,snapshot,snapshot_hash,result_minor,remainder_minor,created_by)
   values(p_org,p_branch,policy.id,lo,hi,currency_code,snap,encode(extensions.digest(snap::text,'sha256'),'hex'),(summary->'profit_sharing'->>'profit_minor')::bigint,(summary->'profit_sharing'->>'remainder_minor')::bigint,actor) returning id into v;
   insert into public.partner_distribution_allocations(organization_id,branch_id,period_id,staff_id,denominator,amount_minor)
   select p_org,p_branch,v,x,2,(summary->'profit_sharing'->>'per_partner_minor')::bigint from unnest(partners) x;
  else
   if p_action in ('approve','close') then
    select * into period from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and id=(d->>'id')::uuid for update;
   else
    select * into allocation from public.partner_distribution_allocations where organization_id=p_org and branch_id=p_branch and id=(d->>'allocation')::uuid for update;
    select * into period from public.partner_distribution_periods where organization_id=p_org and branch_id=p_branch and id=allocation.period_id for update;
   end if;
   if period.id is null or (p_action='approve' and period.policy_id<>policy.id) then raise exception 'distribution_not_found_or_policy_changed' using errcode='23514';end if;
   if p_action<>'approve' then
    select * into policy from public.partner_distribution_policies where organization_id=p_org and id=period.policy_id;
    if policy.approval_role='owner' and not app_private.has_org_role(p_org,array['organization_owner']) then raise exception 'owner_approval_required' using errcode='42501';end if;
   end if;
   if p_action='approve' then
    if period.status<>'draft' or d->>'reconciled' is distinct from 'true' or length(btrim(coalesce(d->>'reference','')))<5 then raise exception 'reconciliation_required' using errcode='23514';end if;
    summary:=app_private.finance_read(p_org,p_branch,'summary',period.period_start,period.period_end,50,0,'',null);
    -- Pending receivables are current-state context, not part of the economic snapshot.
    if summary->'profit_sharing' is distinct from period.snapshot->'profit_sharing'
    or (summary->'totals')-array['pending_minor','unique_customers','average_customers_per_day','top_payment_method','completed_visits','production_minor'] is distinct from
       (period.snapshot->'totals')-array['pending_minor','unique_customers','average_customers_per_day','top_payment_method','completed_visits','production_minor'] then raise exception 'stale_distribution_snapshot' using errcode='23514';end if;
    update public.partner_distribution_periods set status='approved',approved_at=now(),approved_by=actor,reconciliation_reference=d->>'reference' where id=period.id returning id into v;
   elsif p_action='close' then
    if period.status<>'approved' or exists(select 1 from public.partner_distribution_allocations a where a.organization_id=p_org and a.period_id=period.id and app_private.partner_balance(p_org,a.id)<>0) then raise exception 'unreconciled_distribution_balance' using errcode='23514';end if;
    update public.partner_distribution_periods set status='closed',closed_at=now() where id=period.id returning id into v;
   else
    if period.status<>'approved' then raise exception 'approved_distribution_required' using errcode='23514';end if;
    amount_remaining:=app_private.partner_balance(p_org,allocation.id);
    if p_action='adjust' then
     amt:=app_private.finance_amount(d->'amount_minor',true);
     if amt=0 or amount_remaining+amt<0 then raise exception 'negative_partner_balance' using errcode='23514';end if;
     insert into public.partner_distribution_adjustments(organization_id,branch_id,allocation_id,amount_minor,reason,related_period_id,created_by)
     values(p_org,p_branch,allocation.id,amt,d->>'reason',(d->>'related_period')::uuid,actor) returning id into v;
    elsif p_action='apply_withdrawal' then
     if policy.withdrawals_mode<>'explicit_advance' then raise exception 'withdrawals_not_confirmed' using errcode='23514';end if;
     select a.* into advance from public.staff_advances a join public.expenses e on e.organization_id=a.organization_id and e.id=a.expense_id
     where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=allocation.staff_id and a.id=(d->>'advance')::uuid and not a.deductible and e.status='posted'
     and not exists(select 1 from public.settlement_advances sa where sa.organization_id=p_org and sa.advance_id=a.id);
     if advance.id is null or advance.amount_minor>amount_remaining then raise exception 'invalid_partner_withdrawal' using errcode='23514';end if;
     insert into public.partner_withdrawal_allocations(organization_id,branch_id,allocation_id,advance_id,amount_minor,reference,created_by)
     values(p_org,p_branch,allocation.id,advance.id,advance.amount_minor,d->>'reference',actor) returning id into v;
    elsif p_action in ('pay','reverse_payment') then
     when_at:=(d->>'occurred_at')::timestamptz;
     if when_at is null or when_at>now() or d->>'confirmed' is distinct from 'true' then raise exception 'actual_payment_confirmation_required' using errcode='22023';end if;
     if p_action='pay' then
      amt:=app_private.finance_amount(d->'amount_minor');
      if amt<=0 or amt>amount_remaining then raise exception 'partner_overpayment' using errcode='23514';end if;
      select * into method from public.payment_methods where organization_id=p_org and id=(d->>'method')::uuid and active and type in ('cash','bank');
     else
      select * into original from public.partner_distribution_payments where organization_id=p_org and branch_id=p_branch and allocation_id=allocation.id and id=(d->>'payment')::uuid and direction=1;
      if original.id is null then raise exception 'payment_not_found' using errcode='P0002';end if;
      amt:=original.amount_minor;
      select * into method from public.payment_methods where organization_id=p_org and id=original.payment_method_id;
      if when_at<original.occurred_at then raise exception 'invalid_reversal_date' using errcode='22023';end if;
     end if;
     if method.id is null then raise exception 'cash_or_bank_required' using errcode='23514';end if;
     session_id:=null;
     if method.type='cash' then
      session_id:=app_private.finance_session(p_org,p_branch,(d->>'session')::uuid);
      if (when_at at time zone tz)::date is distinct from (now() at time zone tz)::date then raise exception 'current_cash_date_required' using errcode='23514';end if;
      if p_action='pay' and app_private.finance_expected(p_org,session_id)<amt then raise exception 'insufficient_cash' using errcode='23514';end if;
     end if;
     insert into public.partner_distribution_payments(organization_id,branch_id,allocation_id,amount_minor,direction,reverses_id,payment_method_id,cash_session_id,occurred_at,reference,created_by)
     values(p_org,p_branch,allocation.id,amt,case when p_action='pay' then 1 else -1 end,original.id,method.id,session_id,when_at,d->>'reference',actor) returning id into v;
     if session_id is not null then
      insert into public.cash_movements(organization_id,branch_id,cash_session_id,kind,amount_minor,partner_payment_id,reason,occurred_at)
      values(p_org,p_branch,session_id,'adjustment',case when p_action='pay' then -amt else amt end,v,'Distribución a socio: '||(d->>'reference'),when_at);
     end if;
    else raise exception 'invalid_distribution_action' using errcode='22023';end if;
   end if;
  end if;
 end if;
 reply:=jsonb_build_object('id',v);
 perform app_private.record_audit(p_org,p_branch,'finance.partner.'||p_action,'partner_distributions',v,jsonb_build_object('data',d),req);
 insert into public.domain_events(organization_id,branch_id,entity_id,event_type,payload,request_id) values(p_org,p_branch,v,'finance.partner.'||p_action,jsonb_build_object('action',p_action),req);
 return app_private.idempotency_finish(p_org,actor::text,'finance.partner.'||p_action,p_key,reply);
end $$;
create function public.partner_distribution_command(p_org uuid,p_branch uuid,p_action text,p_data jsonb,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.partner_distribution_command($1,$2,$3,$4,$5) $$;
revoke all on function app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid),public.partner_distribution_command(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid),public.partner_distribution_command(uuid,uuid,text,jsonb,uuid) to authenticated;

create function app_private.partner_distributions(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not app_private.has_org_role(p_org,array['organization_owner','finance']) or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'invalid_period' using errcode='22023';end if;
 select jsonb_build_object('policy',(select to_jsonb(p) from public.partner_distribution_policies p where organization_id=p_org and branch_id=p_branch order by version desc limit 1),
 'periods',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
  select p.*,(select jsonb_agg(to_jsonb(a)||jsonb_build_object('name',s.name,'balance_minor',app_private.partner_balance(p_org,a.id),
   'payments',(select coalesce(jsonb_agg(to_jsonb(pm) order by created_at),'[]') from public.partner_distribution_payments pm where organization_id=p_org and allocation_id=a.id),
   'adjustments',(select coalesce(jsonb_agg(to_jsonb(ad) order by created_at),'[]') from public.partner_distribution_adjustments ad where organization_id=p_org and allocation_id=a.id),
   'withdrawals',(select coalesce(jsonb_agg(to_jsonb(wd) order by created_at),'[]') from public.partner_withdrawal_allocations wd where organization_id=p_org and allocation_id=a.id)))
  from public.partner_distribution_allocations a join public.staff s on s.organization_id=a.organization_id and s.id=a.staff_id where a.organization_id=p_org and a.period_id=p.id) allocations
  from public.partner_distribution_periods p where organization_id=p_org and branch_id=p_branch and period_end>=p_from and period_start<=p_to order by created_at desc limit 50
 )x)) into result;
 return result;
end $$;
create function public.partner_distributions(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.partner_distributions($1,$2,$3,$4) $$;
revoke all on function app_private.partner_distributions(uuid,uuid,date,date),public.partner_distributions(uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.partner_distributions(uuid,uuid,date,date),public.partner_distributions(uuid,uuid,date,date) to authenticated;

-- A barber who is also a configured partner sees only their approved allocation,
-- never company result, peer balances, policies, references or bank information.
create function app_private.partner_own_distributions(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare own uuid:=app_private.current_staff_id(p_org);
begin
 if own is null or not app_private.can_access_branch(p_org,p_branch) then raise exception 'forbidden' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'invalid_period' using errcode='22023';end if;
 return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
 select p.period_start,p.period_end,p.currency,p.status,a.amount_minor::text assigned_minor,app_private.partner_balance(p_org,a.id)::text balance_minor
 from public.partner_distribution_allocations a join public.partner_distribution_periods p on p.organization_id=a.organization_id and p.id=a.period_id
 where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=own and p.status in ('approved','closed')
 and p.period_end>=p_from and p.period_start<=p_to order by p.period_start desc limit 50)x));
end $$;
create function public.partner_own_distributions(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.partner_own_distributions($1,$2,$3,$4) $$;
revoke all on function app_private.partner_own_distributions(uuid,uuid,date,date),public.partner_own_distributions(uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.partner_own_distributions(uuid,uuid,date,date),public.partner_own_distributions(uuid,uuid,date,date) to authenticated;
