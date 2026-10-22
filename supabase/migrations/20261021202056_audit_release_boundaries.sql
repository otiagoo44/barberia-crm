-- Forward-only audit corrections. No business history is changed or enabled.
-- Enforce retirement at the Auth storage boundary too: clients can call GoTrue
-- directly, so an HTTP-only factor-count check is insufficient and can race.
create table app_private.mfa_factor_mutation_locks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 1
);
alter table app_private.mfa_factor_mutation_locks enable row level security;
revoke all on app_private.mfa_factor_mutation_locks from public,anon,authenticated,service_role;

create function app_private.retain_verified_mfa_factor() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='verified' and
    (tg_op='DELETE' or new.status is distinct from old.status or new.user_id is distinct from old.user_id)
    and exists(select 1 from auth.users where id=old.user_id) then
  -- A real row update serializes removals at READ COMMITTED and produces a
  -- serialization failure rather than write skew at REPEATABLE READ.
  insert into app_private.mfa_factor_mutation_locks(user_id) values(old.user_id)
  on conflict(user_id) do update set revision=app_private.mfa_factor_mutation_locks.revision+1;
  if not exists(select 1 from auth.mfa_factors where user_id=old.user_id and status='verified' and id<>old.id) then
   raise exception 'mfa_last_factor' using errcode='23514';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function app_private.retain_verified_mfa_factor() from public,anon,authenticated,service_role;
create trigger retain_verified_mfa_factor before delete or update of status,user_id on auth.mfa_factors
 for each row execute function app_private.retain_verified_mfa_factor();

-- Policy versions retain the explicit agreement about losses. Existing policies
-- remain byte-for-byte intact and cannot operate until a new confirmed version.
alter table public.partner_distribution_policies add column losses_reference text
 check(losses_reference is null or length(btrim(losses_reference)) between 5 and 250);
do $distribution_guard$
declare source text;needle text;
begin
 source:=pg_get_functiondef('app_private.partner_distribution_command(uuid,uuid,text,jsonb,uuid)'::regprocedure);
 needle:='insert into public.partner_distribution_policies(organization_id,branch_id,version,enabled,periodicity,approval_role,withdrawals_mode,evidence_reference,created_by)';
 if position(needle in source)=0 then raise exception 'distribution_policy_guard_mismatch';end if;
 source:=replace(source,needle,
  'if length(btrim(coalesce(d->>''losses_reference'',''''))) not between 5 and 250 then raise exception ''losses_agreement_required'' using errcode=''23514'';end if; '||
  'insert into public.partner_distribution_policies(organization_id,branch_id,version,enabled,periodicity,approval_role,withdrawals_mode,evidence_reference,created_by,losses_reference)');
 source:=replace(source,'d->>''withdrawals_mode'',d->>''evidence_reference'',actor) returning id into v;',
  'd->>''withdrawals_mode'',d->>''evidence_reference'',actor,d->>''losses_reference'') returning id into v;');
 source:=replace(source,'if policy.enabled is distinct from true or currency_code<>''PYG'' then',
  'if policy.enabled is distinct from true or policy.losses_reference is null or currency_code<>''PYG'' then');
 execute source;
end $distribution_guard$;

-- Once a withdrawal has reduced a partner balance, its underlying expense
-- cannot be reversed independently. Preserve both ledgers and require an
-- explicit audited allocation adjustment, as with commission settlements.
do $withdrawal_guard$
declare source text;needle text;
begin
 source:=pg_get_functiondef('app_private.finance_command(uuid,uuid,text,jsonb,uuid)'::regprocedure);
 needle:='before_data:=to_jsonb(e);update public.expenses set status=''reversed''';
 if position(needle in source)=0 then raise exception 'withdrawal_reversal_guard_mismatch';end if;
 source:=replace(source,needle,
  'if exists(select 1 from public.staff_advances a join public.partner_withdrawal_allocations w on w.organization_id=a.organization_id and w.advance_id=a.id where a.organization_id=p_org and a.expense_id=v) then raise exception ''allocated_advance_requires_adjustment'' using errcode=''23514'';end if; '||needle);
 execute source;
end $withdrawal_guard$;

-- Serialize aggregate money before PostgREST/JavaScript can round bigint JSON.
do $distribution_projection$
declare source text;
begin
 source:=pg_get_functiondef('app_private.partner_distributions(uuid,uuid,date,date)'::regprocedure);
 if position('return result;' in source)=0 then raise exception 'distribution_projection_mismatch';end if;
 execute replace(source,'return result;','return app_private.exact_financial_json(result);');
end $distribution_projection$;

-- Check the operation even if every submitted block already exists. Dedupe
-- and idempotency must never bypass current role, assignment or branch checks.
do $daily_guard$
declare source text;needle text;
begin
 source:=pg_get_functiondef('app_private.save_daily_blocks(uuid,uuid,uuid,date,jsonb,uuid)'::regprocedure);
 needle:='reply:=app_private.idempotency_begin';
 if position(needle in source)=0 then raise exception 'daily_authorization_guard_mismatch';end if;
 source:=replace(source,needle,
  'if not (app_private.has_org_role(p_org,array[''organization_owner'',''manager'']) or '||
  '(app_private.has_org_role(p_org,array[''barber'']) and p_staff=app_private.current_staff_id(p_org) and exists(select 1 from public.organization_settings where organization_id=p_org and barber_can_edit_availability))) '||
  'or not exists(select 1 from public.staff_branch_assignments a join public.staff s on s.organization_id=a.organization_id and s.id=a.staff_id join public.branches b on b.organization_id=a.organization_id and b.id=a.branch_id where a.organization_id=p_org and a.branch_id=p_branch and a.staff_id=p_staff and a.active and s.active and b.active) '||
  'then raise exception ''forbidden'' using errcode=''42501'';end if; '||needle);
 execute source;
end $daily_guard$;

-- Counts only; no SQL text, customer details or cross-tenant business payloads.
do $monitor$
declare source text;needle text;
begin
 source:=pg_get_functiondef('app_private.operations_health(text)'::regprocedure);
 needle:='''expired_leases'',count(*) filter(where status=''running'' and leased_until<=now()),';
 if position(needle in source)=0 then raise exception 'operations_health_guard_mismatch';end if;
 source:=replace(source,needle,needle||
  '''running'',count(*) filter(where status=''running''),'||
  '''anomalous_leases'',count(*) filter(where status=''running'' and (leased_until is null or leased_until>now()+interval ''5 minutes'')),'||
  '''lock_waiters'',(select count(*) from pg_stat_activity where datname=current_database() and wait_event_type=''Lock''),'||
  '''oldest_lock_wait_seconds'',(select coalesce(max(extract(epoch from now()-query_start)),0)::integer from pg_stat_activity where datname=current_database() and wait_event_type=''Lock''),');
 execute source;
end $monitor$;
