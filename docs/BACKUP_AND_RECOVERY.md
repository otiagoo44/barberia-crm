# Backup y recuperación

## Estado vigente de 17:17 — 25/10/2026

Pro y copias físicas disponibles verificados en el proyecto exacto `tbcfhagteyqufjkmbxzz`; última observada 25/10 05:00:36 UTC. Retención Pro: 7 días. No se activó PITR. El estado Free que sigue es histórico y ya no describe el plan actual. La restauración física administrada continúa sin ensayo; la copia lógica real requiere conexión autorizada. Procedimiento, herramientas cifradas, evidencia, responsables y límites en [RECUPERACION_PRIVADA_1717](RECUPERACION_PRIVADA_1717.md). Un ensayo con fixtures no certifica recuperación de datos productivos.

## Estado

PENDIENTE en el proyecto real: política/retención de copias, PITR si se elige y restore cloud. El plan Free se verificó en el dashboard. Aplicar migrations o pasar un restore local no demuestra que un backup del proyecto real sea recuperable. La primera barbería no debe operar hasta registrar un restore satisfactorio aislado de sus copias reales.

Verificación del dashboard el 15/10/2026: el proyecto está en **Free** y la pestaña Scheduled backups indica que ese plan no incluye backups del proyecto. No se contrató ningún plan. Antes del piloto se necesita una estrategia de copias/retención y un restore aislado demostrado; la presencia de migrations no reemplaza esas copias.

Supabase documenta backups/PITR y restauración en [Database Backups](https://supabase.com/docs/guides/platform/backups). La disponibilidad depende del plan/configuración. Los backups DB no sustituyen una copia de objetos de Storage ni configuración de Auth/proveedores/secretos externos.

## Estrategia

Para producción acordar RPO/RTO con el negocio. Objetivos propuestos, **no medidos ni garantizados**: RPO ≤15 min con PITR habilitado, RTO ≤4 h después de un simulacro validado. Con solo backup diario, aceptar explícitamente una ventana de pérdida de hasta el intervalo entre copias. No presentar estos objetivos como SLA existente.

Usar backup administrado/PITR y copia lógica cifrada independiente cuando el plan permita exportación. Restringir acceso a responsables de recuperación, guardar inventario de migrations y fecha/hash de copias. Nunca versionar dumps con clientes o credenciales. Guardar variables de despliegue en gestor de secretos, con procedimiento de recuperación separado. Copiar logos externos/Storage si pasan a alojarse en el producto.

## Restore test antes de abrir

1. Tomar backup del proyecto y registrar hora, versión del schema y número de registros por entidad.
2. Restaurar a proyecto/base aislada sin endpoints públicos ni env de producción. No reutilizar integraciones salientes.
3. Confirmar organizaciones, memberships, branches, staff, customers, appointments, history/audit, EXCLUDE, RLS y grants.
4. Probar login con cuenta de prueba del entorno, reservas, idempotencia, búsqueda, agenda y permisos cross-tenant. No enviar notificaciones a clientes reales.
5. Medir tiempo real de restauración, timestamp más reciente recuperado y pérdida máxima observada. Registrar RPO/RTO medidos y responsable.
6. Revisar credenciales, cron, Realtime y redirects antes de conmutar tráfico. Reprocesar jobs con idempotencia y evitar entregas duplicadas.

En incidente: pausar writes en gateway, conservar logs y backup posterior al incidente, elegir punto de restauración anterior, restaurar en destino aislado, validar datos, conmutar variables/URL y reabrir. No sobrescribir primero la única copia dañada. [Rollback de migrations](ROLLBACK_PLAN.md).

Repetir simulacro tras cambios importantes y periódicamente. Registrar evidencia en `docs/verification/restore-YYYY-MM-DD.md`; hasta entonces el restore de producción permanece NO PROBADO.


## Continuación financiera — 12/10/2026

Backup incluye ventas/líneas/pagos/fees/comisiones, gastos/adelantos/salarios, liquidaciones/reservas/ajustes/reversals, cajas/movimientos/cierres, imports/raw, agregados/audit. Restore drill CI compara filas financieras/saldo/RLS y conserva strict exit-on-error. No demuestra recovery cloud/PITR reales; configuración/retención/RPO/RTO y restore cloud aislado requieren evidencia.

El drill lógico se limita a `public`, `app_private`, `auth` y `extensions`, con usuarios Auth reales y las dependencias btree_gist/pg_trgm/pgcrypto explícitas. Restaura owners, RLS y ACLs mediante el rol administrador `supabase_admin` ya existente en el contenedor local aislado; no modifica roles ni privilegios de producción. El rol de aplicación postgres no puede reasignar owners o defaults de supabase_auth_admin. No se omiten ACLs para hacer pasar la prueba. No copia funciones administradas de Realtime/Storage ni publicaciones/subscripciones: esas piezas se provisionan con Supabase y no pertenecen al backup de aplicación probado. El informe distingue el restore de aplicación de la recuperación de plataforma/cloud, que sigue pendiente.

Drill local aprobado en [CI 38796594266](https://github.com/otiagoo44/barberia-crm/actions/runs/38796594266). El artefacto browser-verification contiene `docs/verification/restore-local.json` con tamaño/tiempo, conteos y controles ejecutados; production_restore y managed_platform_restore permanecen NOT_TESTED.
