# Matriz de seguridad y release

Base: main `4fa4d63`; revisión del 20/10/2026 en `audit/product-release-20261020`. Ninguna prueba local certifica producción. La matriz comercial del 19/10 se conserva en FINAL_PERMISSION_MATRIX.md.

| Control | Corrección / ruta | Prueba | Límite / gate |
|---|---|---|---|
| Tenant, branch, membresía activa | Helpers de migración 27 conservados; MFA no concede roles | 51 contratos base, 23 hardening | Revalidación final CI pendiente |
| Revocación concurrente | Lock de organización y reautorización; consulta a auth.sessions | hardening.ts y product-release.ts | Auth real por probar en CI aislado |
| MFA privilegiado | Migración 28, lib/auth.ts, api/auth/mfa, /mfa. Owner, manager, finance y plataforma necesitan AAL2; cualquier usuario con factor verificado también | AAL1 SELECT/RPC rechazados, AAL2 sin membresía no concede acceso | Enrollment/challenge/backup real se verifica en CI; recuperación asistida cloud OPEN |
| Sesiones | auth.sessions debe contener session_id del JWT y no haber expirado. Revoke global y signout local comprobables | Producto SQL y security-release.spec.ts | MFA de cuentas proveedor externo |
| Recuperación | Contraseña por correo conserva MFA; autenticador de respaldo y retiro con segundo factor | security-release.spec.ts | SMTP real y responsable break-glass OPEN; no códigos experimentales inventados |
| Frontera browser/server | Cookies HTTP-only, Origin estricto, CSP por nonce, claves publicables en cliente | unit + HTTP negativos | No secretos versionados; proveedor SMTP no configurado |
| Ledger / split / reversals | Reusa finance_command, bigint, movimientos compensatorios y claves finance.* durables | finance.ts y hardening.ts | Conciliación real/piloto OPEN |
| Socios | Políticas versionadas, disabled por ausencia; snapshots y asignaciones congeladas, pagos/ajustes append-only | product-release.ts | Acuerdo real del owner OPEN; no activado en 17:17 |
| Distribución y caja | No paga al aprobar; egreso real separado del resultado operativo, session abierta/saldo, referencia bancaria | Dos pagos concurrentes, sobrepago, devolución e idempotencia | No transferencia bancaria automática |
| Import/export | Preview/hash explícito, ZIP/XML/payload bounded, CSV neutralizado | unit + hardening | XLSX original y cuatro anomalías requieren decisión; ninguna importación cloud |
| Reservas | GiST, duración real y rulos protegidos por DB, disponibilidad por fecha | 100 concurrentes, contratos website/booking | Booking cloud no se abre con esta revisión |
| Monitores | /api/health/operations con CRON_SECRET + RPC worker; heartbeat, dead, leases, backlog y constraint | product-release.ts | Entrega a proveedor y destinatario OPEN |
| Entornos | validate-deployment falla cerrado sin staging independiente | environment.test.ts | Staging cloud no provisionado por esta rama |

## Evidencia y límites

PostgreSQL embedded usa roles y claims de fixture explícitos para probar autorización; no autentica usuarios. `tests/e2e` y las capturas de CI usan GoTrue/Supabase local y tokens firmados reales. Las fixtures de SQL con sesiones sintéticas no se usan como prueba de MFA Auth. Los 27 archivos de migración anteriores permanecen inmutables. Las nuevas migraciones requieren rollout controlado antes del código que las consume.

Los cambios de membresía siguen generando auditoría transaccional. Supabase Auth registra enrollment/challenge en su auditoría propia; no se copian secretos TOTP al ledger ni a logs. La recuperación asistida exige identidad comprobada, revocación de sesiones, evidencia y un operador autorizado del proveedor; no existe un endpoint comercial para quitar MFA de otro usuario.
