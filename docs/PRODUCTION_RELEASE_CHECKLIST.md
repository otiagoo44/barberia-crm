# Checklist del primer release

Estado por control y evidencia en [VERIFICATION](VERIFICATION.md). Esta lista es el gate operacional, no una declaración de controles ya ejecutados.

## Código y DB

- [ ] CI del commit en main verde: install/audit/lint/typecheck/unit/build/Postgres/Supabase local/Auth E2E.
- [ ] Historial remoto coincide con archivos de migrations; prueba de instalación local/staging desde cero.
- [ ] RLS activo, writes directos revocados, public wrappers invoker, private helpers con search_path vacío/EXECUTE explícito.
- [ ] Tests tenant A/B, branches A1/A2/B1, roles reales Auth y deactivación pasan.
- [ ] 100 requests mismo intervalo ≤1; 2/3 staff simultáneos; retry misma key =1.
- [ ] Build artefactos/repositorio sin service_role, DB password, JWT secret o variables privadas públicas.
- [ ] Booking público/interno, reprogramación/cancelación/check-in/in-service/completed, walk-in/history/retention/rebooking/metas/reportes probados en staging.
- [ ] Responsive y consola verificadas en desktop/móvil con datos reales de prueba; teclado/foco/reduced-motion.

## Supabase y Vercel

- [ ] Dominio HTTPS y APP_URL correcto; Origin de producción funciona y origen externo falla.
- [ ] Variables privadas en gestor de secretos; Preview separado de Production.
- [ ] Data API **solo public**; app_private fuera de schemas expuestos. No permitir auto-grants de tablas futuras.
- [ ] Auth email verificado, SMTP de producción, redirect/site URL exactos, recuperación probada y límites antiabuso.
- [ ] Platform admin real bootstrap y owner real con acceso mínimo; MFA para operadores de plataforma.
- [ ] Realtime probado con dos navegadores, tenant/branch aislado, reconexión/red lenta y cleanup.
- [ ] Worker invocado con CRON_SECRET, secreto incorrecto rechazado; cola drena, retries/dead/awaiting_configuration observables.
- [ ] Frecuencia cron compatible con plan Vercel o scheduler alternativo seguro.
- [ ] Health y ready monitoreados; alertas de error rate/p95/queue depth/DB connections/CPU/RAM/size/Realtime/invocaciones.
- [ ] Política de retención de audit/jobs/snapshots revisada. No borrar evidencia para ahorrar almacenamiento.

## Datos y recuperación

- [ ] Nombre/logo/colores/timezone/moneda/branches/staff/servicios/precios/horarios del negocio real confirmados.
- [ ] Horarios/capacidades cubren los servicios reales; no hay asignación incompatible ni traslado imposible entre locales.
- [ ] Teléfonos normalizados y duplicados revisados; no se cargó seed demo en producción.
- [ ] Backup/PITR/retención habilitados según plan y RPO aceptado por dueño.
- [ ] **Restore real aislado ejecutado** con evidencia, RPO/RTO medidos y responsables identificados.
- [ ] Rollback ensayado en staging con datos y compatibilidad de RPC; no usar DROP/reset en producción.
- [ ] Política de privacidad/consentimiento/retención definida; notas sin datos sensibles innecesarios.
- [ ] Operación piloto controlada: reservar, atender, completar, rebook, revisar dashboard/historia, cancelar una cita de prueba.

WhatsApp/API externa, webhooks y finanzas siguen pendientes hasta disponer de proveedor/credenciales/reglas reales. Jobs externos deben permanecer awaiting_configuration; no simular envío exitoso.
