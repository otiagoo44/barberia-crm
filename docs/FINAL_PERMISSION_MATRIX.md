# Matriz final de autorización

Aplicable con la migración `20261019223415_final_authorization_hardening`. Cada celda presupone perfil/organización/membresía activos. O = organización propia; B = sucursales autorizadas; P = staff propio. Finance admite alcance B o todas las sucursales según membresía, sin ownership. Platform_admin no es un rol comercial efectivo: cuando tiene membresía opera con el rol de esa membresía.

Revalidación PR #3: [auditoría del 21/10](PR3_RECOVERY_AUDIT_2026_10_21.md) y [evidencia del candidato](verification/pr3-final.json). Con migraciones 28–32 se exige sesión Auth viva y AAL2 para Owner/Manager/Finance/plataforma y para cualquier usuario con factor verificado. AAL2 no concede un rol ni acceso a otra sucursal. Las escrituras conservan reautorización posterior al lock.

| Objeto / acción | Owner | Manager | Receptionist | Barber | Finance | Platform sin membresía |
|---|---|---|---|---|---|---|
| Organización, branches: lectura | O | B | B | B | B | Denegado |
| Usuarios, roles, scopes | O administrar | Propio leer | Propio leer | Propio leer | Propio leer | Denegado |
| Diagnóstico de puesta en marcha (GET setup) | O, sucursal propia; solo estados agregados | Denegado | Denegado | Denegado | Denegado | Denegado |
| Branding, configuración global, staff, servicios | O administrar | Catálogo/operación B | Catálogo B | Catálogo permitido | Catálogo financiero | Solo onboarding explícito |
| Horarios, precios locales, asignaciones | O | B administrar | B leer | P leer / editar disponibilidad si habilitado | Sin administración operativa | Denegado |
| Clientes y búsqueda | O | Clientes pertinentes B | Clientes pertinentes B | Clientes con cita propia en B | Sin directorio de clientes | Denegado |
| Notas, preferencias, tags | O | Clientes pertinentes B | Clientes pertinentes B | Lectura pertinente | Denegado | Denegado |
| Reservar / reprogramar / cancelar | O | B | B | Solo rebooking propio autorizado | Denegado | Denegado |
| Check-in / iniciar / completar | O | B | B | Cita propia | Denegado | Denegado |
| Walk-ins | O | B | B | Asignados: lectura | Denegado | Denegado |
| Checkout, split, cobrar, caja, gasto operativo | O | B | B | Denegado | B | Denegado |
| Reversión, salarios, adelantos, liquidación, ajustes | O | B | Denegado | Propios: lectura | B | Denegado |
| Reporte financiero completo y cierre sellado | O | B | Denegado | Resumen propio | B | Denegado |
| Configuración financiera, reglas POS | O | Denegado | Denegado | Denegado | Organización; reglas locales B | Denegado |
| Reglas de comisión | O | B lectura | Denegado | Denegado | B / global según configuración | Denegado |
| Import / export financiero | O | Denegado | Denegado | Denegado | B | Denegado |
| Export clientes | O | B | Denegado | Denegado | Denegado | Denegado |
| Auditoría | O | B | Denegado | Denegado | Acciones finance.* autorizadas | Solo bootstrap global; soporte genera evidencia |
| Soporte | Por membresía comercial | Por membresía | Por membresía | Por membresía | Por membresía | Snapshot de salud explícito + ticket + auditoría |
| Distribuciones: política | O confirmar con evidencia de periodicidad/aprobación/retiros/pérdidas | Denegado | Denegado | Denegado | Lectura B | Denegado |
| Distribuciones: aprobar/pagar/ajustar/cerrar | O, política y estado válidos | Denegado | Denegado | Denegado | B, solo si la política permite finance | Denegado |
| Distribuciones: asignación propia aprobada | O | Denegado | Denegado | P, proyección mínima | B | Denegado |
| Guardar bloques diarios | O y staff asignado activo | B y staff asignado activo | Denegado incluso si son duplicados | P si owner habilitó edición | Denegado | Denegado |

