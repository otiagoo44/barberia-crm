# Auditoría de dos pasadas y verificación final

## Base y alcance inicial

22/10/2026. HEAD comprobado `b7d5cfd42611d83347b4307e0c53db173d7b967f`; main `060c47b35dcade2f3929e192158fe028be8fdc4c`. Árbol limpio, todas las ramas publicadas, sin stash. Rama `redesign/black-gold-audit-20261022`, derivada del arreglo MFA del PR #4. No se integra main ni se despliega.

Primera pasada: inventario de todos los archivos versionados de producto/configuración/SQL/tests/scripts y documentación, imports AST, responsabilidades, riesgos, suites y conservación por archivo en [INITIAL_FILE_AUDIT.md](INITIAL_FILE_AUDIT.md). Se conservan las 34 migraciones y las fronteras de autorización. Tamaño de un componente no se clasifica como defecto.

Segunda pasada inicial: inspección visual del artefacto `browser-verification` 12449316011, CI [39830316181](https://github.com/otiagoo44/barberia-crm/actions/runs/39830316181), correspondiente al HEAD inicial. Se revisaron las hojas de contacto de todas las pantallas a 1440/390 y los flujos agenda/detalle/checkout/ficha/configuración/MFA. Los cinco anchos, geometría, axe y flujos Auth reales constan en ese artefacto. No se presenta el antiguo `visual-baseline` del PR #3 como baseline de esta revisión. Reserva pública requiere nueva captura aislada. Las medidas de esta CI no son mediciones cloud.

## Hallazgos iniciales

| ID | Prioridad | Evidencia | Impacto y corrección |
|---|---|---|---|
| F01 | P1 | workspace.css: botones 13px, labels 10/11px; KPI móvil 18px; capturas de todas las pantallas | Información operativa pequeña. Escala 16/15/14px, KPIs legibles, sidebar negra y contraste medido. |
| F02 | P2 | launch-guide.tsx consulta dos flags pero ofrece cuatro enlaces estáticos | No comprueba los nueve estados de puesta en marcha. Diagnóstico con fuentes autorizadas y estados desconocidos explícitos. |
| F03 | P1 | client.ts: cada useResource ejecuta fetch; reload mantiene data anterior sin marcarla | Requests repetidos potenciales y lectura financiera anterior visible durante revalidación. Medir antes; compartir únicamente solicitudes simultáneas por scope, invalidar después de writes y ocultar datos mientras se revalidan. |
| F04 | P2 | CSS: feedback de botón solo cambio de fondo; disabled opacity .55/cursor wait | Falta distinción entre indisponible y procesando, y respuesta visual al clic. Movimiento CSS breve y reduced-motion. |
| F05 | P2 | module/page.tsx rama receptionist: Agenda+WalkIns; operation-home.tsx ya implementa ReceptionHome | Inicio obliga a recorrer calendario antes de ver cobros/espera. Usar la proyección operativa existente. |
| F06 | P2 | Shell.Activity muestra Empty cuando r.data no existe, sin loading/error | Un fallo de red parece ausencia de actividad. Mostrar carga, error y reintento. |
| F07 | P2 | OPERACION_1717.md dice distribuciones no implementadas; handoff describe implementación | Documentación contradictoria. Separar historia de estado vigente, sin habilitar política real. |
| F08 | P3 | capture-product.mjs: métricas agregadas de navegación, sin requests por endpoint/long tasks/percentiles | No permite atribuir lentitud. Instrumentación HTTP/navegador separada de SQL y cloud, baseline reproducible. |

No se comprobó un P0 en la pasada inicial. F03 no implica vulneración de RLS: servidor y DB siguen siendo autoridad. No se promete mejora de latencia antes de medir.

## Vigencia documental

DESIGN.md será sustituido como autoridad visual dentro de este rediseño. PRODUCTION_READINESS.md y UX_TEST_RESULTS.md contienen encabezados del 22/10 vigentes y secciones históricas debajo; sus cifras no se reutilizan como prueba del candidato nuevo. PILOTO_ESTEBAN_JONATAN.md sigue siendo guía operativa con gates humanos. UX_REDESIGN_REPORT.md describe el PR #3 y queda como historia visual. SECURITY_RELEASE_MATRIX.md y FINAL_PERMISSION_MATRIX.md siguen siendo contratos funcionales, con referencias de SHA históricas. OPERACION_1717.md contiene la contradicción F07. 1717_INTEGRATION_HANDOFF.md conserva condiciones válidas de reparto, horarios por fecha, rulos, pagos y activación explícita.

## Límites externos comprobados

Supabase MCP devolvió `MCP authentication required` al consultar la URL del proyecto. No se pudo reconsultar 17:17 en cloud en esta sesión. No se crean usuarios, sucursales, horarios, políticas ni operaciones para suplir ese acceso. Los últimos inventarios cloud documentados son antecedentes hasta revalidación. No hay Docker local; Auth/DB HTTP reales se verifican en Supabase aislado de CI. PostgreSQL embedded local no sustituye GoTrue.

## Segunda auditoría del candidato

Pendiente de implementación y verificación. No declarar aceptación final con esta sección pendiente.
