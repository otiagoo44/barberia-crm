-- Bounded list enrichment. Existing membership/branch/record decisions remain
-- authoritative in list_customers and can_read_appointment.
create index appointments_customer_completed_lookup on public.appointments
 (organization_id,customer_id,completed_at desc,id desc) where status='completed';
create index appointments_customer_upcoming_lookup on public.appointments
 (organization_id,customer_id,ends_at,starts_at)
 where status in ('scheduled','confirmed','checked_in','in_service');

create function app_private.customer_list_view(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_page jsonb; v_items jsonb;
begin
 v_page:=app_private.list_customers(p_org,p_branch,p_query,p_cursor,p_limit,p_retention);
 select coalesce(jsonb_agg(c.item || jsonb_build_object(
   'last_visit_at',v.completed_at,'last_service_name',v.service_name,'last_staff_name',v.staff_name
 ) order by c.position),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_page->'items') with ordinality c(item,position)
 left join lateral (
   select a.completed_at,s.name staff_name,
     (select aps.name_snapshot from public.appointment_services aps
      where aps.organization_id=p_org and aps.appointment_id=a.id
        and aps.duration_minutes>0 and aps.composition_mode in ('standalone','override')
      order by aps.name_snapshot,aps.service_id limit 1) service_name
   from public.appointments a join public.staff s on s.organization_id=a.organization_id and s.id=a.staff_id
   where a.organization_id=p_org and a.customer_id=(c.item->>'id')::uuid and a.status='completed'
     and (p_branch is null or a.branch_id=p_branch)
     and app_private.can_read_appointment(p_org,a.id)
   order by a.completed_at desc,a.id desc limit 1
 ) v on true;
 return jsonb_set(v_page,'{items}',v_items);
end $$;
create function public.customer_list_view(p_org uuid,p_branch uuid,p_query text,p_cursor jsonb,p_limit integer,p_retention text)
returns jsonb language sql security invoker set search_path='' as $$ select app_private.customer_list_view($1,$2,$3,$4,$5,$6) $$;
revoke all on function public.customer_list_view(uuid,uuid,text,jsonb,integer,text),app_private.customer_list_view(uuid,uuid,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.customer_list_view(uuid,uuid,text,jsonb,integer,text),app_private.customer_list_view(uuid,uuid,text,jsonb,integer,text) to authenticated;
