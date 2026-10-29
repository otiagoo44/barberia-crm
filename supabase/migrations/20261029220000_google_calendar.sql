-- Calendar sync is an external projection. Booking transactions never call Google.
-- Credentials and queue are private; public wrappers are security invoker.
alter table app_private.gateway_credentials drop constraint gateway_credentials_name_check;
alter table app_private.gateway_credentials add constraint gateway_credentials_name_check check(name in ('booking','worker','calendar'));
create table app_private.calendar_connections (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 staff_id uuid not null, profile_id uuid not null references public.profiles(id),
 status text not null default 'disconnected' check(status in ('connected','disconnected','reconnect')),
 google_subject text, google_email text, calendar_id text, refresh_cipher text,
 auth_version uuid not null default gen_random_uuid(), last_synced_at timestamptz,
 last_error text, unique(organization_id,staff_id),
 foreign key(organization_id,staff_id) references public.staff(organization_id,id)
);
create table app_private.calendar_oauth (
 state_hash text primary key check(length(state_hash)=64), connection_id uuid not null references app_private.calendar_connections(id),
 profile_id uuid not null references public.profiles(id), verifier_cipher text not null,
 expires_at timestamptz not null default now()+interval '10 minutes', exchange_key uuid,
 used_at timestamptz
);
create table app_private.calendar_jobs (
 connection_id uuid not null references app_private.calendar_connections(id),
 organization_id uuid not null, appointment_id uuid not null,
 revision bigint not null default 1, status text not null default 'pending' check(status in ('pending','running','retry','done','dead')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease uuid, leased_until timestamptz, last_error text,
 primary key(connection_id,appointment_id),
 foreign key(organization_id,appointment_id) references public.appointments(organization_id,id)
);
create index calendar_jobs_pending on app_private.calendar_jobs(available_at) where status in ('pending','retry','running');
create table app_private.calendar_dispatch_config (
 singleton boolean primary key default true check(singleton), origin text not null,
 vault_secret_id uuid not null
);
create index calendar_connections_profile on app_private.calendar_connections(profile_id);
create index calendar_oauth_connection on app_private.calendar_oauth(connection_id);
create index calendar_oauth_profile on app_private.calendar_oauth(profile_id);
create index calendar_jobs_appointment on app_private.calendar_jobs(organization_id,appointment_id);
alter table app_private.calendar_connections enable row level security;
alter table app_private.calendar_oauth enable row level security;
alter table app_private.calendar_jobs enable row level security;
alter table app_private.calendar_dispatch_config enable row level security;
revoke all on app_private.calendar_connections,app_private.calendar_oauth,app_private.calendar_jobs,app_private.calendar_dispatch_config from public,anon,authenticated,service_role;

create function app_private.enqueue_calendar(p_connection uuid,p_org uuid,p_appointment uuid) returns void
language sql security definer set search_path='' as $$
 insert into app_private.calendar_jobs(connection_id,organization_id,appointment_id)
 values(p_connection,p_org,p_appointment)
 on conflict(connection_id,appointment_id) do update set revision=app_private.calendar_jobs.revision+1,
 status=case when app_private.calendar_jobs.status='running' then 'running' else 'pending' end,
 attempts=0,available_at=now(),last_error=null;
$$;
revoke all on function app_private.enqueue_calendar(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function app_private.calendar_appointment_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare c record;
begin
 for c in select id from app_private.calendar_connections where organization_id=new.organization_id and status='connected'
 and (staff_id=new.staff_id or (tg_op='UPDATE' and staff_id=old.staff_id)) loop
  perform app_private.enqueue_calendar(c.id,new.organization_id,new.id);
 end loop;
 return new;
end $$;
revoke all on function app_private.calendar_appointment_changed() from public,anon,authenticated,service_role;
create trigger calendar_appointment_changed after insert or update of staff_id,starts_at,ends_at,status,customer_id on public.appointments
 for each row execute function app_private.calendar_appointment_changed();
-- Service snapshots may change after the appointment row was written.
create function app_private.calendar_services_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.appointments; c record;
begin
 select * into a from public.appointments where id=coalesce(new.appointment_id,old.appointment_id);
 for c in select id from app_private.calendar_connections where organization_id=a.organization_id and staff_id=a.staff_id and status='connected' loop
  perform app_private.enqueue_calendar(c.id,a.organization_id,a.id);
 end loop;
 return null;
end $$;
revoke all on function app_private.calendar_services_changed() from public,anon,authenticated,service_role;
create trigger calendar_services_changed after insert or update or delete on public.appointment_services
 for each row execute function app_private.calendar_services_changed();

create function app_private.calendar_user(p_org uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_staff public.staff; v_connection app_private.calendar_connections; result jsonb;
begin
 if not app_private.is_org_member(p_org) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_action='status' then
  select coalesce(jsonb_agg(jsonb_build_object('staff_id',s.id,'name',s.name,'own',s.profile_id=auth.uid(),
   'status',coalesce(c.status,'disconnected'),'email',c.google_email,'last_synced_at',c.last_synced_at,
   'last_error',c.last_error,'pending',(select count(*) from app_private.calendar_jobs j where j.connection_id=c.id and j.status in ('pending','retry','running')),
   'failed',(select count(*) from app_private.calendar_jobs j where j.connection_id=c.id and j.status='dead')) order by s.name),'[]') into result
  from public.staff s left join app_private.calendar_connections c on c.organization_id=s.organization_id and c.staff_id=s.id
  where s.organization_id=p_org and s.active and (s.profile_id=auth.uid() or app_private.has_org_role(p_org,array['organization_owner']))
   and exists(select 1 from public.staff_branch_assignments a where a.organization_id=p_org and a.staff_id=s.id and a.active and app_private.can_access_branch(p_org,a.branch_id));
  return jsonb_build_object('people',result,'transport_configured',exists(select 1 from app_private.calendar_dispatch_config));
 end if;
 select * into v_staff from public.staff where organization_id=p_org and id=(p_data->>'staff')::uuid and active and profile_id=auth.uid();
 if v_staff.id is null or not exists(select 1 from public.staff_branch_assignments a where a.organization_id=p_org and a.staff_id=v_staff.id and a.active and app_private.can_access_branch(p_org,a.branch_id)) then raise exception 'own_staff_required' using errcode='42501'; end if;
 insert into app_private.calendar_connections(organization_id,staff_id,profile_id) values(p_org,v_staff.id,auth.uid()) on conflict(organization_id,staff_id) do nothing;
 select * into v_connection from app_private.calendar_connections where organization_id=p_org and staff_id=v_staff.id for update;
 if v_connection.profile_id<>auth.uid() then raise exception 'calendar_account_changed' using errcode='42501'; end if;
 if p_action='begin' then
  delete from app_private.calendar_oauth where connection_id=v_connection.id or expires_at<now();
  if length(p_data->>'verifier_cipher') not between 50 and 4096 or (p_data->>'state_hash') !~ '^[0-9a-f]{64}$' then raise exception 'invalid_oauth' using errcode='22023'; end if;
  insert into app_private.calendar_oauth(state_hash,connection_id,profile_id,verifier_cipher) values(p_data->>'state_hash',v_connection.id,auth.uid(),p_data->>'verifier_cipher');
 elsif p_action='disconnect' then
  update app_private.calendar_connections set status='disconnected',refresh_cipher=null,auth_version=gen_random_uuid(),last_error=null where id=v_connection.id;
  delete from app_private.calendar_oauth where connection_id=v_connection.id;
 elsif p_action='retry' then
  if v_connection.status<>'connected' then raise exception 'calendar_reconnect_required' using errcode='22023'; end if;
  update app_private.calendar_jobs set status='pending',attempts=0,available_at=now(),last_error=null where connection_id=v_connection.id and status in ('retry','dead');
 else raise exception 'invalid_action' using errcode='22023'; end if;
 perform app_private.record_audit(p_org,null,'calendar.'||p_action,'staff',v_staff.id,'{}',app_private.request_id());
 return jsonb_build_object('connection_id',v_connection.id);
end $$;
create function public.calendar_user(p_org uuid,p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.calendar_user($1,$2,$3) $$;
revoke all on function app_private.calendar_user(uuid,text,jsonb),public.calendar_user(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.calendar_user(uuid,text,jsonb),public.calendar_user(uuid,text,jsonb) to authenticated;

create function app_private.calendar_consume(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt app_private.calendar_oauth; c app_private.calendar_connections; o public.organizations;
begin
 select * into attempt from app_private.calendar_oauth where state_hash=p_hash and profile_id=app_private.current_profile() and expires_at>now() and used_at is null for update;
 if attempt.connection_id is null then raise exception 'invalid_oauth_state' using errcode='42501'; end if;
 select * into c from app_private.calendar_connections where id=attempt.connection_id;
 if not app_private.is_org_member(c.organization_id) or not exists(select 1 from public.staff where organization_id=c.organization_id and id=c.staff_id and active and profile_id=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 update app_private.calendar_oauth set used_at=now(),exchange_key=gen_random_uuid() where state_hash=p_hash returning * into attempt;
 select * into o from public.organizations where id=c.organization_id;
 return jsonb_build_object('connection_id',c.id,'organization',c.organization_id,'staff',c.staff_id,'profile',c.profile_id,
 'slug',o.slug,'name',o.name,'timezone',o.timezone,'calendar_id',c.calendar_id,'google_subject',c.google_subject,
 'verifier_cipher',attempt.verifier_cipher,'exchange_key',attempt.exchange_key);
end $$;
create function public.calendar_consume(p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.calendar_consume($1) $$;
revoke all on function app_private.calendar_consume(text),public.calendar_consume(text) from public,anon,authenticated,service_role;
grant execute on function app_private.calendar_consume(text),public.calendar_consume(text) to authenticated;

create function app_private.calendar_worker(p_secret text,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_connection app_private.calendar_connections; v_job app_private.calendar_jobs; v_appointment public.appointments; result jsonb;
begin
 perform app_private.check_gateway(p_secret,'calendar');
 if p_action='claim' then
  update app_private.calendar_jobs set status='dead',lease=null,leased_until=null,last_error='attempts_exhausted' where attempts>=8 and (status in ('pending','retry') or (status='running' and leased_until<now()));
  with candidates as (
   select j.connection_id,j.appointment_id from app_private.calendar_jobs j join app_private.calendar_connections c on c.id=j.connection_id
   join public.staff s on s.organization_id=c.organization_id and s.id=c.staff_id and s.active and s.profile_id=c.profile_id
   join public.organizations o on o.id=c.organization_id and o.active
   where c.status='connected' and exists(select 1 from public.organization_memberships m join public.profiles p on p.id=m.profile_id and p.active where m.organization_id=c.organization_id and m.profile_id=c.profile_id and m.active)
    and j.attempts<8 and ((j.status in ('pending','retry') and j.available_at<=now()) or (j.status='running' and j.leased_until<now()))
   order by j.available_at,j.connection_id,j.appointment_id limit 2 for update of j skip locked
  ), claimed as (
   update app_private.calendar_jobs j set status='running',lease=gen_random_uuid(),leased_until=now()+interval '3 minutes',attempts=j.attempts+1
    from candidates q where j.connection_id=q.connection_id and j.appointment_id=q.appointment_id returning j.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;
  return result;
 end if;
 select * into v_connection from app_private.calendar_connections where id=(p_data->>'connection')::uuid for update;
 if p_action='authorize' then
  if v_connection.id is null or not exists(select 1 from app_private.calendar_oauth t where t.connection_id=v_connection.id and t.exchange_key=(p_data->>'exchange_key')::uuid and t.used_at is not null and t.expires_at>now()) then raise exception 'invalid_oauth_state' using errcode='42501'; end if;
  if not exists(select 1 from public.staff s join public.organization_memberships m on m.profile_id=s.profile_id and m.organization_id=s.organization_id join auth.users u on u.id=s.profile_id join public.profiles p on p.id=s.profile_id where s.id=v_connection.staff_id and s.organization_id=v_connection.organization_id and s.active and s.profile_id=v_connection.profile_id and m.active and p.active and u.email_confirmed_at is not null) then raise exception 'forbidden' using errcode='42501'; end if;
  if coalesce(length(p_data->>'refresh_cipher'),0) not between 50 and 8192 or coalesce(length(p_data->>'calendar_id'),0) not between 1 and 1024 or coalesce(length(p_data->>'google_subject'),0) not between 1 and 255 then raise exception 'invalid_oauth' using errcode='22023'; end if;
  update app_private.calendar_connections set status='connected',refresh_cipher=p_data->>'refresh_cipher',calendar_id=p_data->>'calendar_id',google_subject=p_data->>'google_subject',google_email=p_data->>'email',auth_version=gen_random_uuid(),last_error=null where id=v_connection.id;
  delete from app_private.calendar_oauth where connection_id=v_connection.id;
  -- Backfill only future active appointments after the professional's consent.
  for v_appointment in select * from public.appointments where organization_id=v_connection.organization_id and staff_id=v_connection.staff_id and ends_at>now() and status in ('scheduled','confirmed','checked_in','in_service') loop
   perform app_private.enqueue_calendar(v_connection.id,v_connection.organization_id,v_appointment.id);
  end loop;
  update app_private.calendar_jobs set status='pending',attempts=0,available_at=now() where connection_id=v_connection.id and status in ('dead','retry');
  return '{"ok":true}';
 end if;
 select * into v_job from app_private.calendar_jobs where connection_id=v_connection.id and appointment_id=(p_data->>'appointment')::uuid for update;
 if v_job.status is distinct from 'running' or v_job.lease is distinct from (p_data->>'lease')::uuid or v_job.leased_until<now() then raise exception 'invalid_lease' using errcode='42501'; end if;
 if p_action='snapshot' then
  if v_connection.status<>'connected' then return jsonb_build_object('disabled',true); end if;
  select * into v_appointment from public.appointments where id=v_job.appointment_id and organization_id=v_connection.organization_id;
  if not exists(select 1 from public.staff s join public.organization_memberships m on m.profile_id=s.profile_id and m.organization_id=s.organization_id join public.profiles p on p.id=s.profile_id where s.id=v_connection.staff_id and s.organization_id=v_connection.organization_id and s.active and s.profile_id=v_connection.profile_id and m.active and p.active and (m.all_branches or exists(select 1 from public.membership_branch_access x where x.organization_id=m.organization_id and x.membership_id=m.id and x.branch_id=v_appointment.branch_id))) then
   update app_private.calendar_connections set status='reconnect',last_error='access_changed' where id=v_connection.id;
   return jsonb_build_object('disabled',true);
  end if;
  return jsonb_build_object('organization',v_connection.organization_id,'staff',v_connection.staff_id,'profile',v_connection.profile_id,'auth_version',v_connection.auth_version,'calendar_id',v_connection.calendar_id,'refresh_cipher',v_connection.refresh_cipher,
   'appointment',v_appointment.id,'revision',v_job.revision,'remove',v_appointment.staff_id<>v_connection.staff_id or v_appointment.status in ('cancelled','rescheduled'),
   'starts_at',v_appointment.starts_at,'ends_at',v_appointment.ends_at,'status',v_appointment.status,
   'services',(select string_agg(name_snapshot,' + ' order by created_at,id) from public.appointment_services where organization_id=v_connection.organization_id and appointment_id=v_appointment.id),
   'slug',(select slug from public.organizations where id=v_connection.organization_id),
   'timezone',(select timezone from public.branches where organization_id=v_connection.organization_id and id=v_appointment.branch_id),
   'location',(select address from public.branches where organization_id=v_connection.organization_id and id=v_appointment.branch_id));
 elsif p_action='finish' then
  if p_data->>'auth_version' is distinct from v_connection.auth_version::text then
   update app_private.calendar_jobs set status='pending',lease=null,leased_until=null,attempts=0 where connection_id=v_connection.id and appointment_id=v_job.appointment_id;
   return '{"stale":true}';
  end if;
  update app_private.calendar_jobs set status=case when revision<>(p_data->>'revision')::bigint then 'pending' else 'done' end,
   attempts=0,lease=null,leased_until=null,last_error=null,available_at=now() where connection_id=v_connection.id and appointment_id=v_job.appointment_id;
  update app_private.calendar_connections set last_synced_at=now(),last_error=null where id=v_connection.id and status='connected';
 elsif p_action='fail' then
  if p_data->>'auth_version' is not null and p_data->>'auth_version' is distinct from v_connection.auth_version::text then
   update app_private.calendar_jobs set status='pending',lease=null,leased_until=null,attempts=0 where connection_id=v_connection.id and appointment_id=v_job.appointment_id;
   return '{"stale":true}';
  end if;
  update app_private.calendar_jobs set status=case when attempts>=8 then 'dead' else 'retry' end,available_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),lease=null,leased_until=null,last_error=case when p_data->>'code'='authorization_required' then 'authorization_required' else 'provider_unavailable' end where connection_id=v_connection.id and appointment_id=v_job.appointment_id;
  update app_private.calendar_connections set status=case when p_data->>'code'='authorization_required' then 'reconnect' else status end,last_error=case when p_data->>'code'='authorization_required' then 'authorization_required' else 'provider_unavailable' end where id=v_connection.id;
 else raise exception 'invalid_action' using errcode='22023'; end if;
 return '{"ok":true}';
end $$;
create function public.calendar_worker(p_secret text,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.calendar_worker($1,$2,$3) $$;
revoke all on function app_private.calendar_worker(text,text,jsonb),public.calendar_worker(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.calendar_worker(text,text,jsonb),public.calendar_worker(text,text,jsonb) to anon,authenticated;

-- Optional managed transport. No request until an operator configures a Vault
-- secret and an HTTPS origin. The queue also supports an external cron worker.
create function app_private.dispatch_calendar() returns void language plpgsql security invoker set search_path='' as $$
declare cfg app_private.calendar_dispatch_config; token text;
begin
 if not exists(select 1 from app_private.calendar_jobs j join app_private.calendar_connections c on c.id=j.connection_id where c.status='connected' and ((j.status in ('pending','retry') and j.available_at<=now()) or (j.status='running' and j.leased_until<now()))) then return; end if;
 select * into cfg from app_private.calendar_dispatch_config;
 if cfg.origin is null or cfg.origin !~ '^https://[a-zA-Z0-9.-]+$' then return; end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where id=$1' into token using cfg.vault_secret_id;
 if token is null then return; end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=''{}''::jsonb,timeout_milliseconds:=55000)' using cfg.origin||'/api/calendar/worker',jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json');
end $$;
revoke all on function app_private.dispatch_calendar() from public,anon,authenticated,service_role;
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_net') and exists(select 1 from pg_extension where extname='pg_cron') then
  execute 'create extension if not exists pg_net with schema extensions';
  perform cron.schedule('barberia-google-calendar','* * * * *','select app_private.dispatch_calendar();');
 end if;
end $$;
