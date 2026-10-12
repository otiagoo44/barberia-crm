# Backup y recuperación

## Estado

PENDIENTE de habilitar/verificar en el proyecto real: plan, retención de backups, PITR y restore. Aplicar migrations o pasar tests no demuestra que un backup real sea recuperable. La primera barbería no debe operar hasta registrar un restore satisfactorio aislado.

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

Backup incluye ventas/líneas/pagos/fees/comisiones, gastos/adelantos/salarios, liquidaciones/reservas/ajustes/reversals, cajas/movimientos/cierres, imports/raw, agregados/audit. Restore drill CI compara filas financieras/saldo/RLS; --no-owner evita SET ROLE supabase_admin en otra DB local, conserva ACL/RLS y strict exit-on-error. No demuestra ownership/cloud/PITR reales; configuración/retención/RPO/RTO y restore cloud aislado requieren evidencia.
