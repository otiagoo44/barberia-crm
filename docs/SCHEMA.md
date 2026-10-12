# Schema final e inventario

PostgreSQL 17. Schemas: public (API protegida), app_private (helpers/infra no expuesta), auth (Supabase). Todas las 35 tablas de public tienen RLS. UUID, timestamps timestamptz, actor/timestamps cuando corresponde. El DDL exacto y reproducible está en migrations; este documento explica su función sin duplicarlo.

| Dominio | Tablas | Relaciones/invariantes principales |
|---|---|---|
| Empresa | organizations, organization_settings | Slug global único; timezone/moneda/branding; opciones por tenant |
| Locales | branches, branch_settings, branch_business_hours, branch_closures | `(organization_id,branch_id)`; slug único dentro del tenant; aperturas/cierres extraordinarios |
| Identidad/acceso | profiles, organization_memberships, membership_branch_access | Auth user distinto de staff; una membresía por tenant/user; scopes de branch explícitos |
| Recursos | staff, staff_branch_assignments, staff_service_capabilities | Staff puede no tener profile y puede tener varias branches; FK asignación valida local del appointment |
| Servicios | services, branch_services | Modos standalone/additive/included/override; duración/precio por branch; mantenimiento requiere intervalo configurado |
| Disponibilidad | staff_availability_rules, staff_availability_exceptions, staff_time_off | Reglas locales, excepciones de día y descansos; intervalos válidos; horarios semanales cross-branch no solapados |
| Clientes | customers, customer_notes, customer_preferences, customer_tags, customer_service_returns | Teléfono único por organización; clientes compartidos entre branches; archive; retorno general y por servicio especial |
| Agenda | appointments, appointment_services, appointment_status_history | tstzrange generado, EXCLUDE staff/rango en estados activos; snapshots de servicio/precio; history append-only |
| Walk-in | walk_in_entries | Referencia mismo customer; servicios solicitados UUID[], preferencia/asignación y enlace a appointment |
| Objetivos | goals | Organization/branch/staff opcionales, metric/period/target y rango temporal completo local |
| Automatización | domain_events, automation_jobs, notifications | Outbox atómico, jobs con dedupe/lease/retry/dead/awaiting_configuration; destinatario autorizado |
| Auditoría | audit_logs | Append-only, actor/action/entity/diff seguro/request_id; org null solo para bootstrap global de plataforma |
| Analytics | daily_metrics, daily_service_metrics, daily_customer_activity, capacity_snapshots | Granularidad branch/staff/día; source truth citas/snapshots; rebuild idempotente; capacidad histórica desconocida sin snapshot |

Private tables: platform_admins, gateway_credentials (solo hashes), idempotency_keys, rate_limits. Sin grants SELECT a anon/authenticated, RLS deny by default. El esquema privado no se expone en Data API.

Vistas invoker: visits (completed appointments); daily_organization_metrics, daily_branch_metrics, daily_staff_metrics (agregación de daily_metrics). No se duplican tablas de visitas ni totales organizacionales. No se crearon tasks/pipeline opcionales ni service_composition_rules adicionales: los cuatro modos cubren V1 sin otra tabla.

## Migrations, en orden

1. `20261012171437_tenant_core.sql`: entidades/FKs/constraints/trigger tenant/RLS base/índices.
2. `20261012171442_authorization.sql`: helpers, policies, grants e invoker visits.
3. `20261012171446_configuration.sql`: onboarding, membresías, whitelist CRUD, audit/event/idempotencia.
4. `20261012171451_scheduling.sql`: intervalos, composición, disponibilidad, booking/reschedule/status/public gateway.
5. `20261012171456_operations.sql`: clientes/timeline/retention/walk-in/day/search/export.
6. `20261012171501_analytics_automation.sql`: snapshots/agregados/dashboard/colas/worker.
7. `20261012173606_read_models.sql`: session, agenda/detail y goal progress.
8. `20261012180348_product_hardening.sql`: mantenimiento, retorno inferido, métrica recurrentes, idempotencia/leases y correlación.
9. `20261012181534_final_read_models.sql`: servicio reciente live, memberships paginadas y timeline inicial.
10. `20261012182755_advisor_foreign_key_indexes.sql`: cuatro FKs identificadas por advisor.
11. `20261012183007_reporting_access.sql`: informes fuera de permisos de recepción.
12. `20261012183207_bounded_read_permissions.sql`: scopes de lectura autorizados reutilizados por request.
13. `20261012183541_archived_branch_history.sql`: lectura histórica de local archivado y request headers vacíos seguros.
14. `20261012183917_platform_admin_audit.sql`: bootstrap/revocación global auditados.
15. `20261012184839_customer_detail_branding.sql`: preferencias editables, servicio habitual, archive explícito y mantenimiento válido.

Versiones creadas mediante CLI y registradas en Supabase. Local/staging usan las mismas migrations. Índices adicionales son aditivos; cambios de funciones/policies se versionan. [Rollback](ROLLBACK_PLAN.md).

## API de dominio

Onboarding/configuración: create_organization_for_email, manage_membership, manage_record, update_organization, remove_schedule_record. Reads: session_context, list_memberships, list_customers, customer_detail, customer_timeline, search_workspace, list_agenda, appointment_detail, day_status, dashboard, goal_progress, maintenance_due.

Agenda: list_availability, create_booking, reschedule_booking, transition_booking, cancel_booking. Walk-in: create_walkin, assign_walkin, close_walkin. Público: public_rate_check, public_catalog, public_availability, public_booking, gateway_health. Worker: worker_tick, claim_jobs, process_job, fail_job. record_export autoriza/audita export.

Todos los wrappers expuestos son SECURITY INVOKER; los checks reales están en app_private. No hay RPC que acepte SQL arbitrario. JSON configurable admite exclusivamente campos permitidos para cada entidad.
