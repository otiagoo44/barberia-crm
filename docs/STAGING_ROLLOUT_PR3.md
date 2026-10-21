# Rollout del candidato PR #3 en staging

Este procedimiento es preparatorio. No autoriza aplicar DDL a producción. No usar db reset, seeds, fixtures ni scripts recovery en un proyecto cloud.

## Preflight

1. Confirmar SHA del PR, checks quality/supabase-e2e/visual-baseline y rama actualizada. Revisar los cinco archivos nuevos y el manifiesto de las 27 migraciones aplicadas. No editar historial ni reparar versiones para ocultar divergencias.
2. Confirmar proyecto staging independiente, URLs/Auth redirects y secretos propios. Comprobar que no apunta a tbcfhagteyqufjkmbxzz/producción. Mantener booking y distribuciones cerrados. Desactivar efectos salientes de proveedores en el destino de ensayo.
3. Tener copia restaurable y responsable; ensayar restore aislado y registrar RPO/RTO. Una copia local de CI no satisface este gate cloud.
4. Inventariar usuarios privilegiados activos, miembros/sucursales y factores verificados por conteos/IDs; no exportar secretos de auth.mfa_factors. Confirmar acceso de responsables y un segundo dispositivo independiente.
5. Preparar enrolamiento **antes** de enforcement: las APIs TOTP de Supabase Auth funcionan con AAL1 sin acceso comercial. Se ensayaron con clientes reales en revocation.spec.ts. Utilizar un cliente de enrolamiento revisado contra el destino correcto, o un build compatible de enrolamiento en una ventana controlada; no instalar este candidato dependiente de security_context contra una base de 27 migraciones esperando que funcione. En staging se aplica el esquema completo y se verifica /mfa antes de cualquier piloto. Si el destino productivo aún no tiene vía de enrolamiento previa, el rollout permanece bloqueado: no bajar el guard ni desplegar a ciegas.

## Aplicación controlada en staging

1. Confirmar historial real de 27 migraciones y ausencia de cambios productivos pendientes. El runner de CI ya verificó base limpia y upgrade con historia; repetir sobre copia staging propia.
2. Aplicar en orden 20261021005325 (MFA/sesiones), 20261021005630 (socios), 20261021010224 (reporting/heartbeat), 20261021011210 (bloques) y 20261021202056 (fronteras auditadas). Usar el gestor de migraciones contra el destino explícito, con backup y ventana. Verificar resultado por archivo; ante fallo detener y diagnosticar, sin marcarlo aplicado manualmente.
3. Desplegar un build compatible con /mfa y esas RPCs. El guard ya deniega AAL1 privilegiado; /mfa mantiene identidad mínima y ofrece enrolamiento/challenge. Mantener operación cerrada hasta confirmar que todos los operadores alcanzan AAL2 y conservan una membresía/sucursal válida.
4. Probar dos dispositivos independientes, retirada de uno con otro disponible y rechazo del último por BFF/API Auth directa. Ensayar recovery de contraseña sin pérdida de MFA y revocación de JWTs ya emitidos. La función/trigger en auth es una integración explícita que se debe revalidar ante upgrades de GoTrue/esquema Auth.
5. Verificar RLS en todas las tablas de negocio/privadas, FKs validadas, grants, proyecciones por rol, scopes vivos y rechazo de direct writes. Repetir pruebas de revocación esperando locks, reservas concurrentes y dinero exacto con cuentas staging reales.
6. Verificar un único cron barberia-internal-worker, heartbeat reciente, jobs pending/retry/dead, leases y locks. Consumir /api/health/operations solo con credenciales operativas. Configurar y probar un canal real antes de cerrar el gate alertas; no agregar Vercel Cron.
7. Ensayar el flujo de recepción y revisión de Owner. Conciliar pagos split, fees reales, caja, gasto, adelanto/liquidación, reversals y próxima visita. No importar XLSX real ni habilitar socios/booking como parte del ensayo técnico.

## Recuperación hacia adelante

- Si falla un paso, suspender habilitaciones y corregir con una migración aditiva revisada. Conservar ledger, tablas de socios, políticas históricas y claves de idempotencia. No borrar pagos, reescribir períodos ni retroceder a un build sin /mfa.
- Si un operador pierde un dispositivo, utilizar el autenticador de respaldo y registrar/verificar otro. Si pierde ambos, el gate de recuperación asistida sigue abierto hasta ensayar con identidad comprobada, ticket, responsable y revocación de todas las sesiones. No existe un endpoint comercial que permita al platform_admin quitar factores de terceros.
- El trigger impide borrar el último factor incluso mediante Auth Admin. Un reset excepcional requiere un procedimiento de DB revisado y auditado con privilegios de operador: bloqueo de la tabla de factores, excepción al trigger solo dentro de esa transacción, selección de un único usuario por ID confirmado, revocación de sesiones y evidencia mínima del ticket, restauración del trigger antes de commit y nuevo enrolamiento AAL1. No proporcionar ese privilegio a authenticated/service_role ni desactivar el trigger de forma persistente. Este procedimiento no fue ejecutado contra cloud y no está certificado como recuperación real.
- Volver a verificar scripts, constraints, roles y monitoreo después de cualquier recuperación. Solo habilitar funciones comerciales con gates y autorización de despliegue separados.
