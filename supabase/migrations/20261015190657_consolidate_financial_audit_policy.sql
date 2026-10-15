-- Preserve the union of the previous two SELECT policies in one predicate.
-- This removes duplicate policy evaluation without widening finance access.
alter policy management_read on public.audit_logs using (
  app_private.has_org_role(organization_id, array['organization_owner'])
  or (
    branch_id is not null
    and app_private.has_org_role(organization_id, array['manager'])
    and app_private.can_access_branch(organization_id, branch_id)
  )
  or (
    action like 'finance.%'
    and (
      app_private.has_org_role(organization_id, array['finance'])
      or (branch_id is not null and app_private.finance_access(organization_id, branch_id, 'report'))
    )
  )
);
-- Retain the old policy object on the existing BYPASSRLS maintenance role.
-- Authenticated clients evaluate only the consolidated policy above.
alter policy financial_audit_read on public.audit_logs to service_role;
