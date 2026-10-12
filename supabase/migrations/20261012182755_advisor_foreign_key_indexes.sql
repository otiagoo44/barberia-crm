-- Four FK paths identified by the managed Supabase advisor after initial release.
-- Partial actor indexes avoid indexing null actors in system-generated aggregates.
-- Rollback: DROP INDEX these four indexes; no data changes required.
create index capacity_snapshots_staff_fk_idx on public.capacity_snapshots(organization_id,staff_id);
create index capacity_snapshots_actor_fk_idx on public.capacity_snapshots(created_by) where created_by is not null;
create index customer_service_returns_actor_fk_idx on public.customer_service_returns(created_by) where created_by is not null;
create index daily_customer_activity_actor_fk_idx on public.daily_customer_activity(created_by) where created_by is not null;
