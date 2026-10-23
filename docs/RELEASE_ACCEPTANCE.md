# Aceptación de la revisión integrada — 23/10/2026

El PR #5 ya está integrado en main `99a4532637a2902504a994e39464206b1c0c1526`. Esta continuación trabaja en `redesign/final-verification-20261023`, corrige seis grupos de defectos de navegación/estados/reflow y actualiza evidencia sin añadir migraciones. [Auditoría actual](REVIEW_2026_10_23.md), [capturas y resultados](verification/review-20261023/README.md).

Ejecutados localmente: npm ci; audit high sin vulnerabilidades; lint; typecheck; 20 unitarias; 111 contratos DB más onboarding/scheduler/upgrades; 23 hardening; carga sin errores; build; diez pruebas UI aisladas. E2E: un caso aprobado y 29 omitidos por ausencia de Supabase Auth real. Las omisiones no cuentan como aprobadas; la aceptación del nuevo SHA requiere sus checks de CI. Nueve fallos iniciales del producto se reprodujeron antes de corregirlos. Un intento de arrancar el harness falló por cwd y una aserción posterior asumió incorrectamente el rol de input date; se corrigieron los instrumentos sin retirar comprobaciones funcionales.

No se verificaron datos cloud actuales de 17:17 ni se crearon usuarios/sucursales. Siguen pendientes cuentas independientes y MFA, catálogo/duración/rulos, horarios por fecha y descansos, POS, acuerdo 50/50 después de gastos, SMTP/recovery, restore cloud, alertas y piloto. No se habilitan reservas ni distribuciones, no se publica y no se modifica la landing. El estado de main no acredita despliegue o aplicación de las migraciones 35/36 a producción.

El texto siguiente registra la aceptación histórica del PR #5 antes de su integración; sus cifras, ramas y gates deben interpretarse en esa fecha.

# Aceptación histórica de Barbería OS — 22/10/2026

