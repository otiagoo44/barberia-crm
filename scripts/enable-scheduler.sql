-- Operational setup for the verified Supabase project, after database_scheduler.
-- Run as postgres. No external HTTP calls, credentials or paid Vercel cron needed.
create extension if not exists pg_cron;
select cron.schedule('barberia-internal-worker','* * * * *',
  'select app_private.run_scheduled_jobs();');
select jobname,schedule,active from cron.job where jobname='barberia-internal-worker';
-- Monitor: select status,return_message,start_time,end_time from cron.job_run_details
-- where jobid=(select jobid from cron.job where jobname='barberia-internal-worker')
-- order by start_time desc limit 10;
-- Pause without dropping data: select cron.alter_job(job_id, active := false);
