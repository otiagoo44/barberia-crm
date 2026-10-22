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
