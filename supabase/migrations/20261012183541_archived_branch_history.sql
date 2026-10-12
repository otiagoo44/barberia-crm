-- Archived locations retain authorized historical visibility and may be reactivated by owner.
-- Operational writes still require an active branch; availability independently checks activation.
-- Rollback: keep history visibility; restoring the old predicate hides archived history.
create or replace function app_private.request_id() returns uuid language plpgsql stable set search_path='' as $$
declare v text; begin
  v:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-request-id';
  return coalesce(v::uuid,gen_random_uuid());
exception when invalid_text_representation then return gen_random_uuid();
end $$;
create or replace function app_private.can_access_branch(p_org uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.is_platform_admin() or exists(
   select 1 from public.organization_memberships m
   join public.organizations o on o.id=m.organization_id
   where m.organization_id=p_org and m.profile_id=app_private.current_profile() and m.active and o.active
     and exists(select 1 from public.branches b where b.organization_id=p_org and b.id=p_branch)
     and (m.all_branches or exists(select 1 from public.membership_branch_access a where a.organization_id=p_org and a.membership_id=m.id and a.branch_id=p_branch))
 ) $$;
create or replace function app_private.can_operate_branch(p_org uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.has_org_role(p_org,array['organization_owner','manager','receptionist'])
   and app_private.can_access_branch(p_org,p_branch)
   and exists(select 1 from public.branches where organization_id=p_org and id=p_branch and active) $$;
create or replace function app_private.list_customers(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_owner boolean; v_operator boolean; v_own uuid; v_branches uuid[]; begin
 if not app_private.is_org_member(p_org) or (p_branch is not null and not app_private.can_access_branch(p_org,p_branch)) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_limit not between 1 and 100 or length(coalesce(p_query,''))>80 or p_retention not in ('all','due_soon','due','overdue','lapsed') then raise exception 'invalid_query' using errcode='22023'; end if;
 v_owner:=app_private.has_org_role(p_org,array['organization_owner']);v_operator:=app_private.has_org_role(p_org,array['manager','receptionist']);v_own:=app_private.current_staff_id(p_org);
 select coalesce(array_agg(b.id),'{}'::uuid[]) into v_branches from public.branches b where b.organization_id=p_org and app_private.can_access_branch(p_org,b.id);
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
