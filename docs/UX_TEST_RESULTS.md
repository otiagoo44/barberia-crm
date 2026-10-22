# Cierre verificado del rediseño, 22/10/2026

Revisión posterior al despliegue inicial: los logs mostraron un error esperado de MFA al abrir un enlace directo del workspace. Next renderiza página y layout en paralelo; se agrega a la página la misma redirección de sesión/MFA del layout, antes de cualquier lectura comercial. El E2E comprueba enlaces directos a Inicio, Agenda, Clientes y Caja en AAL1 para cada rol privilegiado, más un enlace anónimo hacia Login. No se cambian RPC, permisos, sesiones ni enforcement. El PR de corrección vuelve a ejecutar la suite completa y capturas.

La primera prueba con el usuario reveló que no estaba claro qué aplicación necesitaba el QR. El primer acceso ahora explica el autenticador, ofrece enlaces oficiales Android/iPhone, distingue el escaneo dentro de la app de la cámara normal y explica la clave manual para usar el mismo teléfono. El E2E de enrolamiento captura esta ayuda a cinco anchos y audita contraste/semántica con axe a 390/1440, antes de generar secretos; no se capturan QR reales de usuarios.

Producción inicial confirmada en `060c47b35dcade2f3929e192158fe028be8fdc4c`, Vercel READY, dominio verificado `barberia-crm-kappa.vercel.app`, Supabase correcto y health/ready 200; worker sin secreto 403. Quince capturas públicas de Login/alta/recuperación aprobaron sin overflow, errores ni violaciones axe. Lighthouse móvil del Login: rendimiento 74, accesibilidad 100, buenas prácticas 100; LCP 2.762 ms, TBT 1.033 ms y CLS 0,0001. Medición sintética desde esta estación compartida: el coste de hidratación sigue siendo una limitación observada; no se presenta como Core Web Vitals aprobado ni como velocidad garantizada de pantallas privadas. La revisión de logs identificó la redirección MFA corregida arriba; el 403 del worker corresponde al smoke negativo intencional. Alertas externas y restore administrado siguen pendientes.

