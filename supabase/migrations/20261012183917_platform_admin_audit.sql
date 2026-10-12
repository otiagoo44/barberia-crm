-- Global platform bootstrap/revocation has no organization yet; only platform admin can read it.
-- Business audit rows continue to carry their organization via guarded domain functions.
-- Rollback: preserve the append-only evidence; do not erase bootstrap records.
alter table public.audit_logs alter column organization_id drop not null;
create function app_private.audit_platform_admins() returns trigger language plpgsql security definer set search_path='' as $$
declare v_profile uuid; begin
  if TG_OP='DELETE' then v_profile:=old.profile_id; else v_profile:=new.profile_id; end if;
  perform app_private.record_audit(null,null,'platform_admin.'||lower(TG_OP),'platform_admins',v_profile,jsonb_build_object('profile_id',v_profile),app_private.request_id());
  return null;
end $$;
revoke all on function app_private.audit_platform_admins() from public,anon,authenticated;
create trigger platform_admin_audit after insert or update or delete on app_private.platform_admins for each row execute function app_private.audit_platform_admins();
