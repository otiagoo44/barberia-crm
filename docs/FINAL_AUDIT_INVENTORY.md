# Inventario de revisión final

Base: `7a8fe7b7c91d3aa7fbe42d0fa8f1903b02db91ae`. 131 archivos inventariados. SHA256, líneas, frontera cliente/servidor y llamadas DB extraídas del AST en [inventario JSON](verification/final-file-inventory.json). Los checks estáticos recorren todos los archivos; la evidencia dinámica es por contrato y flujo, no una afirmación de cobertura exhaustiva de cada estado o lectura humana de cada línea. Archivos declarativos/assets se incluyen por su impacto en despliegue/interfaz.

| Archivo | Revisión y frontera |
|---|---|
| `.github/rulesets/main.json` | CI/deploy, secretos y scheduler único |
| `.github/workflows/ci.yml` | CI/deploy, secretos y scheduler único |
| `.github/workflows/load.yml` | CI/deploy, secretos y scheduler único |
| `eslint.config.mjs` | Compilación/lectura estática; ver límites de evidencia |
| `next.config.ts` | Compilación/lectura estática; ver límites de evidencia |
| `playwright.config.ts` | Compilación/lectura estática; ver límites de evidencia |
| `scripts/ci-environment.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/configure-1717-operations.sql` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/enable-scheduler.sql` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/finance-dry-run.ts` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/onboard-1717.d.mts` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/onboard-1717.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/prepare-release.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/qa-website-booking.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/seed-demo.ts` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/smoke-production.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `scripts/validate-deployment.mjs` | Destino/secretos/side effects revisados; smoke y generadores sin writes cloud |
| `src/app/(workspace)/[organization]/[module]/page.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/(workspace)/[organization]/layout.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/api/auth/[action]/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/export/customers/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/finance/[resource]/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/finance/import/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/health/ready/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/health/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/jobs/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/live/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/public/[resource]/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/api/workspace/[resource]/route.ts` | Auth o gateway; shape/Origin/grants/RPC/RLS/errores/proyección |
| `src/app/auth/callback/route.ts` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/book/[organization]/[[...branch]]/page.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/error.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/globals.css` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/icon.svg` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/layout.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/login/page.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/not-found.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/page.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/app/reset-password/page.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/components/shell.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/components/ui.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/analytics/dashboard.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/appointments/agenda.tsx` | Intervalos/servicios, cambio de branch y validación server-side |
| `src/features/appointments/appointment-dialog.tsx` | Intervalos/servicios, cambio de branch y validación server-side |
| `src/features/appointments/booking-form.tsx` | Intervalos/servicios, cambio de branch y validación server-side |
| `src/features/auth/auth-form.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/booking/public-booking.tsx` | Intervalos/servicios, cambio de branch y validación server-side |
| `src/features/configuration/configuration.tsx` | Whitelist tipada/editor; RPC vuelve a comprobar rol y scope |
| `src/features/configuration/daily-availability.tsx` | Whitelist tipada/editor; RPC vuelve a comprobar rol y scope |
| `src/features/configuration/definitions.ts` | Whitelist tipada/editor; RPC vuelve a comprobar rol y scope |
| `src/features/configuration/record-manager.tsx` | Whitelist tipada/editor; RPC vuelve a comprobar rol y scope |
| `src/features/customers/customers.tsx` | Cliente pertinente, búsqueda, historial/export; RLS/RPC |
| `src/features/finance/cash.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/checkout.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/client.ts` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/dashboard.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/forms.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/import-limits.ts` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/import-parser.ts` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/import-ui.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/finance/profit-sharing.tsx` | Importes, confirmación, idempotencia, scopes; autoridad en PostgreSQL |
| `src/features/goals/goals.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/organizations/context.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/organizations/create-organization.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/organizations/launch-guide.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/services/service-picker.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/features/walk-ins/queue.tsx` | Compilación/lectura estática; ver límites de evidencia |
| `src/hooks/use-clock.ts` | Compilación/lectura estática; ver límites de evidencia |
| `src/hooks/use-live.ts` | Compilación/lectura estática; ver límites de evidencia |
| `src/lib/auth.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/branding.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/capabilities.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/client.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/cookie-security.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/environment-boundary.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/http.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/public-booking.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/secret-auth.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/supabase/server.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/types.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/lib/validation.ts` | Frontera servidor/cliente, validación, sesión y scopes |
| `src/proxy.ts` | Compilación/lectura estática; ver límites de evidencia |
| `src/services/automation/provider.ts` | Compilación/lectura estática; ver límites de evidencia |
| `supabase/config.toml` | Compilación/lectura estática; ver límites de evidencia |
| `supabase/migrations/20261012171437_tenant_core.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012171442_authorization.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012171446_configuration.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012171451_scheduling.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012171456_operations.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012171501_analytics_automation.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012173606_read_models.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012180348_product_hardening.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012181534_final_read_models.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012182755_advisor_foreign_key_indexes.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012183007_reporting_access.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012183207_bounded_read_permissions.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012183541_archived_branch_history.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012183917_platform_admin_audit.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012184839_customer_detail_branding.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012210000_website_booking.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012223818_finance_schema.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012223852_finance_transactions.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012224111_finance_read_import.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261012224355_booking_finance_hardening.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261015190206_booking_attribution_rls.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261015190657_consolidate_financial_audit_policy.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261015191802_worker_tick_record_scope.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261019154027_database_scheduler.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261019213732_profit_sharing.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261019220146_enable_database_cron.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `supabase/migrations/20261019223415_final_authorization_hardening.sql` | Replay transaccional + contratos RLS/RPC/finanzas; historial preservado |
| `tests/e2e/operations.spec.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/e2e/permissions.spec.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/e2e/setup.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/database.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/finance.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/fixtures.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/hardening.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/onboarding.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/run-hardening.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/integration/run.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/load/run.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/recovery/local-supabase.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/security/contracts.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/unit/domain.test.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/unit/environment.test.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/unit/finance-import.test.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/unit/public-booking.test.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tests/unit/secret-auth.test.ts` | Pruebas/fixtures aislados; Auth real y restore solo en CI Docker |
| `tsconfig.json` | Compilación/lectura estática; ver límites de evidencia |
| `vercel.json` | CI/deploy, secretos y scheduler único |
