# Incidentes y recuperación

No se detectó evidencia de explotación o pérdida de datos reales en esta revisión. Los hallazgos se reprodujeron con fixtures aislados. La versión cloud permanece en 26 migraciones hasta un rollout revisado. No confundir una corrección en la rama con mitigación ya instalada.

## Acceso indebido / sospecha de aislamiento

1. Responsable owner/plataforma: registrar hora UTC, request ID, tenant/sucursal y versión. Conservar logs sanitizados y evidencia; no exportar clientes por chat.
2. Revocar la membresía/perfil comprometido mediante el procedimiento autorizado; revocar sesiones Auth, rotar credenciales afectadas y comprobar denegación directa de RPC/SELECT. Un JWT emitido no sustituye la membresía viva.
3. Mantener cerradas reservas públicas y detener writes del entorno afectado si hay riesgo de dinero. No resolver una pantalla ampliando grants o usando service_role comercial.
4. Revisar auditoría, movimientos y accesos por alcance; comparar con copias verificadas. Corregir por migración aditiva y validar negativos en staging. Documentar impacto comprobado; no inferir ausencia de incidente por falta de logs.

## Caja, cobro o distribución incorrecta

Conservar IDs de checkout/payment/cash_session y clave idempotente. Ante timeout, consultar la operación y repetir **la misma clave y payload**, sin generar otra venta. No borrar registros ni editar snapshots. Una devolución usa reversión del dominio y, si es efectivo, caja abierta actual; los fees no se suponen devueltos. Liquidaciones cerradas requieren ajuste auditado. Reparto estimado no es pago a socios. Si no puede conciliarse, detener pagos y registrar diferencia antes de reabrir.

## Worker detenido, retry o dead

Consultar como operador DB los estados, available_at, leased_until, attempts/max_attempts y last_error_code; no volcar payloads. Verificar `cron.job` y los últimos `cron.job_run_details` del job `barberia-internal-worker`. Hay un solo scheduler nativo. `/api/jobs` es fallback manual autenticado; no agregar otro cron activo.

Leases de dos minutos permiten recuperar un job abandonado. Reintentos tienen backoff y tope; `awaiting_configuration` es un proveedor no configurado, nunca una entrega exitosa. Para reprocesar dead: corregir la causa, comprobar si hubo efecto externo con la clave estable del job y registrar ticket/operador; cambiar exclusivamente el job identificado a retry, attempts=0, available_at=now(), lease_token/leased_until=null dentro de transacción controlada. Conservar last_error y auditoría en el incidente antes de cambiarlo. No reenviar en masa ni limpiar la cola. Las salidas externas siguen sin adaptador activo; activar un proveedor requiere prueba de idempotencia y destinatarios de staging.

## Despliegue o migración fallida

No marcar aplicada una migración revertida. Conservar versión/log de error. Desplegar el último artefacto compatible y mantener schema expandido; corregir por una nueva migración. Esta auditoría restringe permisos: **no restaurar el bypass de plataforma para hacer pasar una pantalla**. Ver [rollback](ROLLBACK_PLAN.md). Antes de cloud verificar inventario remoto y backup recuperable, aplicar en staging, comparar constraints/grants y correr smoke sin writes.

## Pérdida de datos

Seguir [BACKUP_AND_RECOVERY](BACKUP_AND_RECOVERY.md): preservar la única copia, restaurar en destino aislado sin cron/proveedores salientes, validar Auth, tenant isolation y saldos/ledgers, medir RPO/RTO, reconciliar writes posteriores y recién conmutar. Restore local de CI no acredita restore cloud. Hoy backup real/RPO/RTO siguen pendientes de un responsable y de evidencia.

## Monitoreo que falta contratar/configurar

No se inventaron proveedores ni destinatarios. Configurar alertas de disponibilidad/ready (dos fallos consecutivos), cron sin éxito por más de cinco minutos, jobs dead nuevos, lease vencido, edad del job runnable, error rate, p95 HTTP y límites DB/Realtime/Vercel. Estos umbrales son propuesta inicial, no SLA medido. Elegir responsable y canal antes del piloto; probar una falla controlada en staging y la recepción efectiva de la alerta. Conservar auditoría y claves financieras de deduplicación; definir retención de eventos/jobs/cron con respaldo antes de purgar. Ninguna purga nueva se activa en esta rama.
