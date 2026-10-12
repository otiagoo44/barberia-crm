# Evidencia de verificación

Fecha: 2026-10-12. Los resultados se actualizan al ejecutar cada control; presencia de código no significa prueba realizada.

## IMPLEMENTADO

Next.js/React/TypeScript modular, Supabase Auth server, cookies HttpOnly, PostgreSQL multi-tenant con 35 tablas públicas + 4 privadas, 15 migrations, RLS por rol/branch/cliente/recurso, writes RPC y FKs compuestas. Intervalos y EXCLUDE GiST, composición de duración/precio server-side, idempotencia, audit/history/events/outbox, queue leases/retry/dead. Agenda/público, clientes/history/archive/notas/tags/preferencias, walk-ins, retención por cliente/servicio, rebooking, dashboard/metas y agregados recalculables. CI y recuperación aislada reproducible.

## PROBADO localmente

- Instalación npm con lockfile y audit sin vulnerabilidades en el control ejecutado.
- Build de producción Next completó compilación y TypeScript; rutas dinámicas del workspace/API.
- Lint y typecheck ejecutados; resultado final se registra tras últimos cambios.
- Cinco tests unitarios: normalización/validación de teléfonos, shape externo y fechas, CSV seguro, composición de selección y timezone/DST.
- PostgreSQL 17 nativo: migrations aplicadas desde base vacía y 46 contratos aprobados antes de la última proyección; suite final agrega archive de cliente. No se usó DB remota para fixtures.
- 100 conexiones intentando mismo staff/intervalo: exactamente una reserva. Dos/tres barberos: dos/tres reservas simultáneas. 100 retries misma key: una reserva y un evento.
- Tenant A/B, branches A1/A2/B1, owner/manager/reception/barber, tenant spoofing, FK cross-tenant, perfil/membresía desactivados, inmutabilidad, anon/direct writes y reportes fuera de recepción.
- Create/reschedule/cancel/status, closure/time off/configuración incompatible, público/honeypot/rate limit/dedup, walk-in, timeline/paginación, retorno, metas/dashboard, jobs/notificaciones, audit append-only, bootstrap global y request_id.
- Chromium: login en 360/390/768/1440 px, sin overflow ni errores de página, cabeceras CSP/nosniff/frame, teclado y formulario registro. Un caso aprobado; tres casos de negocio/Auth real omitidos en local, no contados como aprobados.
- Carga 10/50/100 organizaciones: 1500 muestras SQL en total, cinco workloads, cero errores en la ejecución válida. [Resultados](verification/load-results.json) con percentiles y EXPLAIN. Las consultas frías tuvieron p95 alto; no certifica capacidad administrada.

## Supabase conectado

Auditoría previa confirmó cero usuarios/tablas/migrations, reconfirmado inmediatamente antes de aplicar. Las migrations probadas fueron aplicadas mediante MCP y sus versiones alineadas con los archivos CLI. Credenciales de gateway se registraron solo como hashes; originales permanecen fuera de Git. No se cargaron fixtures, demo, usuarios o negocios ficticios al proyecto remoto.

Advisors tras hardening: ninguna advertencia/error de seguridad; cuatro INFO por tablas privadas sin policy intencional. Rendimiento: sin FKs sin índice; INFO unused_index porque no hay datos/tráfico. Ninguna función definer expuesta en public. La última migration se verifica y registra al completar el release.

## NO PROBADO todavía

- Supabase Auth real y navegador→API→DB de los flujos de negocio hasta que finalice el job `supabase-e2e`. El job usa Docker Supabase y cuentas Auth reales; su estado se añadirá con enlace a ejecución y commit.
- Restore administrado/PITR del proyecto real, RPO/RTO reales, correo SMTP de producción y recuperación de cuenta por correo.
- Carga HTTP/Realtime administrada, dos navegadores de organizaciones distintas en deployment real, caída/reconexión y coste de streams server-side.
- Integraciones WhatsApp/webhook/calendario y envíos reales. Los jobs están awaiting_configuration, no “delivered”.
- Deploy/dominio/env de Vercel real y piloto con datos del primer negocio.

## PENDIENTE por datos/configuración externa

Cuenta real de administrador/propietario, nombre/branding/dominio/branches/staff/servicios/precios/horarios del negocio; configuración SMTP/Auth/plan/backups/PITR, evidencia de restore y scheduler de producción; proveedor de WhatsApp/webhooks cuando se elija. Finanzas implementadas; onboarding/reglas históricas/piloto requieren verificación.

## Límites de V1

Un principal por booking, servicios de hasta 480 min y reserva dentro de un día local. Sin buffers/traslados entre branches. Agenda máximo 8 días/2000 filas con advertencia; listas de lookup limitadas a 100 y referencias necesitan filtro si se alcanza; exports activos ≤9999 clientes. El owner puede reactivar clientes/branches archivados explícitamente. Importador masivo/pipeline/portal público firmado/legal anonymization son extensiones, no flujos implementados. Todos los límites están visibles/documentados; no hay números de escalabilidad de producción inventados.

Ver [checklist](PRODUCTION_RELEASE_CHECKLIST.md) para los controles necesarios antes de abrir reservas con clientes reales.


## Continuación financiera — 12/10/2026

Baseline lint/typecheck/5unit/47DB/build pasó. Las 15 migrations originales intactas; remoto tenía14/cero organizaciones. Nuevas migrations desde cero y47regresiones+13contratos financieros pasaron Postgres aislado. Unit ampliado11/11; audit high cero; build financiero pasó. Dry-run539/535READY/4NEEDS_REVIEW/cero writes. Browser local1passed/4Auth real skipped (sinDocker). CI original [38311824540](https://github.com/otiagoo44/barberia-crm/actions/runs/38311824540): quality success, restore failure SET ROLE supabase_admin; browser omitido. Corrección portable/finanzas/browser añadida, resultado final pendiente de su ejecución. Vercel no encontró proyecto barberia-crm ni equipos; plan no demostrado.
