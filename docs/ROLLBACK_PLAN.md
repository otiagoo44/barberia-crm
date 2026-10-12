# Rollback

V1 usa cambios aditivos y conserva fuente de verdad. No hay script “down” que borre tablas comerciales: eliminar una tabla para revertir código destruiría historia. Las migrations contienen comentarios de estrategia y se aplican transaccionalmente.

Antes de cada release: backup comprobable, historial local/remoto alineado, CI verde, revisión de locks/constraints y snapshot de configuración. Para rollout usar expand/contract; mantener RPC compatibles con el deployment anterior hasta migrar consumidores.

Si falla una migration, PostgreSQL revierte esa transacción; no marcarla aplicada. Corregir en una migration nueva o repetir únicamente la migration fallida sin registrar resultados parciales. No editar una migration ya aplicada. Si falla la aplicación, volver al deployment/commit anterior compatible con schema actual.

Para errores de función/policy después del commit: agregar migration que restaure definición anterior revisada, conservar audit/events y source data, probar aislamiento y booking antes de reabrir. No ampliar permisos para resolver una falla visual. Revertir índices identificados es seguro con DROP INDEX específico tras verificar que no sostiene una constraint.

Las primeras migrations crean el schema. Solo en una base nueva descartable se puede reinicializar con `supabase db reset --local --no-seed`. Para producción con datos, usar recuperación/PITR aislada y reconciliation de writes posteriores. No ejecutar reset, DROP SCHEMA CASCADE ni seed en remoto.

El MCP asignó timestamps al aplicar; se alineó **solo metadata del historial** a las versiones de archivos generados por CLI. Las queries de las migrations fueron las mismas que se probaron localmente. El inventario en [SCHEMA](SCHEMA.md) es la referencia reproducible para local/staging/producción.

Rollback completo desde backup/PITR real permanece NO PROBADO hasta el simulacro de [BACKUP_AND_RECOVERY](BACKUP_AND_RECOVERY.md).