Producto: **9d1738713ebdbdc9decf73273ddb7a0b826bec29**. [CI completa aprobada](https://github.com/otiagoo44/barberia-crm/actions/runs/39817313839): quality, supabase-e2e y visual-baseline. [Resumen verificable](verification/ux/final/summary.json).

## Parche de seguridad previo a publicación

La reejecución del commit de cierre detectó avisos de seguridad en Next.js 16.4.0 y bloqueó quality. Se actualiza únicamente Next.js a **16.4.2**, con versión exacta y lockfile, para corregir [RCE de optimización de imágenes](https://github.com/advisories/GHSA-2464-fhr4-w9xw) y [DoS de Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). La instalación corregida informa cero vulnerabilidades. Los árboles src/supabase permanecen intactos; CI vuelve a ejecutar build, contratos, E2E y capturas con ese runtime antes del merge. El resumen siguiente identifica la evidencia visual inicial, no sustituye los checks del HEAD definitivo.

## Evidencia final

- 20 unitarias, 110 contratos DB (51 seguridad/operación, 19 financieros, 23 hardening, 17 producto), 25 E2E aprobados sin skips con Auth/Data API/RPC/HTTP reales y aislados. Incluye recepción → atención → checkout dividido → cierre → revisión owner, revocación viva, MFA, semana, teclado/Escape/foco. No se eliminaron asserts.
- Instalación limpia, upgrade desde 27 y restore local aprobados: dinero exacto, historia, dedupe, RLS y no solapamiento. npm ci, audit high, lint, typecheck y build aprobados.
- [105 capturas ANTES](https://github.com/otiagoo44/barberia-crm/actions/runs/39817313839/artifacts/12443465903) y [180 DESPUÉS con reporte Playwright](https://github.com/otiagoo44/barberia-crm/actions/runs/39817313839/artifacts/12443592078). Artefactos retenidos 90 días; manifiestos y muestras en verification/ux/final.
- Cinco anchos: 360, 390, 768, 1024, 1440 px. **170 comprobaciones geométricas sin overflow, 72 auditorías axe sin violaciones, cero errores de aplicación/consola/HTTP**. Reduced motion activo; teclado, Tab/Shift+Tab, Escape y restitución de foco comprobados por E2E. No certifica WCAG ni dispositivos físicos.
- Se inspeccionaron las 180 capturas en hojas de contacto; se ampliaron Agenda, Inicio, ficha, Checkout y Finanzas y se comparó Agenda móvil con el baseline recuperado. Incluye todos los módulos pedidos, día/semana/detalle, Inicio por rol, actividad/notas y administración/confirmación MFA.
- El checkout de CI es 0991a8840c7c9969c835c3fbd0c2bc1e5c7122d7. Sus árboles src=d3fc5cbbd2a65a8c63f675db2355649fe6198938 y supabase=66c15acce411bc990d6f5258327cbf2653e04c74 coinciden exactamente con el producto. No se validó el candidato con imágenes antiguas.

## Rendimiento y skills

Google DESIGN.md 0.4.0: lint/diff/export repetidos, cero errores/advertencias. UI UX Pro Max: sistema, foco/teclado y React repetidos; recomendaciones de landing descartadas. Awesome/Notion, Taste e Impeccable aplicados con lecturas verificadas de Twenty, Frappe y Occidental; procedimientos en UX_REDESIGN_REPORT.md.

En 95 navegaciones comparables, DOMContentLoaded mediano: 136,2 ms antes y 173,6 ms después; transferencia mediana 14.510 y 14.132 bytes. La duración aumenta; no se afirma una mejora causal. Son navegaciones cacheadas de CI, no LCP/INP. Carga: 1.800 operaciones, cero errores; hasta 100 organizaciones, 200 sucursales, 500 profesionales, 10.000 clientes y 10.300 reservas. Máximos p95 sintéticos en CI: dashboard 2.034 ms, agenda 398 ms, búsqueda 342 ms, reserva 669 ms. No son un SLA cloud.

## Conexión y rollout cloud ejecutados

Proyecto confirmado: https://tbcfhagteyqufjkmbxzz.supabase.co, coincidente con producción Vercel. Siete migraciones aplicadas con apply_migration, payloads SHA256 verificados; timestamps generados por el transporte normalizados a las versiones originales del repositorio. **27 migraciones originales intactas, historial final 34**. [Registro](verification/ux/final/cloud-rollout.json). Cero tablas públicas sin RLS y cero constraints sin validar; un solo scheduler pg_cron activo.

Instantánea privada previa de datos de aplicación, funciones y políticas; excluye secretos Auth y no sustituye backup/restore administrado completo. Sin fixtures ni transacciones comerciales en cloud; reservas públicas y distribuciones deshabilitadas. Se mantienen 1 organización, 1 sucursal, 2 profesionales, 5 servicios y 1 cuenta Auth con cero factores verificados. El propietario debe enrolarse desde /mfa.

El preview falla por preview_database_boundary_not_configured: falta staging independiente. Se conserva esa frontera. La publicación en main utiliza producción; el mensaje final identifica el merge y deployment efectivamente probado. La evidencia visual corresponde a los árboles de producto anteriores, aunque el commit de entrega agregue documentación.

## Pendientes reales para los usuarios

[Guía Esteban/Jonatan](PILOTO_ESTEBAN_JONATAN.md): cuentas y roles individuales, vínculo al staff, MFA y respaldo, SMTP/recuperación entregada, horarios diarios, catálogo/fees confirmados, acuerdo de reparto, respaldo/restore cloud, alertas y piloto acompañado. Supabase Advisor mantiene WARN de protección de contraseñas filtradas deshabilitada: revisar disponibilidad del plan y activarla. INFO de tablas privadas con RLS sin políticas corresponde a denegación por defecto; no abrirlas.

La publicación técnica no sustituye esos pasos. Los bloqueos y pendientes visuales mencionados en el historial siguiente quedaron resueltos por esta CI y la inspección final; los pendientes comerciales indicados arriba siguen vigentes.

---

## Historial de iteraciones (conservado, no estado actual)

# Resultados UX

Estado: pendiente de cierre visual del candidato. Una captura fallida o prueba omitida no se cuenta como aprobada.

## Verificación de esta sesión, 22/10/2026

Build de producción, lint, typecheck y 20 unitarios aprobados. La suite DB completa aprobó 51 contratos de seguridad/operación, 19 financieros, 23 de hardening y 16 de producto (109), incluido upgrade 27→33. Se repitió hardening por separado: 23 aprobados. La carga completa cubrió 10/50/100 organizaciones (hasta 200 sucursales, 500 profesionales, 10.000 clientes y 10.300 reservas), más un tenant concentrado: cero errores en 1.800 operaciones. Los p95 locales de hasta 7,29 segundos muestran una limitación; no se presentan como rendimiento de producción satisfactorio. Entorno: PostgreSQL embebido, 4 CPU lógicas y 4 GiB RAM; se ejecutaron otras comprobaciones simultáneas, por lo que no es una medición controlada de mejora.

Se abrió el build real en Chromium local, sin interceptar APIs ni enviar formularios a Auth: Login, crear cuenta y recuperar acceso en 360/390/768/1024/1440 px. Las 15 capturas no desbordan y sus auditorías axe no detectaron violaciones; cero errores de consola. Se inspeccionaron Login 390, alta 1440 y recuperación 360. [Registro y hashes](verification/ux/local-public-auth/results.json), [captura móvil](verification/ux/local-public-auth/login-390.png). Esto verifica únicamente formularios públicos y no sustituye MFA o pantallas privadas.

Se descargaron los artefactos del [run 39681824022](https://github.com/otiagoo44/barberia-crm/actions/runs/39681824022): baseline recuperado y candidato anterior. Se inspeccionaron Inicio 1440, Agenda 390 y Finanzas 390 del candidato anterior, localizando la guía desproporcionada y la tabla sin foco. Las correcciones actuales todavía requieren recaptura autenticada. El E2E nuevo de semana está preparado; sus 25 pruebas no se declaran ejecutadas.

Bloqueo de publicación verificado: GitHub MCP rechazó tanto crear el árbol como escribir un documento en la rama con 403 `Resource not accessible by integration`. Git HTTPS también falló por timeout. El entorno local no tiene Docker para levantar Supabase Auth aislado; PostgreSQL embebido sí permite la suite DB anterior. No se sustituyó Auth con mocks ni se usó el proyecto cloud para fixtures. El login MCP solicitado quedó esperando callback y venció; la URL configurada coincide con el proyecto solicitado y sigue habilitada.

Por estos bloqueos no existe CI nuevo aprobado ni validación visual privada del candidato de esta sesión. No se declara terminado el rediseño. [Resumen local](verification/ux/analysis/local-checks.json).

## Iteración comprobada

- `d29875b9eca575084ecaa6e5e9bb908815d1db7c`: quality y 24 E2E reales aprobados. Captura detenida al solicitar menú móvil en breakpoint de sidebar. Se inspeccionaron Agenda, ficha, Inicio y Caja a 390 px; se corrigió altura fija de cabecera que tapaba contenido.
- `b834b7573c9cb793f4614cf29146ccd0fc352084`: quality aprobado. Axe exigió BrowserContext explícito; se corrigió el harness con browser.newContext(), conservando comprobaciones.
- Local: lint/typecheck, 20 unitarios y 16 contratos de producto. Primera DB completa falló en limpieza de fixture por FK; se aisló su tenant y los 16 contratos pasaron. La suite completa debe confirmarse en CI.
- Google DESIGN.md incluido 0.4.0: cero errores/advertencias; diff sin regresión. Valida tokens, no certifica navegador.
- `4600048`: quality, 24 E2E con Auth real, restore y baseline aprobados en run `39681824022`. La auditoría final detectó dos incidencias `scrollable-region-focusable` en Finanzas y en Inicio de Finance a 390 px. Se corrigió FinanceTable y se extendió la misma semántica a tablas de caja, permisos, auditoría e importación. No se deshabilitaron reglas de axe.
- Iteración actual: guía operativa plegada; franjas/ausencias por rango en una sola lectura, sin consultas por día; loading y reintento explícitos. Se agregan capturas de semana, detalle/nueva reserva, actividad/notas, finanzas de 7 días y las áreas de reportes. Se amplía retención de artefactos a 90 días.
- Validación local repetida: lint y typecheck aprobados, 20/20 unitarios; suite DB completa con upgrade 27→33 y 16/16 contratos de producto aprobados. El cierre del candidato queda condicionado a la próxima ejecución íntegra con navegador real.

## Cierre requerido

Workflow: npm ci, audit high, lint, typecheck, unitarios, DB, hardening, carga y build; Auth/Data API/RPC/HTTP y Playwright reales, upgrade desde 27 y restore. Conserva dinero exacto, revocación y no doble reserva.

Capturas con salida limpia, checkout identificado, cero overflow y errores de aplicación/HTTP/consola, espera de cargas y reduced motion. Axe a 390/1440; screenshots/geometría a cinco anchos. Baseline registra defectos; candidato debe corregir violaciones. Menús/drawers conservan Tab/Shift+Tab, Escape y restitución. No se eliminan asserts del E2E recuperado.

Pendiente registrar SHA final, ejecución completa, capturas inspeccionadas, correcciones de contraste, comparación de rendimiento y limitaciones observadas. No se declara terminado con estos campos pendientes.

## Gates externos

Sin despliegue, merge, reservas públicas ni distribuciones reales. Staging, enrolamiento/recovery MFA cloud, SMTP, restore cloud RPO/RTO, alertas recibidas, acuerdos de socios y piloto conservan gates de STAGING_ROLLOUT_PR3.md y PRODUCTION_READINESS.md.
