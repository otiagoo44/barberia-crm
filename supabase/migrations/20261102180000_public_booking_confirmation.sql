-- Add only public confirmation labels. Keep the existing reservation engine,
-- gateway, advisory lock, idempotency payload and exclusion constraints intact.
do $confirmation$
declare definition text;
begin
 definition:=pg_get_functiondef('app_private.public_booking_unattributed(text,text,text,text[],text,timestamptz,jsonb,uuid,text)'::regprocedure);
 if position('return v_result-''id''-''staff_id'';' in definition)=0 then raise exception 'public_confirmation_inventory_mismatch'; end if;
 definition:=replace(definition,'return v_result-''id''-''staff_id'';',
 $body$return (v_result-'id'-'staff_id') || jsonb_build_object(
 'staff', (select jsonb_build_object('slug',s.slug,'name',s.name) from public.staff s where s.organization_id=v_org and s.id=(v_result->>'staff_id')::uuid),
 'services', (select coalesce(jsonb_agg(jsonb_build_object('name',a.name_snapshot) order by a.name_snapshot),'[]'::jsonb) from public.appointment_services a where a.organization_id=v_org and a.appointment_id=(v_result->>'id')::uuid));$body$);
 execute definition;
end $confirmation$;
