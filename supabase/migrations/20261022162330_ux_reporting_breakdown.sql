-- Additive chart projections over the existing ledgers and authorized dashboard.
-- No writes, new role grants, policy changes, or alternate financial calculation.
do $financial_breakdown$
declare source text; needle text;
begin
  source := pg_get_functiondef('app_private.financial_series(uuid,uuid,date,date)'::regprocedure);
  needle := '''expenses'',operating_expenses_minor::text,';
  if position(needle in source) = 0 then raise exception 'financial_series_projection_mismatch'; end if;
  execute replace(source, needle, needle || '
    ''fees'',case when unknown_fees=0 then payment_processing_fees_minor::text else null end,
    ''commissions'',case when unknown_commissions=0 then barber_commissions_minor::text else null end,');
end $financial_breakdown$;

do $operational_breakdown$
declare source text; needle text;
begin
  source := pg_get_functiondef('app_private.dashboard(uuid,uuid,uuid,date,date)'::regprocedure);
  needle := 's.name,sum((m.metrics->>''completed_count'')::bigint) completed,';
  if position(needle in source) = 0 then raise exception 'staff_projection_mismatch'; end if;
  source := replace(source, needle, needle || '
    sum((m.metrics->>''completed_minutes'')::bigint) completed_minutes,');
  needle := 'return v_result;';
  if position(needle in source) = 0 then raise exception 'dashboard_projection_mismatch'; end if;
  source := replace(source, needle, $projection$
    -- Categories only group the already authorized service counts. No global counts.
    v_result := v_result || jsonb_build_object('by_category', (
      select coalesce(jsonb_agg(to_jsonb(q) order by q.completed desc,q.name),'[]'::jsonb)
      from (
        select coalesce(nullif(trim(s.category),''),'Sin categoría') name,
          sum((m->>'completed')::bigint) completed
        from jsonb_array_elements(v_result->'by_service') m
        join public.services s on s.organization_id=p_org and s.id=(m->>'service_id')::uuid
        group by coalesce(nullif(trim(s.category),''),'Sin categoría')
      ) q
    ));
    -- Current actionable retention, matching list_customers definitions. This is
    -- deliberately not a historical series or a value selected by report dates.
    v_result := v_result || jsonb_build_object('retention_now', (
      select jsonb_build_object('as_of',now(),
        'due',count(*) filter(where c.expected_return_at>now()-interval '1 day'),
        'overdue',count(*) filter(where c.expected_return_at<=now()-interval '1 day'
          and c.expected_return_at>=now()-make_interval(days=>s.retention_lapsed_days)),
        'lapsed',count(*) filter(where c.expected_return_at<now()-make_interval(days=>s.retention_lapsed_days)))
      from public.customers c
      join public.organization_settings s on s.organization_id=c.organization_id
      where c.organization_id=p_org and c.archived_at is null and not c.do_not_contact
        and c.expected_return_at<=now() and (c.followup_after is null or c.followup_after<=now())
        and app_private.can_read_customer(p_org,c.id)
        and (p_branch is null or c.home_branch_id=p_branch or exists(
          select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=p_branch))
        and (p_staff is null or exists(select 1 from public.appointments a where
          a.organization_id=p_org and a.customer_id=c.id and a.staff_id=p_staff
          and (p_branch is null or a.branch_id=p_branch) and app_private.can_read_appointment(p_org,a.id)))
    ));
    return v_result;
  $projection$);
  execute source;
end $operational_breakdown$;
