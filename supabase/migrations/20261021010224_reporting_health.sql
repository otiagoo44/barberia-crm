-- Bounded, authorized chart projections. Integer money is serialized as text.
create function app_private.financial_series(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text;lo timestamptz;hi timestamptz;
begin
 if not app_private.finance_access(p_org,p_branch,'report') or p_branch is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'chart_range_exceeded' using errcode='22023';end if;
 select timezone into tz from public.branches where organization_id=p_org and id=p_branch;
 lo:=p_from::timestamp at time zone tz;hi:=(p_to+1)::timestamp at time zone tz;
 return jsonb_build_object('days',(select coalesce(jsonb_agg(jsonb_build_object('date',local_date,
  'sales',gross_revenue_minor::text,'collected',collected_minor::text,'expenses',operating_expenses_minor::text,
  'result',case when unknown_fees+unknown_commissions=0 then (gross_revenue_minor-payment_processing_fees_minor-operating_expenses_minor-barber_commissions_minor)::text else null end,
  'incomplete',unknown_fees+unknown_commissions>0) order by local_date),'[]')
 from public.daily_financial_metrics where organization_id=p_org and branch_id=p_branch and local_date between p_from and p_to),
 'expenses',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'amount',amount::text) order by amount desc),'[]') from (
 select c.name,sum(x.amount) amount from (
 select category_id,amount_minor::bigint amount from public.expenses where organization_id=p_org and branch_id=p_branch and category_kind_snapshot in ('operating','salary') and occurred_at>=lo and occurred_at<hi
 union all select category_id,-amount_minor::bigint from public.expenses where organization_id=p_org and branch_id=p_branch and category_kind_snapshot in ('operating','salary') and reversed_at>=lo and reversed_at<hi
 ) x join public.expense_categories c on c.organization_id=p_org and c.id=x.category_id group by c.id,c.name order by amount desc limit 50
 ) categories));
