# Estado actualizado, 22/10/2026

Revisión de diseño y rendimiento en curso en PR #5: [aceptación del candidato](RELEASE_ACCEPTANCE.md), [auditoría de dos pasadas](FINAL_UX_AUDIT.md). La evidencia y el rollout narrados debajo pertenecen al producto anterior; no certifican el nuevo rediseño ni autorizan su despliegue. Las nuevas migraciones 35/36 permanecen pendientes de rollout controlado.

El usuario autorizó merge/publicación y conexión al proyecto correcto. El rollout técnico aplicó las siete migraciones pendientes a tbcfhagteyqufjkmbxzz: historial 34, 27 originales intactas, sin fixtures ni movimientos comerciales. CI del producto 9d17387 aprobada: 25 E2E, 180 capturas inspeccionadas y 72 auditorías axe sin violaciones. Ver UX_TEST_RESULTS.md y verification/ux/final.

**La habilitación comercial sigue pendiente** de cuentas personales, MFA, SMTP, horarios/catálogo/fees, acuerdos, backup/restore administrado, alertas y piloto. [Guía concreta](PILOTO_ESTEBAN_JONATAN.md). El texto siguiente es historial previo al rollout y no describe el estado actual del esquema.

---

# Readiness de Barbería OS — 20/10/2026

Revisión del 21/10: [recuperación PR #3](PR3_RECOVERY_AUDIT_2026_10_21.md), [evidencia final](verification/pr3-final.json) y [rollout de staging actualizado](STAGING_ROLLOUT_PR3.md). Las cifras iniciales de abajo son antecedentes. El candidato agrega una quinta migración de auditoría (32), conserva intactas las 27 aplicadas y las cuatro originales del PR. El rollout debe aplicar las cinco nuevas en orden y preparar enrolamiento previo; no se aplicó ninguna a producción en esta tarea.

**NO LISTO para habilitación comercial.** Esta rama prepara un candidato y no modifica la base de producción. Código desplegado, CI verde y health accesible son evidencias técnicas parciales.

## Implementación y validación

Se preservan Next.js + React + Supabase/PostgreSQL, el ledger y la migración 27. Se agregan MFA obligatorio, sesiones vivas, distribuciones opt-in, proyecciones de gráficos, heartbeat y bloques diarios transaccionales. `FINAL_PRODUCT_AUDIT_2026_10_20.md` registra módulos; `SECURITY_RELEASE_MATRIX.md` registra fronteras; `UX_REDESIGN_REPORT.md` registra interfaz y capturas.

Validación registrada del código: npm ci y audit sin vulnerabilidades, lint/typecheck/build; 19 unitarias, 51 contratos de seguridad, 19 financieros, 23 hardening, onboarding/scheduler, 15 de producto y upgrade desde 27. CI con Supabase local aprobó 24 E2E con Auth real, sin skips, e instalación/upgrade/restore. Ver SHA/run exactos en pr3-final.json y los checks del HEAD del PR antes de merge. Docker no está instalado en esta estación; PostgreSQL embedded no se presenta como Auth real. Ninguna prueba local/CI certifica producción.

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
2. En staging aislado aplicar las cinco migraciones nuevas en orden. La 28 restringe AAL1 y sesiones; requiere preparar enrollment/soporte antes del rollout. Las siguientes agregan distribuciones deshabilitadas, reportes/heartbeat, batch diario y los guards de auditoría de la 32. Nada importa historia ni abre booking. Seguir STAGING_ROLLOUT_PR3.md para pre-enrolamiento, integración Auth y recuperación hacia adelante.
3. Validar Auth completo, restauración y roles contra staging; confirmar factores de operadores reales. No usar claims de SQL fixture para ese gate.
4. Desplegar el SHA aprobado por PR/checks, sin eludir main. Verificar APP_URL, health/ready/operations y read/write de roles autorizados. Operaciones sensibles permanecen sujetas a AAL2 y políticas.
5. Rollback preferido: detener habilitaciones y corregir hacia adelante. No bajar a una UI anterior sin MFA manteniendo usuarios bloqueados sin vía de challenge. Puede conservarse el esquema aditivo y volver a un build compatible con /mfa. No borrar tablas con pagos ni desactivar los controles AAL2 para recuperar comodidad.

El scheduler efectivo sigue siendo pg_cron; no se agrega Vercel Cron. Falta proveedor externo de alertas; el monitor devuelve explícitamente `alerts_delivery: not_configured`. El restore local de CI no representa restore cloud ni un SLA.