**Candidato aprobado técnicamente en entorno aislado; no habilita producción.** Rama `redesign/black-gold-audit-20261022`, [PR #5](https://github.com/otiagoo44/barberia-crm/pull/5). Incluye las correcciones del PR #4 aún pendientes en main. No hubo merge, deploy, bypass ni apertura de reservas/distribuciones.

Producto verificado: `8a59362db9c701e94cb17ae0240a1a9ab5e33190`. Árbol src: `051ddcb8b6d7f26abc26a0bcde34913ac64f633e`; supabase: `c49634f7f33584d0953e407f3a50489e8bffe457`. [CI 39874912332](https://github.com/otiagoo44/barberia-crm/actions/runs/39874912332): los tres jobs aprobados. El SHA sintético de merge de CI es `aec2ea7c8181d748a09136a4370fa1d8454de99e`; los manifests verifican identidad de los árboles. Los commits posteriores cierran documentación, evidencia y robustecen QA sin cambiar esos árboles. Sus checks se consultan en el PR; no se atribuyen anticipadamente a una ejecución completada.

## Entregables y resultados

| Área | Resultado y evidencia |
|---|---|
| Dos pasadas iniciales e inventario | [INITIAL_FILE_AUDIT.md](INITIAL_FILE_AUDIT.md), por archivo, dependencias, riesgo y conservación; [FINAL_UX_AUDIT.md](FINAL_UX_AUDIT.md), hallazgos P1/P2/P3 y vigencia documental. Sin P0 demostrado. |
| Segunda auditoría posterior | [FINAL_FILE_REVIEW.md](FINAL_FILE_REVIEW.md), inventarios con hashes y revisión de cambios; 34 migraciones históricas intactas. Límites del análisis explícitos. |
| Diseño | [DESIGN.md](../DESIGN.md) canónico; CLI oficial 0.4.0 lint sin errores/advertencias, diff y export ejecutados. DM Sans elegida tras comparación real con Inter en cinco anchos. |
| Movimiento y estados | [MOTION_DESIGN_SYSTEM.md](MOTION_DESIGN_SYSTEM.md); CSS nativo, feedback inmediato, loading/error/confirmación por respuesta real, reduced motion, teclado y foco. |
| Dependencias y compilación | npm ci, npm audit --audit-level=high (cero vulnerabilidades), npm run lint, npm run typecheck, npm run build: aprobados. Inter solo dev/QA; sin nueva infraestructura ni biblioteca de motion/caché. |
| Unitarios | npm test: 20 aprobados. |
| Base y finanzas | npm run test:db: 111 contratos (51 seguridad/operación, 19 finanzas, 23 hardening y 18 producto), más onboarding/scheduler, upgrade desde 27 y equivalencia exacta dashboard 35→36. |
| Hardening | npm run test:hardening: 23 aprobados, repetición explícita del bloque incluido en DB, no 23 contratos distintos adicionales. |
| Carga | npm run test:load: escenarios 10/50/100 tenants, concurrencia y concentrados sin errores. [JSON](verification/definitive/load-results.json). No demuestra capacidad cloud. |
| Auth y navegador | npm run test:e2e: 29 aprobados, cero fallidos/omitidos en esta ejecución. GoTrue real, MFA, roles, sesiones, pagos divididos, cierre, reserva concurrente y rollback. |
| Visual y accesibilidad | 110 PNG antes / 195 después; 360/390/768/1024/1440. Candidato: 74 auditorías axe, cero violaciones y errores JS/consola/API. [Capturas y límites de inspección](verification/definitive/visual/README.md). |
| Ampliación y estados | E2E de teclado/foco, reduced motion, filtros, carga/error/revalidación, cambio de scope, modal con zoom CSS 200% y reflow 720x500. No certifica todos los navegadores ni dispositivos físicos. |
| Rendimiento | [PERFORMANCE_BEFORE_AFTER.md](PERFORMANCE_BEFORE_AFTER.md): HTTP mismo runner/datos/esquema; SQL 34/36 separado; React Profiler en build independiente; p50/p95/p99 y planes completos. |
| Seguridad y restauración | [FINAL_SECURITY_VERIFICATION.md](FINAL_SECURITY_VERIFICATION.md), [permisos](FINAL_PERMISSION_MATRIX.md), [restore local](verification/definitive/restore-local.json) y [upgrade](verification/definitive/migration-upgrade.json). El advisor cloud sigue bloqueado por acceso. El workflow final incorpora advisors del Supabase local como gate adicional; su resultado se consulta en los checks del HEAD. |

La mejora SQL medida del dashboard owner es p50 745,21→6,29 ms, p95 750,95→12,33 y p99 756,06→17,72, con 2003 clientes y 250 cobros de fixture. No se extrapola a otros roles ni cloud. En HTTP, Caja baja de dos GET a uno y de 1036,59 a 537,05 ms de mediana; Inicio de seis GET a cuatro, Finanzas de cuatro a tres. Cero duplicadas en ambos muestreos. Reportes API p95 sube de 439,82 a 448,16 ms; los chunks totales crecen de 1401051 a 1419485 bytes. No se presentan esas variaciones como mejoras. Cinco muestras HTTP y veinte SQL no constituyen SLA ni INP de campo.

Los fallos intermedios no se ocultan: se detectaron contraste público 3,77:1, recorte del título al ampliar, cifras grandes que desbordaban, selección financiera sin estado, carga de caja ambigua y defectos del harness (localizadores, fixture cerca de medianoche y ruta del CLI Next). Se corrigieron y repitieron los checks. Ejecuciones fallidas/canceladas anteriores y pasos omitidos no cuentan como aprobados; referencias en FINAL_UX_AUDIT.md. La ejecución citada arriba no tiene tests omitidos.

## Migraciones nuevas

1. `20261022205615_default_product_gold_brand.sql`: DEFAULT dorado para organizaciones futuras; no actualiza marcas existentes.
2. `20261022210809_dashboard_statement_owner_guard.sql`: guard owner uniforme evaluado una vez por sentencia en dos contadores, conservando sesiones vivas y predicado por cliente para otros roles. Sin cambios de RLS/grants ni comandos financieros.

Probadas en instalación y upgrade aislados, **sin aplicar a producción**. Sin constraints eliminadas, índices especulativos ni migraciones históricas reescritas.

## Gates humanos de producción

Reconectar Supabase y reconsultar la organización/sucursal existentes; confirmar cuentas independientes de Jonatan/Esteban, vínculo a staff, roles, MFA y respaldo. Confirmar catálogo/duración, rulos con consulta, disponibilidad real por fecha y descansos, tarifas POS y apertura de caja. Confirmar política 50/50 después de gastos, pérdidas/retiros y evidencias antes de habilitar distribuciones. SMTP y recuperación entregados, backup/restore cloud con RPO/RTO, alertas recibidas, staging independiente y piloto acompañado siguen separados de CI.

No recrear registros ni inventar turnos semanales. No importar historia ambigua. La landing conserva sus fuentes; sincronizar su identidad posteriormente conservando WEBSITE_INTEGRATION.md. Reservas públicas solo tras decisión expresa y configuración válida. Tener el PR listo no autoriza publicar ni operar datos reales.

## Procedimiento de rollout pendiente

1. Recuperar acceso de lectura al proyecto confirmado `tbcfhagteyqufjkmbxzz`. Comparar el historial real de 34 migraciones con Git y consultar organización/sucursal/cuentas existentes antes de proponer registros. Refrescar advisors de seguridad/rendimiento cloud.
2. En staging independiente, comprobar backup y restauración; aplicar únicamente las dos migraciones incrementales en orden. Verificar DEFAULT y marcas existentes, equivalencia del dashboard y denegaciones con MFA y sesiones reales.
3. Revisar PR/checks, permisos y piloto. Conservar main protegida. El preview sin secretos de staging sigue cerrado; CI aislada no reemplaza ese entorno.
4. Publicar únicamente después de autorización de rollout. Verificar health/readiness/monitor y operaciones con cuentas independientes; reservas y distribuciones mantienen sus flags hasta confirmación operativa expresa.
5. Ante regresión, detener nuevas habilitaciones y volver a un build compatible con MFA; corregir SQL mediante migración incremental hacia adelante. No borrar historia, ledger ni constraints, y no desactivar AAL2. Estas migraciones no transforman datos comerciales existentes.