end $$;
create function public.financial_series(p_org uuid,p_branch uuid,p_from date,p_to date) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.financial_series($1,$2,$3,$4) $$;
revoke all on function app_private.financial_series(uuid,uuid,date,date),public.financial_series(uuid,uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.financial_series(uuid,uuid,date,date),public.financial_series(uuid,uuid,date,date) to authenticated;

-- Preserve exact aggregated bigint amounts across the JSON/JavaScript boundary.
-- Existing DB RPC contracts remain compatible; HTTP uses these additive wrappers.
create function app_private.exact_financial_json(value jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(value)='object' then
  select jsonb_object_agg(k,case when k ~ '_minor$' and jsonb_typeof(v)='number' then to_jsonb(v#>>'{}') else app_private.exact_financial_json(v) end) into result from jsonb_each(value) x(k,v);
  return coalesce(result,'{}'::jsonb);
 elsif jsonb_typeof(value)='array' then
  select jsonb_agg(app_private.exact_financial_json(v) order by n) into result from jsonb_array_elements(value) with ordinality x(v,n);return coalesce(result,'[]'::jsonb);
 end if;
 return value;
end $$;
revoke all on function app_private.exact_financial_json(jsonb) from public,anon,authenticated,service_role;
create function app_private.finance_read_exact(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date,p_limit integer default 50,p_offset integer default 0,p_query text default '',p_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$ select app_private.exact_financial_json(app_private.finance_read($1,$2,$3,$4,$5,$6,$7,$8,$9)) $$;
create function public.finance_read_exact(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date,p_limit integer default 50,p_offset integer default 0,p_query text default '',p_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.finance_read_exact($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
create function app_private.financial_export_exact(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date) returns jsonb
language sql security definer set search_path='' as $$ select app_private.exact_financial_json(app_private.financial_export($1,$2,$3,$4,$5)) $$;
create function public.financial_export_exact(p_org uuid,p_branch uuid,p_view text,p_from date,p_to date) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.financial_export_exact($1,$2,$3,$4,$5) $$;
revoke all on function app_private.finance_read_exact(uuid,uuid,text,date,date,integer,integer,text,uuid),public.finance_read_exact(uuid,uuid,text,date,date,integer,integer,text,uuid),app_private.financial_export_exact(uuid,uuid,text,date,date),public.financial_export_exact(uuid,uuid,text,date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.finance_read_exact(uuid,uuid,text,date,date,integer,integer,text,uuid),public.finance_read_exact(uuid,uuid,text,date,date,integer,integer,text,uuid),app_private.financial_export_exact(uuid,uuid,text,date,date),public.financial_export_exact(uuid,uuid,text,date,date) to authenticated;

-- Never silently add known capacity to unknown capacity and display a percentage.
do $chart_projection$
declare source text;original text;
begin
 source:=pg_get_functiondef('app_private.dashboard(uuid,uuid,uuid,date,date)'::regprocedure);
 original:='sum((m.metrics->>''available_minutes'')::bigint) available_minutes';
 if position(original in source)=0 then raise exception 'capacity_projection_mismatch';end if;
 source:=replace(source,original,'case when bool_or(m.metrics->>''available_minutes'' is null) then null else sum((m.metrics->>''available_minutes'')::bigint) end available_minutes');
 source:=replace(source,'sum((metrics->>''available_minutes'')::bigint) available_minutes',
 'case when bool_or(metrics->>''available_minutes'' is null) then null else sum((metrics->>''available_minutes'')::bigint) end available_minutes');
 original:='sum((metrics->>''completed_count'')::bigint) completed from all_metrics group by local_date';
 if position(original in source)=0 then raise exception 'chart_projection_mismatch';end if;
 source:=replace(source,original,'sum((metrics->>''completed_count'')::bigint) completed,sum((metrics->>''appointments_count'')::bigint) appointments,sum((metrics->>''cancelled_count'')::bigint) cancelled,sum((metrics->>''no_show_count'')::bigint) no_shows,sum((metrics->>''rebookings_count'')::bigint) rebookings from all_metrics group by local_date');
 execute source;
end $chart_projection$;

create table app_private.scheduler_heartbeat (
 id boolean primary key default true check(id),completed_at timestamptz not null,result jsonb not null
);
alter table app_private.scheduler_heartbeat enable row level security;
revoke all on app_private.scheduler_heartbeat from public,anon,authenticated,service_role;
do $heartbeat$
declare source text;original text;
begin
 source:=pg_get_functiondef('app_private.run_scheduled_jobs()'::regprocedure);
 original:='return jsonb_build_object(''completed'',completed,''failed'',failed,''awaiting_configuration'',awaiting);';
 if position(original in source)=0 then raise exception 'heartbeat_patch_mismatch';end if;
 execute replace(source,original,'insert into app_private.scheduler_heartbeat(id,completed_at,result) values(true,clock_timestamp(),jsonb_build_object(''completed'',completed,''failed'',failed,''awaiting_configuration'',awaiting)) on conflict(id) do update set completed_at=excluded.completed_at,result=excluded.result; '||original);
end $heartbeat$;
create function app_private.operations_health(p_secret text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare stats jsonb;
begin
 perform app_private.check_gateway(p_secret,'worker');
 select jsonb_build_object('database',true,'heartbeat_at',(select completed_at from app_private.scheduler_heartbeat),
 'heartbeat_age_seconds',(select extract(epoch from now()-completed_at)::integer from app_private.scheduler_heartbeat),
 'pending',count(*) filter(where status in ('pending','retry')),
 'dead',count(*) filter(where status='dead'),
 'expired_leases',count(*) filter(where status='running' and leased_until<=now()),
 'awaiting_configuration',count(*) filter(where status='awaiting_configuration'),
 'oldest_due_seconds',coalesce(max(extract(epoch from now()-available_at)) filter(where status in ('pending','retry') and available_at<now()),0)::integer,
 'booking_constraint',exists(select 1 from pg_constraint where conrelid='public.appointments'::regclass and contype='x')) into stats from public.automation_jobs;
 return stats;
end $$;
create function public.operations_health(p_secret text) returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.operations_health($1) $$;
revoke all on function app_private.operations_health(text),public.operations_health(text) from public,anon,authenticated,service_role;
grant execute on function app_private.operations_health(text),public.operations_health(text) to anon;
