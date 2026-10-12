-- Customer detail adds editable preference references and most frequent completed principal service.
-- Read-only projection. Rollback: restore previous customer_detail definition.
alter table public.services add constraint maintenance_requires_interval check(not requires_maintenance or suggested_return_days is not null);
create or replace function app_private.list_customers(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_owner boolean; v_operator boolean; v_own uuid; v_branches uuid[]; begin
 if not app_private.is_org_member(p_org) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit not between 1 and 100 or length(coalesce(p_query,''))>80 or p_retention not in ('all','archived','due_soon','due','overdue','lapsed') then raise exception 'invalid_query' using errcode='22023'; end if;
 v_owner:=app_private.has_org_role(p_org,array['organization_owner']);v_operator:=app_private.has_org_role(p_org,array['manager','receptionist']);v_own:=app_private.current_staff_id(p_org);
 select coalesce(array_agg(b.id),'{}'::uuid[]) into v_branches from public.branches b where b.organization_id=p_org and app_private.can_access_branch(p_org,b.id);
 with scoped as (
 select c.*,case when c.expected_return_at is null then 'active' when c.expected_return_at>now()+make_interval(days=>s.retention_due_soon_days) then 'active' when c.expected_return_at>now() then 'due_soon' when c.expected_return_at>now()-interval '1 day' then 'due' when c.expected_return_at<now()-make_interval(days=>s.retention_lapsed_days) then 'lapsed' else 'overdue' end as retention_status
 from public.customers c join public.organization_settings s on s.organization_id=c.organization_id
 where c.organization_id=p_org and ((p_retention='archived' and c.archived_at is not null) or (p_retention<>'archived' and c.archived_at is null)) and (v_owner or (v_operator and (c.home_branch_id=any(v_branches) or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=any(v_branches)) or exists(select 1 from public.walk_in_entries w where w.organization_id=p_org and w.customer_id=c.id and w.branch_id=any(v_branches)))) or (v_own is not null and exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.staff_id=v_own and a.branch_id=any(v_branches))))
 and (p_branch is null or c.home_branch_id=p_branch or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=p_branch))
 and (coalesce(p_query,'')='' or c.name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or c.normalized_phone like replace(replace(p_query,'%',''),'_','')||'%')
 and (p_cursor is null or (c.created_at,c.id)<((p_cursor->>'created_at')::timestamptz,(p_cursor->>'id')::uuid))
 ), page as (
 select * from scoped where p_retention in ('all','archived') or (retention_status=p_retention and not do_not_contact and (followup_after is null or followup_after<=now())) order by created_at desc,id desc limit p_limit+1
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from (select * from page order by created_at desc,id desc limit p_limit) p),'[]'::jsonb),'has_more',(select count(*)>p_limit from page),'next_cursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at desc,id desc offset p_limit-1 limit 1)) into v_result;
 return v_result; end $$;
create or replace function app_private.customer_detail(p_org uuid,p_customer uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; begin
 if not app_private.can_read_customer(p_org,p_customer) then raise exception 'forbidden' using errcode='42501'; end if;
 select jsonb_build_object('customer',to_jsonb(c),'stats',(select jsonb_build_object('visits',count(*) filter(where a.status='completed'),'no_shows',count(*) filter(where a.status='no_show'),'cancellations',count(*) filter(where a.status='cancelled'),'last_visit_at',max(a.completed_at),'known_production_value_minor',sum(a.price_minor) filter(where a.status='completed'),'priced_visits',count(*) filter(where a.status='completed' and a.price_minor is not null),'habitual_service',(select aps.name_snapshot from public.appointment_services aps join public.appointments av on av.organization_id=aps.organization_id and av.id=aps.appointment_id where av.organization_id=p_org and av.customer_id=p_customer and av.status='completed' and aps.duration_minutes>0 and aps.composition_mode in ('standalone','override') and app_private.can_read_appointment(p_org,av.id) group by aps.name_snapshot order by count(*) desc,aps.name_snapshot limit 1)) from public.appointments a where a.organization_id=p_org and a.customer_id=p_customer and app_private.can_read_appointment(p_org,a.id)),
 'preferences',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',key,'value',value)),'[]'::jsonb) from public.customer_preferences where organization_id=p_org and customer_id=p_customer),
 'tags',(select coalesce(jsonb_agg(tag),'[]'::jsonb) from public.customer_tags where organization_id=p_org and customer_id=p_customer)) into v_result from public.customers c where c.organization_id=p_org and c.id=p_customer;
 return v_result; end $$;
