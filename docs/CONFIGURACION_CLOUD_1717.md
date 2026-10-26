# Configuración cloud de 17:17

> **Actualización 26/10:** producción `tbcfhagteyqufjkmbxzz` y staging Free `zdogqqmitpbwjgohwcww` están en 41 migraciones. Backup/restore real y upgrade aislado aprobados antes de aplicar producción. Plan confirmado ejecutado con sesión owner AAL2 auténtica; SMTP existente conservado y recuperación confirmada por el usuario. [Recibos y límites actuales](ACTIVACION_PRODUCTIVA_1717_20261026.md). La matriz/observaciones del 24/10 que siguen son históricas; no volver a aplicar sus versiones.

Inspección nueva 24/10/2026. Ref exclusivo `tbcfhagteyqufjkmbxzz`. Cloud tiene **34** migraciones; este candidato tiene **40**. No se aplicaron migraciones ni datos productivos durante esta intervención.

## Matriz completa de migraciones

| Migración                                                   | Local | Cloud                | Dependencias                                      | Riesgo                                                          | Acción                                          |
| ----------------------------------------------------------- | ----- | -------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| 1. `20261012171437_tenant_core.sql`                         | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 2. `20261012171442_authorization.sql`                       | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 3. `20261012171446_configuration.sql`                       | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 4. `20261012171451_scheduling.sql`                          | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 5. `20261012171456_operations.sql`                          | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 6. `20261012171501_analytics_automation.sql`                | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 7. `20261012173606_read_models.sql`                         | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 8. `20261012180348_product_hardening.sql`                   | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 9. `20261012181534_final_read_models.sql`                   | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 10. `20261012182755_advisor_foreign_key_indexes.sql`        | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 11. `20261012183007_reporting_access.sql`                   | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 12. `20261012183207_bounded_read_permissions.sql`           | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 13. `20261012183541_archived_branch_history.sql`            | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 14. `20261012183917_platform_admin_audit.sql`               | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 15. `20261012184839_customer_detail_branding.sql`           | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 16. `20261012210000_website_booking.sql`                    | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 17. `20261012223818_finance_schema.sql`                     | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 18. `20261012223852_finance_transactions.sql`               | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 19. `20261012224111_finance_read_import.sql`                | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 20. `20261012224355_booking_finance_hardening.sql`          | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 21. `20261015190206_booking_attribution_rls.sql`            | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 22. `20261015190657_consolidate_financial_audit_policy.sql` | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 23. `20261015191802_worker_tick_record_scope.sql`           | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 24. `20261019154027_database_scheduler.sql`                 | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 25. `20261019213732_profit_sharing.sql`                     | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 26. `20261019220146_enable_database_cron.sql`               | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 27. `20261019223415_final_authorization_hardening.sql`      | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 28. `20261021005325_privileged_mfa_sessions.sql`            | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 29. `20261021005630_partner_distributions.sql`              | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 30. `20261021010224_reporting_health.sql`                   | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 31. `20261021011210_daily_blocks.sql`                       | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 32. `20261021202056_audit_release_boundaries.sql`           | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 33. `20261021214500_customer_list_projection.sql`           | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 34. `20261022162330_ux_reporting_breakdown.sql`             | Sí    | Sí, verificado 24/10 | Migraciones previas del historial                 | Histórica; no modificar                                         | Preservar                                       |
| 35. `20261022205615_default_product_gold_brand.sql`         | Sí    | No                   | Tema gold por defecto; no financiero              | Bajo; revisar identidad existente                               | Preparada; NO aplicada, requiere backup/upgrade |
| 36. `20261022210809_dashboard_statement_owner_guard.sql`    | Sí    | No                   | Dashboard y permisos owner                        | Bajo; guard de autorización                                     | Preparada; NO aplicada, requiere backup/upgrade |
| 37. `20261023193417_staff_owner_profile_link.sql`           | Sí    | No                   | Core manage_record extraído en migración 31       | Medio; vínculo real owner/staff, sin asignación automática      | Preparada; NO aplicada, requiere backup/upgrade |
| 38. `20261024161949_collected_partner_distributions.sql`    | Sí    | No                   | Ledger financiero y partner distributions previos | Alto; nuevas tablas/RPC, RLS, conciliación y aprobaciones       | Preparada; NO aplicada, requiere backup/upgrade |
| 39. `20261024162205_setup_availability_diagnostics.sql`     | Sí    | No                   | Motor autoritativo de disponibilidad              | Medio; diagnóstico y descansos explícitos, sin datos del tenant | Preparada; NO aplicada, requiere backup/upgrade |
| 40. `20261024214851_weekly_schedule_batch.sql`              | Sí    | No                   | Migraciones 31, 37 y 39                           | Medio; editor semanal con locks, historial y diagnóstico owner  | Preparada; NO aplicada, requiere backup/upgrade |

