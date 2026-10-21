# Readiness de Barbería OS — 20/10/2026

**NO LISTO para habilitación comercial.** Esta rama prepara un candidato y no modifica la base de producción. Código desplegado, CI verde y health accesible son evidencias técnicas parciales.

## Implementación y validación

Se preservan Next.js + React + Supabase/PostgreSQL, el ledger y la migración 27. Se agregan MFA obligatorio, sesiones vivas, distribuciones opt-in, proyecciones de gráficos, heartbeat y bloques diarios transaccionales. `FINAL_PRODUCT_AUDIT_2026_10_20.md` registra módulos; `SECURITY_RELEASE_MATRIX.md` registra fronteras; `UX_REDESIGN_REPORT.md` registra interfaz y capturas.

Validación local inicial: npm ci y audit sin vulnerabilidades, build base; 51 contratos de seguridad, 19 financieros y 23 hardening de la base; 18 unitarias con gráficos/marca; 11 contratos nuevos de producto aprobados. La validación final del SHA y el Auth real de CI se registran al terminar. No contar omisiones como aprobadas. Docker no está instalado localmente.

## Gates externos OPEN

| Gate | Evidencia necesaria para cerrarlo |
|---|---|
| SMTP y redirects | Proveedor/remitente real en Supabase, confirmación y recovery entregados a cuenta autorizada, enlaces de un uso y callback exacto. No se inventan credenciales. |
| MFA cloud | Enrollment real owner/finance/manager/plataforma, autenticador de respaldo independiente, recuperación supervisada ensayada; MFA del proveedor. |
| Staging | Proyecto y secretos propios, Auth redirects, migrations alineadas y piloto completo sin tocar producción. Preview permanece cerrado si faltan. |
| Backup/restore cloud | Responsable, frecuencia, retención y almacenamiento; copia real restaurada en destino aislado, checks de Auth/RLS/ledger/distribuciones/dedupe y RPO/RTO medidos/aceptados. |
| Alertas | Responsable y canal reales; consumir monitor privado, alertar 503, dead/lag/leases y API error rate/p95; recepción comprobada con falla controlada en staging. |
| Política societaria | Acuerdo de periodicidad, retiros, pérdidas previas, gastos pendientes, aprobación/cierre por sucursal y evidencia. Registro nuevo bloqueado hasta confirmación explícita. |
| Datos y piloto | Precios, duraciones, tarifas POS y disponibilidad real. Clasificar cuatro anomalías históricas; recepción → atención → split → cierre → revisión owner/barbero/finance. |
| Rollout cloud | Comparar historial real, backup previo, ensayo staging, evidencia CI del SHA, migraciones controladas y smoke. No db reset, seeds ni backfills productivos. |

## Rollout y rollback

1. Mantener reservas y distribuciones cerradas. Comparar los 27 archivos históricos con `supabase_migrations.schema_migrations` del destino confirmado; esta sesión no presupone acceso cloud.
2. En staging aislado aplicar las cuatro migraciones nuevas en orden. La 28 restringe AAL1 y sesiones; requiere preparar enrollment/soporte antes del rollout. Las siguientes agregan distribuciones deshabilitadas, reportes/heartbeat y batch diario. Nada importa historia ni abre booking.
3. Validar Auth completo, restauración y roles contra staging; confirmar factores de operadores reales. No usar claims de SQL fixture para ese gate.
4. Desplegar el SHA aprobado por PR/checks, sin eludir main. Verificar APP_URL, health/ready/operations y read/write de roles autorizados. Operaciones sensibles permanecen sujetas a AAL2 y políticas.
5. Rollback preferido: detener habilitaciones y corregir hacia adelante. No bajar a una UI anterior sin MFA manteniendo usuarios bloqueados sin vía de challenge. Puede conservarse el esquema aditivo y volver a un build compatible con /mfa. No borrar tablas con pagos ni desactivar los controles AAL2 para recuperar comodidad.

El scheduler efectivo sigue siendo pg_cron; no se agrega Vercel Cron. Falta proveedor externo de alertas; el monitor devuelve explícitamente `alerts_delivery: not_configured`. El restore local de CI no representa restore cloud ni un SLA.