Anon no tiene SELECT de tablas de negocio, APIs internas, exportación ni RPC privilegiada; únicamente catálogo/slots/reserva pública minimizados cuando los gates de organización/sucursal/servicio están habilitados. Las fixtures aisladas prueban ese permiso público; esta tarea no habilita los gates cloud.

## Proyecciones y campos

| Respuesta | Campos autorizados / exclusiones comprobadas |
|---|---|
| Catálogo público | Slugs, nombres comerciales, servicios/duración/precio, disponibilidad por staff slug. Sin customer_id, profile_id, UUIDs internos ni auditoría. |
| Confirmación pública | Referencia, intervalo, duración y staff slug comercial según contrato; no fila completa de cita/cliente. |
| Recepción: checkout/caja | Venta, líneas, pagos y snapshot operativo. Sin comisión_entries, liquidaciones ni snapshot financiero de daily_closures. |
| Finance settings | Solo owner/finance. Recepción, manager y barber no reciben lista de socios ni reglas de reparto por SELECT directo. |
| Barber: catálogo financiero | Staff propio; settings null, comisión_rules/fee_rules vacíos. Lecturas de liquidaciones/adelantos/comisiones limitadas por staff y sucursal. |
| Clientes | Datos organizacionales compartidos para atención, solo sobre clientes pertinentes. No existe un campo de notas privadas por autor: no almacenar secretos o datos médicos en notas. Historial de citas se filtra por acceso a cada cita. |
| Export clientes | Nombre, teléfono, email, próximo regreso. Sin tags/notas, identidad Auth, auditoría o metadata. |
| Export financiero | Solo owner/finance; paginado/bounded antes de exportar, RLS/RPC valida tenant/sucursal, CSV neutraliza fórmulas. Puede incluir snapshots financieros autorizados. |
| Soporte plataforma | IDs org/branch, flags de activación/booking y contadores de jobs pending/dead. Sin nombres, contactos, importes, staff o consultas arbitrarias. |
| Socio barbero | Período, moneda, estado, importe propio asignado/saldo. Sin resultado global, snapshot, política, otro socio, banco, referencias o actores. Las tablas completas siguen reservadas a owner/finance B. |
| Monitor operativo | Solo credencial operativa explícita. DB, antigüedad heartbeat, cola/dead/leases/locks y roundtrip. Sin SQL en espera, clientes ni payloads. HTTP p95/error rate y canal de incidentes no configurados se declaran como tales. |

## Frontera efectiva y pruebas

`src/lib/capabilities.ts` tipa capacidades estables para gates de producto. El servidor obtiene el rol desde la membresía viva. El browser no puede conceder una capacidad: RPC/RLS repiten autorización y scopes, direct writes siguen revocados. No se incorpora editor dinámico de permisos.

`tests/security/contracts.ts`: tenants A/B, sucursales A1/A2, revocación, FKs compuestas, invoker, grants y motor. `tests/integration/finance.ts`: lectura financiera, cash snapshots, liquidación y export. `tests/integration/hardening.ts`: negativos por rol/objeto/campo/registro, plataforma, finance limitado, hash/import y concurrencia. `tests/e2e/permissions.spec.ts`: seis roles con Auth real, HTTP + Data API + escritura + export y cambio de sucursal; solo ejecutable con el Supabase localhost aislado, sin sustitución de Auth por mocks.

La suite HTTP añade Anon, SELECT positivo/negativo, INSERT/UPDATE directo, lectura de auditoría/eventos, headers falsos y user_metadata con rol falsificado. `revocation.spec.ts` usa JWTs reales y prueba HTTP esperando el lock, seguido de SELECT/RPC con el token anterior tras revocar membresía/sucursal/perfil/sesión. SQL también mantiene negativos por fila/campo e idempotencia después de cambios. No se afirma cobertura exhaustiva de todo el producto por cada celda: los escenarios y comandos ejecutados están identificados en el reporte.
