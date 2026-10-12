-- Reuse live authorization scope within a bounded read; avoids repeated auth lookups per appointment/customer.
-- Same tenant/branch/own-staff semantics are covered by tests/security/contracts.ts.
-- Rollback: restore the previous read functions; no rows change.
create or replace function app_private.list_agenda(p_org uuid,p_branch uuid,p_staff uuid,p_service uuid,p_status text,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_full boolean; v_own uuid; begin
 v_full:=app_private.has_org_role(p_org,array['organization_owner','manager','receptionist']);v_own:=app_private.current_staff_id(p_org);
 if not v_full and v_own is null then raise exception 'forbidden' using errcode='42501'; end if;
 if not app_private.can_access_branch(p_org,p_branch) or p_to<=p_from or p_to-p_from>interval '8 days' or (p_staff is not null and not app_private.can_read_staff(p_org,p_staff)) or (p_status is not null and p_status not in ('scheduled','confirmed','checked_in','in_service','completed','cancelled','no_show','rescheduled')) then raise exception 'forbidden' using errcode='42501'; end if;
 with rows as (
 select a.id,a.branch_id,a.customer_id,a.staff_id,a.starts_at,a.ends_at,a.duration_minutes,a.status,a.currency,a.price_minor,c.name as customer_name,s.name as staff_name,
 (select coalesce(jsonb_agg(jsonb_build_object('id',aps.service_id,'name',aps.name_snapshot)),'[]'::jsonb) from public.appointment_services aps where aps.organization_id=p_org and aps.appointment_id=a.id) as services
 from public.appointments a join public.customers c on c.organization_id=a.organization_id and c.id=a.customer_id join public.staff s on s.organization_id=a.organization_id and s.id=a.staff_id
 where a.organization_id=p_org and a.branch_id=p_branch and a.starts_at<p_to and a.ends_at>p_from and (v_full or a.staff_id=v_own) and (p_staff is null or a.staff_id=p_staff) and (p_status is null or a.status=p_status) and (p_service is null or exists(select 1 from public.appointment_services aps where aps.organization_id=p_org and aps.appointment_id=a.id and aps.service_id=p_service)) order by a.starts_at,a.id limit 2001
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(q) order by q.starts_at,q.id) from (select * from rows limit 2000) q),'[]'::jsonb),'has_more',(select count(*)>2000 from rows)) into v_result; return v_result; end $$;
create or replace function app_private.list_customers(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_owner boolean; v_operator boolean; v_own uuid; v_branches uuid[]; begin
 if not app_private.is_org_member(p_org) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit not between 1 and 100 or length(coalesce(p_query,''))>80 or p_retention not in ('all','due_soon','due','overdue','lapsed') then raise exception 'invalid_query' using errcode='22023'; end if;
 v_owner:=app_private.has_org_role(p_org,array['organization_owner']);v_operator:=app_private.has_org_role(p_org,array['manager','receptionist']);v_own:=app_private.current_staff_id(p_org);
 select coalesce(array_agg(b.id),'{}'::uuid[]) into v_branches from public.branches b where b.organization_id=p_org and b.active and app_private.can_access_branch(p_org,b.id);
 with scoped as (
 select c.*,case when c.expected_return_at is null then 'active' when c.expected_return_at>now()+make_interval(days=>s.retention_due_soon_days) then 'active' when c.expected_return_at>now() then 'due_soon' when c.expected_return_at>now()-interval '1 day' then 'due' when c.expected_return_at<now()-make_interval(days=>s.retention_lapsed_days) then 'lapsed' else 'overdue' end as retention_status
 from public.customers c join public.organization_settings s on s.organization_id=c.organization_id
 where c.organization_id=p_org and c.archived_at is null and (v_owner or (v_operator and (c.home_branch_id=any(v_branches) or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=any(v_branches)) or exists(select 1 from public.walk_in_entries w where w.organization_id=p_org and w.customer_id=c.id and w.branch_id=any(v_branches)))) or (v_own is not null and exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.staff_id=v_own and a.branch_id=any(v_branches))))
 and (p_branch is null or c.home_branch_id=p_branch or exists(select 1 from public.appointments a where a.organization_id=p_org and a.customer_id=c.id and a.branch_id=p_branch))
 and (coalesce(p_query,'')='' or c.name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or c.normalized_phone like replace(replace(p_query,'%',''),'_','')||'%')
 and (p_cursor is null or (c.created_at,c.id)<((p_cursor->>'created_at')::timestamptz,(p_cursor->>'id')::uuid))
 ), page as (
 select * from scoped where p_retention='all' or (retention_status=p_retention and not do_not_contact and (followup_after is null or followup_after<=now())) order by created_at desc,id desc limit p_limit+1
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from (select * from page order by created_at desc,id desc limit p_limit) p),'[]'::jsonb),'has_more',(select count(*)>p_limit from page),'next_cursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at desc,id desc offset p_limit-1 limit 1)) into v_result;
 return v_result; end $$;
