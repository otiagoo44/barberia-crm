-- Managed Supabase includes pg_cron. Bare PostgreSQL test instances may not.
-- No public endpoint, HTTP request or provider credentials are needed.
do $scheduler$
begin
 if not exists(select 1 from pg_available_extensions where name='pg_cron') then
  raise notice 'pg_cron unavailable: automatic scheduling requires managed Supabase or an external worker';
  return;
 end if;
 execute 'create extension if not exists pg_cron';
 perform cron.schedule('barberia-internal-worker','* * * * *','select app_private.run_scheduled_jobs();');
end $scheduler$;
