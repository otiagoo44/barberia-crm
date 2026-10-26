-- The cloud scheduler migration contains three UTF-8 strings decoded as Latin-1.
-- Repair only those literals prospectively. Keep the historical ledger, existing
-- notifications, function owner, signature, security mode and ACL unchanged.
-- Unicode escapes keep this migration independent of shell/editor encoding.
do $notification_encoding$
declare source text; repaired text;
begin
  source := pg_get_functiondef('app_private.process_job_core(uuid,uuid)'::regprocedure);
  repaired := replace(source,
    U&'Actividad de la barber\00c3\00ada', U&'Actividad de la barber\00eda');
  repaired := replace(repaired,
    U&'Revis\00c3\00a1 la agenda', U&'Revis\00e1 la agenda');
  repaired := replace(repaired,
    U&'acciones del d\00c3\00ada.', U&'acciones del d\00eda.');
  if repaired is distinct from source then
    execute repaired;
  end if;
end $notification_encoding$;
