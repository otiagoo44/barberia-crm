# Recuperación del PR #3 — 21/10/2026

Seguimiento de [PR #3](https://github.com/otiagoo44/barberia-crm/pull/3), rama `audit/product-release-20261020`. Base obtenida con fetch: main `4fa4d63eaa26e31bdddb37aac68456e8c0e85ba3`; candidato recibido `2a2cb927604a0cd05ffc682c325e045752112e8c`. No se reconstruyó el CRM ni su base. Next.js/React/TypeScript, Supabase Auth, PostgreSQL, RLS, intervalos/GiST y RPC transaccionales se conservan. No hubo migraciones, importaciones, pagos, seeds ni activaciones comerciales en cloud.

## Evidencia de los fallos y correcciones

La [ejecución original](https://github.com/otiagoo44/barberia-crm/actions/runs/39528698984) aprobó quality y visual-baseline, con 17/19 E2E aprobados. Se descargaron las capturas, contextos DOM y trazas originales. El [inventario saneado de requests](verification/pr3-failure-analysis.json) excluye cuerpos, queries, cookies y credenciales: los cuatro intentos fallidos no tuvieron errores de consola ni requests HTTP fallidos. Signin, verificación MFA, catálogo y operaciones precedentes respondieron 200.

| Hallazgo | Evidencia / causa | Corrección y verificación |
|---|---|---|
| Menú móvil: foco sale del diálogo | Al llegar al summary final de cuenta, Chromium envía Tab al navegador. Los descendientes de details cerrado tienen getClientRects().length=1 pero checkVisibility()=false. Un probe Chromium reprodujo Close → Nav → Summary → Body. | Modal nativo conserva showModal y fondo inerte. El ciclo excluye controles realmente invisibles/deshabilitados, maneja ambos sentidos y restaura el disparador al cerrar. Ctrl+K no intenta enfocar el fondo. E2E conserva los 20 Tab originales y añade 20 Shift+Tab y el atajo dentro del diálogo. |
| Walk-in: selector Barbero | El DOM muestra combobox «Barbero» disponible, con opciones de staff; no hay redirección MFA ni denegación. getByLabel exacto usa el texto del label envolvente, incluyendo opciones; el nombre accesible del combobox sí es Barbero. | Localizador por rol y nombre accesible exacto. Ninguna etiqueta del producto fue cambiada. |
| Reintento: Abrir caja ausente | El intento previo dejó caja abierta antes de fallar; la captura del retry muestra «Caja abierta», por recepción. | Cada intento usa su propio tenant/ledger de localhost. Abrir caja sigue siendo obligatorio y no se sustituye por una API. Todo el flujo comercial se opera por UI con RPC/Auth reales. |
| Retirar último factor por API directa | El BFF comprobaba el conteo; la API GoTrue de unenroll también es accesible con un token ordinario AAL2 y el conteo HTTP no serializa retiradas simultáneas. | Trigger privado en auth.mfa_factors conserva al menos un factor verificado. Una fila privada serializa retiradas y evita write skew; sin secretos ni acceso comercial nuevo. Pruebas SQL concurrentes y llamada directa GoTrue. El SDK/Auth cloud debe ensayarse en staging antes del rollout. |
| Lote diario duplicado sin autorización de escritura | Si todos los bloques ya existían, no se ejecutaba el guard de manage_record_core. Membresía/lectura de sucursal no autorizan guardar un lote. | Autorización explícita posterior al lock y anterior a idempotencia/dedupe: owner/manager o barbero propio habilitado; staff y asignación activos del local. Negativos con recepción, otro local y otro tenant. |
| Política societaria sin decisión sobre pérdidas | Se exigían periodicidad, aprobación y retiros, pero faltaba evidencia explícita de pérdidas previas. | losses_reference requerido al confirmar una versión. Políticas anteriores sin ese acuerdo no operan; no se reescriben filas previas. No hay cálculo automático de arrastres. |
| Reversión independiente de retiro aplicado | Nueva assertion falló con Missing expected rejection: reverse_financial_transaction aceptaba revertir el gasto de un adelanto ya aplicado a socios. | El motor financiero rechaza esa reversión y exige ajuste auditado, igual que con adelantos aplicados a comisiones. Se conservan gasto, retiro y saldo conciliado. |
| Proyección monetaria de socios | La lectura devolvía bigint como números JSON, antes de llegar a JavaScript; un agregado grande podía perder precisión. | Se usa exact_financial_json en DB antes de PostgREST, igual que en las lecturas/exportaciones financieras. Importes se transportan como strings decimales; UI conserva BigInt para PYG. Prueba del tipo/valor de la respuesta y del helper por encima de 2^53. |

El flujo diario conserva: abrir caja → registrar cliente walk-in → asignar disponible → check-in → iniciar → completar → checkout → efectivo 1200 + banco 800 → cierre 1200 → Owner busca el movimiento real. Se capturan `daily-split-paid.png`, `daily-cash-closed.png` y `daily-owner-movement.png`. No se simulan APIs ni transferencias bancarias.

Capturas de ejecución aprobada con Auth real: [menú y foco](verification/pr3/mobile-menu-focus.png), [cobro registrado](verification/pr3/daily-split-paid.png), [caja cerrada sin diferencia](verification/pr3/daily-cash-closed.png), [movimiento del Owner](verification/pr3/daily-owner-movement.png). Procedencia y hashes en pr3-final.json; los importes USD corresponden exclusivamente a fixtures, no a la configuración real de 17:17.

## Referencia Twenty inspeccionada

Se consultó HEAD real de twentyhq/twenty: `3901111bc0480bd452b7f2299d44ff160bc94909`. Se descargó y leyó código de ese commit, sin copiar su motor de metadata:

| Módulo actual | Principio adoptado / correspondencia en este CRM |
|---|---|
| [SettingsPermissionGuard](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/guards/settings-permission.guard.ts) | Capacidad explícita en servidor; se deniega si falta. Sus excepciones de bootstrap no se trasladan a operaciones comerciales. Aquí requireUser, membresía viva y guard RPC/RLS son autoridades. |
| [RecordPermissionsService](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/metadata-modules/record-permissions/services/record-permissions.service.ts) | Autorización por registro y operación ligada a la lectura autorizada. Aquí tenant/sucursal, cliente pertinente, staff propio y estado del registro. |
| [mergeRestrictedFieldPermissions](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/metadata-modules/role/utils/merge-restricted-field-permissions.util.ts) | Una denegación de campo prevalece. Aquí proyecciones de recepción/barbero/soporte y RLS de tablas financieras; no esconder columnas con CSS. |
| [ImpersonationAuthorizationService](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/core-modules/impersonation/services/impersonation-authorization.service.ts), [ImpersonationService](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/core-modules/impersonation/services/impersonation.service.ts) | Escalamiento excepcional explícito, segundo factor y eventos de intento/resultado. Este CRM conserva soporte con ticket, snapshot mínimo y auditoría; platform_admin no obtiene sesiones comerciales de otros usuarios. |
| [BullMQDriver](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/core-modules/message-queue/drivers/bullmq.driver.ts) | Estados observables, intentos/backoff, eventos completed/failed/stalled y retención. Aquí outbox/jobs persistentes, leases, SKIP LOCKED, dedupe durable y scheduler pg_cron; no se incorpora Redis ni otro scheduler. |
| [EventLoopStallMonitorService](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/core-modules/message-queue/services/event-loop-stall-monitor.service.ts), [ApplicationJobEnqueueThrottlerService](https://github.com/twentyhq/twenty/blob/3901111bc0480bd452b7f2299d44ff160bc94909/packages/twenty-server/src/engine/core-modules/message-queue/services/application-job-enqueue-throttler.service.ts) | Diagnóstico de atasco y admisión acotada. Aquí heartbeat/antigüedad, backlog, dead, leases vencidos/anómalos y conteos de espera de locks. No se afirma tener alertas recibidas. |

La [matriz de permisos](FINAL_PERMISSION_MATRIX.md) conserva permisos por organización, sucursal, objeto, registro, operación y campo. El permiso se vuelve a comprobar después de esperar el lock. AAL2 nunca concede membresía ni alcance.

## MFA y sesiones

Owner, Manager, Finance y plataforma necesitan AAL2; recepción/barbero con factor verificado también. La identidad mínima sigue disponible para enrolarse. No se rehízo /mfa. CI usa usuarios, sesiones y TOTP firmados por GoTrue local, sin modificar claims para superar el gate HTTP.

La suite comprueba AAL1 denegado en HTTP y Data API/RPC; plataforma AAL2 sin membresía; enrolamiento y challenge; segundo autenticador; último factor rechazado por BFF y Auth directo; contraseña recuperada conserva MFA; revocación global; códigos inválidos sin secretos; auditoría sin secretos. `revocation.spec.ts` mantiene JWTs firmados sin refrescarlos y demuestra espera real del lock antes de revocar membresía, sucursal, perfil o sesión; las escrituras no se completan y SELECT/RPC posteriores se deniegan.

La matriz HTTP repite además desactivación de perfil, retiro de membresía y eliminación de sesiones por cada uno de los seis roles autenticados. Sus mutaciones administrativas se limitan a las fixtures localhost y se restauran tras la prueba. Anon no tiene sesión/membresía que revocar y permanece denegado.

El BFF conserva 429 de Auth y no registra códigos, QR, claves ni errores crudos. Los límites efectivos cloud y la recuperación supervisada por pérdida de ambos dispositivos siguen OPEN. La [documentación de Supabase](https://supabase.com/docs/guides/auth/rate-limits) describe los límites del proveedor; no se presenta esa documentación como una prueba cloud realizada. [MFA de Supabase](https://supabase.com/docs/guides/auth/auth-mfa) confirma que los guards de frontend requieren enforcement en DB/API.

MCP agregado a Codex con el project_ref solicitado; OAuth completó Successfully logged in y codex mcp list informó enabled/OAuth. La sesión actual no incorporó herramientas Supabase nuevas en su catálogo: no se afirma haber reconsultado el historial cloud. Las skills Supabase/PostgreSQL ya estaban instaladas en .agents/skills; no se duplicaron.

## Finanzas, agenda y operación

Se preservan checkout/split, fees POS, snapshots de comisiones, caja, gastos, adelantos, salarios, liquidaciones, reversals e importación XLSX. Las claves finance.* siguen durables. Jonatan/Esteban siguen como socios iguales sobre resultado operativo; ninguna comisión por corte fue introducida.

Distribuciones: sin política confirmada permanecen bloqueadas. Aprobación no crea pagos; pagos reales son registros separados, idempotentes, con saldo máximo por asignación. Caja requiere sesión compatible abierta y fondos; reversal crea movimiento compensatorio. El snapshot de período, actor/socio/sucursal y versión de política no cambian al confirmar otra versión. Overlap de períodos aprobados y sobrepago concurrente están impedidos en DB. La conciliación de banco, pérdidas previas y gastos pendientes requiere evidencia humana; no se inventa saldo bancario ni arrastre de pérdidas.

Agenda: múltiples franjas/descansos por fecha, copiar con confirmación, rollback si una edición perjudica citas existentes y duración completa dentro del bloque. Staff de otro local/tenant es rechazado. Se preservan pruebas de 100 reservas concurrentes, capacidad por recurso y restricción GiST. Rulos continúa con consulta previa. No se generó disponibilidad semanal para 17:17.

Outbox → job → claim con lease → worker → éxito/retry/dead conserva transacciones, idempotencia, backoff y tratamiento de fallos parciales. Las pruebas originales de reclaim, lease anterior, dead, proveedor sin configurar y no duplicación se mantienen. El monitor privado ahora informa roundtrip de DB y anomalías de locks/leases. HTTP error rate y p95 son null, incident_channel y alerts_delivery son not_configured: requieren telemetría/canal externos reales.

## Migraciones y verificación

Los [27 archivos aplicados](verification/applied-migrations-27.json) son idénticos a main, comprobados por contenido normalizando solo CRLF/LF. Las cuatro migraciones originales del PR también se conservan. Se agrega `20261021202056_audit_release_boundaries.sql` para los hallazgos de esta auditoría: inventario candidato **32**.

`test:db` incluye instalación limpia y upgrade 27 → 32, comparando todas las columnas/filas anteriores, saldos exactos, reintento financiero, FKs y RLS. CI además resetea únicamente Supabase localhost a la versión 27, crea historia aislada, ejecuta migration up y comprueba la misma conservación antes de preparar las fixtures Auth independientes. El ensayo detiene el único cron local mediante cron.unschedule; el reset posterior lo restaura. No usa UPDATE directo sobre cron.job, cuyo permiso está revocado.

La evidencia final del SHA y de todos los comandos se registra en [pr3-final.json](verification/pr3-final.json). Los resultados intermedios o el PASS de una revisión anterior no sustituyen los checks del candidato final. Ningún skip se cuenta como aprobado. El benchmark local tuvo otras verificaciones concurrentes; sus latencias no certifican capacidad productiva.

## Gates externos

Permanecen abiertos: SMTP/redirects y correo entregado; staging independiente; enrolamiento cloud previo y dos autenticadores por operador; MFA de proveedores y recuperación supervisada; backup/restore cloud y RPO/RTO aceptados; telemetría HTTP y canal de incidentes/alertas con recepción real; política societaria y conciliación de pérdidas/retiros; datos reales de tarifas, duraciones, disponibilidad y cuatro anomalías XLSX; piloto por rol; autorización separada de despliegue.

Ver [rollout de staging](STAGING_ROLLOUT_PR3.md). CI verde permite evaluar el merge técnico; no habilita reservas, distribuciones ni producción. No se ejecuta merge automáticamente.