## Orden de operación

1. Verificar respaldo productivo recuperable y restore aislado. El dashboard Free no incluye backups; un restore de fixtures locales no prueba recuperación de producción. No contratar recursos pagos sin autorización.
2. Repetir `scripts/inspect-1717.sql` y el inventario financiero porque el instalador sigue usando la aplicación. Comparar UUID y revisiones de los registros manuales.
3. Ensayar instalación limpia y upgrade desde 34 con datos financieros aislados; revisar RLS, RPC, grants e integridad. No editar ninguna migración histórica.
4. Aplicar solo las versiones pendientes, por el procedimiento operativo documentado del repositorio. No reset, seed, DROP ni onboarding en producción. Volver a leer `supabase_migrations.schema_migrations` después de cada paso.
5. Usar un owner real con sesión AAL2 para el plan confirmado. No inventar claims mediante `set_config`, no copiar cookies ni usar platform_admin como permiso de negocio.
6. Preparar `scripts/configure-confirmed-1717.mjs` con los UUID auténticos y una fecha prospectiva revisada. El plan no se ejecuta por generarlo. Revisar que no sobrescriba el Tinte Global ya creado ni los doce horarios manuales. Conservar excepciones, ausencias, citas y snapshots.
7. Confirmar ambos flags de booking false (organización actualmente true y sucursal false); revisar expresamente el cambio antes del plan que exige gates cerrados. Lead pasa de 60 a 0 por acuerdo confirmado, sin activar público.
8. Completar catálogo a ocho, precios y dieciséis capacidades; horario comercial 09–21; 18 segmentos individuales con descanso; domingo cerrado. Ejecutar disponibilidad autoritativa para lunes 26, miércoles 28, sábado 31 y domingo 1/11. La disponibilidad pública seguirá cerrada.
9. Propietarios: registro/confirmación individual, membresía owner, vínculo propio, MFA y respaldo. Ningún correo confirmado artificialmente por SQL.
10. Preparar POS con opciones verificadas, tarifas totales versionadas 220/520 bps propuestos y componentes separados; no ejecutar hasta tener vigencia, fijo y evidencia. Conciliar dinero real una vez, sin sumar fees nuevamente al neto.
11. Distribución: configurar política explícita deshabilitada; resolver saldos iniciales y gates; ambos aprueban activación y propuestas con sus sesiones. No realizar pagos ni inventar movimientos.
12. Inspección posterior, piloto real y comprobación de alertas/recuperación antes de activar funciones sensibles.

## SMTP y callbacks

Remitente solicitado: `dentalcrmauth@gmail.com`. En Authentication → Emails → SMTP Settings, ingresar host/puerto/usuario del proveedor y secreto **privadamente**. El remitente por sí solo no demuestra conexión ni entrega. Si se usa Gmail, su contraseña de aplicación pertenece al instalador y se carga únicamente en el dashboard; no se publica ni se pide por chat.

Authentication → URL Configuration: Site URL `https://barberia-crm-kappa.vercel.app`. Autorizar exactamente:

- `https://barberia-crm-kappa.vercel.app/auth/callback`
- `https://barberia-crm-kappa.vercel.app/auth/callback?next=reset-password`

Probar registro, confirmación y recuperación con los correos reales. No declarar SMTP operativo por guardar ajustes. Las credenciales y recepción siguen pendientes de comprobación.

## Compatibilidad del deployment

Los cambios de formularios y mensajes funcionan sobre el esquema 34. Los diagnósticos nuevos devuelven estado manual si faltan sus RPC/tablas. El editor semanal consulta soporte: sin migración 40 no habilita guardado; el editor individual y el resto del producto conservan su contrato. El API responde un bloqueo explícito si se intenta el comando nuevo sin RPC. Las distribuciones conservan el bloqueo del esquema 38. Publicar código no aplica SQL ni habilita reservas o repartos.

Ver [estado real](ESTADO_REAL_1717.md), [pendientes del instalador](PENDIENTES_MANUALES_1717.md) y [limpieza auditada](LIMPIEZA_AUDITADA_1717.md).
