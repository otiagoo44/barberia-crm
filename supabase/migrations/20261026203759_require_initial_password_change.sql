-- Provisioned accounts must replace their temporary password before business access.
-- No passwords or password hashes are stored here. Only GoTrue's actual password
-- update clears the gate; user_metadata, confirmation and MFA never clear it.
create table app_private.required_password_changes (
 profile_id uuid primary key references auth.users(id) on delete cascade,
 issued_at timestamptz not null default now(),
 completed_at timestamptz,
 reason text not null default 'provisioned_account'
);
alter table app_private.required_password_changes enable row level security;
revoke all on app_private.required_password_changes from public,anon,authenticated,service_role;

create function app_private.password_change_required() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.required_password_changes r
 where r.profile_id=(select auth.uid()) and r.completed_at is null)
$$;
revoke all on function app_private.password_change_required() from public,anon,authenticated,service_role;

create function app_private.complete_required_password_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password
 and coalesce(new.encrypted_password,'')<>'' then
  update app_private.required_password_changes set completed_at=now()
  where profile_id=new.id and completed_at is null;
 end if;
 return new;
end $$;
revoke all on function app_private.complete_required_password_change() from public,anon,authenticated,service_role;
create trigger complete_required_password_change
after update of encrypted_password on auth.users
for each row execute function app_private.complete_required_password_change();

-- Every existing restrictive RLS gate and business RPC already uses this helper.
create or replace function app_private.assurance_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.session_is_live()
 and not app_private.password_change_required()
 and (not app_private.requires_mfa() or coalesce((select auth.jwt()->>'aal'),'aal1')='aal2')
$$;
create or replace function app_private.security_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if app_private.current_profile() is null or not app_private.session_is_live() then
  raise exception 'session_revoked' using errcode='42501';
 end if;
 return jsonb_build_object('required',app_private.requires_mfa(),
 'level',coalesce(auth.jwt()->>'aal','aal1'),
 'password_change_required',app_private.password_change_required(),
 'allowed',app_private.assurance_allowed());
end $$;
