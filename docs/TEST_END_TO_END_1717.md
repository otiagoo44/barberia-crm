# Verificación vigente — 24/10/2026

La suite nueva financiera, doble aprobación y diagnóstico está documentada en [PRUEBAS_DOBLE_APROBACION](PRUEBAS_DOBLE_APROBACION.md); ejecución y SHA en [CIERRE_FINAL](CIERRE_FINAL_1717_2026_10_24.md). El [piloto real](PILOTO_FINAL_1717.md) con ambos propietarios sigue pendiente. No confundir SQL fixtures, mocks visuales, tokens GoTrue de CI y cuentas productivas. Las instrucciones históricas siguientes no certifican que un paso se haya ejecutado hoy.

---

# Verificación del release 17:17

Las pruebas se ejecutan en PostgreSQL embebido local y, cuando esté disponible, Supabase local de CI. El runner embebido rechaza `TEST_DATABASE_URL` externo; E2E/fixtures de Auth requieren loopback. No se crean clientes, citas, usuarios ni cobros falsos en producción.

## Cobertura conservada

| Flujo                                                                     | Evidencia automatizada                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Crear/encontrar cliente, walk-in, profesional/servicio, iniciar/completar | security/contracts.ts, e2e/operations.spec.ts, e2e/ux-release.spec.ts                |
| Checkout, pago, split, gasto, reversión, caja/conciliación/cierre         | integration/finance.ts, integration/hardening.ts, e2e/ux-release.spec.ts             |
| Dashboard, resultado, retorno e historial                                 | security/contracts.ts, integration/product-release.ts, e2e/operations.spec.ts        |
| Booking público, agenda, retry, concurrencia y aislamiento                | security/contracts.ts, hardening.ts, tests/load, e2e/permissions.spec.ts             |
| Dos owners vinculados a staff sin degradación                             | integration/confirmed-1717.ts + migración 37                                         |
| Catálogo exacto, combo 120/200000, pausa, domingo, idempotencia           | integration/confirmed-1717.ts                                                        |
| MFA, sesiones vivas, revocación y tenant                                  | integration/product-release.ts, e2e/security-release.spec.ts, e2e/revocation.spec.ts |
| Mes vacío, pérdidas, datos desconocidos, resto impar, reversals           | onboarding.ts, product-release.ts, finance.ts, hardening.ts                          |

El bloque financiero del runner `test:db` usa débito **200 bps** y crédito **500 bps**; los contratos genéricos pueden usar otras tarifas sintéticas para demostrar aislamiento/versionado. Las cifras de fixtures no son reglas del negocio real. Configurar una tarifa no registra un pago; aprobar una distribución tampoco ejecuta una transferencia.

## Ejecución actual

Resultados finales y códigos de salida en [RELEASE_FINAL_1717.md](RELEASE_FINAL_1717.md). La evidencia anterior del rediseño se conserva en `docs/verification/review-20261023/` y no se presenta como una nueva ejecución.

Se ejecutan npm ci, audit high, lint, typecheck, unit, DB, hardening, carga, build, E2E y UI heredada. Docker/GoTrue no están disponibles localmente: cualquier caso E2E omitido se informa como omitido y requiere CI con Auth real. Claims/sesiones sintéticos de PostgreSQL prueban autorización SQL, **no enrolamiento MFA real**.

Fallo inicial conservado: la migración del vínculo apuntó al wrapper `manage_record`, pero la implementación desde migración 31 está en `manage_record_core(...,boolean)`. El guard abortó sin modificar datos; se corrigió el target y se repiten instalación/upgrade. No se debilitó el guard para hacer pasar una prueba.

La primera CI del PR #6 pasó 29 de 30 E2E y falló en el ancho al redimensionar Finanzas. Se reprodujo la medición transitoria de Recharts y un solapamiento real de cabecera móvil. Se mantiene la aserción exacta esperando el resize y se corrige la altura automática; nueva regresión UI en cinco anchos, 11 UI aprobados. La CI corregida debe aprobar completamente antes del merge; resultados y procedencia en RELEASE_FINAL_1717.md.

## Piloto real pendiente

Tras cuentas/SMTP/MFA/backup/staging y configuración cloud verificados, ejecutar el recorrido con Esteban, Jonatan y el instalador según PILOTO_ESTEBAN_JONATAN.md. Registrar fecha, SHA, actor, sucursal, casos y resultado. Probar reserva consentida solo después de cerrar gates públicos; usar staging para casos negativos, carreras, fallos y dinero sintético. No declarar el piloto completado por aprobar tests.
