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
| F03 | P1 | client.ts: reload mantiene data anterior sin marcarla | Lectura financiera anterior visible durante revalidación. Invalidar después de writes y ocultar datos mientras se revalidan. El muestreo inicial no encontró requests duplicadas; no se incorpora caché ni deduplicador sin necesidad medida. |
| F04 | P2 | CSS: feedback de botón solo cambio de fondo; disabled opacity .55/cursor wait | Falta distinción entre indisponible y procesando, y respuesta visual al clic. Movimiento CSS breve y reduced-motion. |
| F05 | P2 | module/page.tsx rama receptionist: Agenda+WalkIns; operation-home.tsx ya implementa ReceptionHome | Inicio obliga a recorrer calendario antes de ver cobros/espera. Usar la proyección operativa existente. |
| F06 | P2 | Shell.Activity muestra Empty cuando r.data no existe, sin loading/error | Un fallo de red parece ausencia de actividad. Mostrar carga, error y reintento. |
| F07 | P2 | OPERACION_1717.md dice distribuciones no implementadas; handoff describe implementación | Documentación contradictoria. Separar historia de estado vigente, sin habilitar política real. |
| F08 | P3 | capture-product.mjs: métricas agregadas de navegación, sin requests por endpoint/long tasks/percentiles | No permite atribuir lentitud. Instrumentación HTTP/navegador separada de SQL y cloud, baseline reproducible. |
| F09 | P1 | critical.ts, 2003 clientes; dashboard SQL p50 855,71 ms, p95 861,10 ms en CI 39855106528 | El propietario recalcula su mismo guard por cada cliente en dos contadores. Migración 36 eleva ese guard uniforme a initPlan de la misma sentencia; conserva el predicado por fila para otros roles. Tras el cambio: p50 6,25 ms, p95 14,31 ms. Equivalencia de resultados antes/después y denegaciones verificadas. |

No se comprobó un P0 en la pasada inicial. F03 no implica vulneración de RLS: servidor y DB siguen siendo autoridad. No se promete mejora de latencia antes de medir.

## Vigencia documental

DESIGN.md es la autoridad visual actual del rediseño. PRODUCTION_READINESS.md y UX_TEST_RESULTS.md contienen encabezados del 22/10 y secciones históricas debajo; sus cifras no se reutilizan como prueba del candidato nuevo. PILOTO_ESTEBAN_JONATAN.md sigue siendo guía operativa con gates humanos. UX_REDESIGN_REPORT.md describe el PR #3 y queda como historia visual. SECURITY_RELEASE_MATRIX.md y FINAL_PERMISSION_MATRIX.md siguen siendo contratos funcionales, con referencias de SHA históricas. OPERACION_1717.md contenía la contradicción F07, ya corregida. 1717_INTEGRATION_HANDOFF.md conserva condiciones válidas de reparto, horarios por fecha, rulos, pagos y activación explícita.

## Límites externos comprobados

Supabase MCP devolvió `MCP authentication required` al consultar la URL del proyecto. No se pudo reconsultar 17:17 en cloud en esta sesión. No se crean usuarios, sucursales, horarios, políticas ni operaciones para suplir ese acceso. Los últimos inventarios cloud documentados son antecedentes hasta revalidación. No hay Docker local; Auth/DB HTTP reales se verifican en Supabase aislado de CI. PostgreSQL embedded local no sustituye GoTrue.

## Segunda auditoría del candidato

Implementación revisada por diff: primitivas, tokens, contraste dinámico por organización, scope y ciclo de lecturas, lectura de onboarding, carga diferida de Caja/Finanzas y las dos migraciones nuevas. Los cambios en formularios añaden feedback a los estados existentes sin alterar comandos ni importes. El contrato público y la landing conservan sus fuentes originales.

Durante esta pasada se corrigieron tres defectos de la propia implementación/QA: prioridad CSS de disabled frente a hover, indicador busy de Walk-ins limitado a la fila afectada y localizadores del capturador/E2E. Se eliminó BOM incidental de los TSX. Las capturas no se aprueban únicamente por pasar axe: se inspeccionan después de la ejecución completa.

| Hallazgo posterior | Prioridad | Evidencia y corrección |
|---|---|---|
| Modal al ampliar | P1 | E2E de bc6ed5c midió el título en y=-19,41px al 200%; reproducción aislada con CSS/markup real confirmó el recorte. max-height combina dvh y porcentaje del área disponible; drawers también se acotan al viewport. Se conserva scroll y foco. |
| Selección pública | P1 | Captura real bc6ed5c: pasos de reserva con contraste 3,77:1 a 390/1440. Pasos y slots pasan a brand/on-brand; salto al contenido usa blanco sobre acento oscuro. Componentes renderizados con seis marcas extremas aprobaron axe y disabled/hover local. |
| Sección financiera sin indicación | P2 | Los botones .tabs tenían clase active, sin regla visual ni estado ARIA. Se añade aria-pressed, grupo con nombre, separación y superficie de marca para la sección seleccionada. No se cambian consultas ni comandos. |
| Importes grandes en móvil | P1 | Reproducción aislada con el CSS y DM Sans reales: a 390px, dos KPI con Gs. 128.450.000 / Gs. 9.000.000.000.000 expandían la página a 496px. En móvil se usa una columna y cifras desde 28px; los valores extremos pueden reajustarse sin ocultar caracteres. Se añade prueba visual de cinco anchos con valores sintéticos rotulados, sin writes. |
| Caja de recepción durante carga | P2 | El componente existente mostraba «Sin apertura» cuando todavía no había respuesta. Ahora distingue «Consultando caja…», «Sin datos» y ausencia de sesión confirmada. Prueba con respuesta real retenida, usando cuenta de recepción. |

La captura de bc6ed5c produjo 195 PNG, 74 auditorías axe, cero errores JS/consola y cero respuestas API fallidas. Solo dos auditorías de reserva pública fallaron por el contraste descrito; el candidato se rechazó y corrigió. Los otros 27 E2E pasaron; la prueba nueva de ampliación detectó el recorte real. No se suprimió ninguna aserción para aprobarlo.

Comparación tipográfica real: Clientes a 360/390/768/1024/1440, mismo contenido, 16px y fuentes variables autoalojadas. Se inspeccionaron a escala real DM Sans e Inter a 390/1440, además de hojas de contacto de todos los módulos/roles. DM Sans preserva legibilidad y deja visible la acción de la última columna a 1440; Inter ensancha la tabla. Cadena monetaria 119/127px y texto español 347/366px (DM/Inter), sin desborde de página en ambas. Se conserva DM Sans. Esto no mide velocidad de lectura humana. El paquete Inter es únicamente dev/QA y no se importa en producción.

Verificación complementaria local del DataChart real, renderizado con datos sintéticos en navegador aislado: tooltip a 390/1440, fondo blanco, texto #171715 de 16px, cero violaciones axe; se inspeccionó su captura. No sustituye los flujos Auth/API de CI. Se probaron además seis marcas extremas para acciones y estados seleccionados. Evidencia en verification/definitive/chart-tooltip.json y components-contrast.json.

CI 39872184366 aprobó los 28 E2E completos, incluido recepción → atención → split → cierre. La ejecución anterior había encontrado un fixture de walk-in que cruzaba medianoche en UTC: la DB lo rechazó correctamente. Se normaliza únicamente la sucursal sintética hacia mediodía local, conservando el reloj real y todos los guards. Esa CI falló después en el comparador por una ruta incorrecta del CLI de Next; se corrigió consultando el binario declarado por el paquete. Los pasos de benchmark omitidos no se presentan como aprobados. Los instrumentos exigen tanto frontend como Supabase en loopback y redactan secretos de diagnósticos de arranque.

CI 39855106528: quality completo aprobado, 27/28 E2E aprobados, uno fallido por localizador de etiqueta envolvente; captura baseline fallida porque el fixture consultado tenía reservas apagadas. No se contabilizan los pasos omitidos como exitosos. Se corrigió el localizador por rol/nombre y se usa el tenant QA B, ya habilitado por su fixture aislado, para la pantalla pública; el tenant QA A continúa con reservas apagadas. Resultados definitivos en RELEASE_ACCEPTANCE.md.

## Cierre de la segunda auditoría

[CI 39874912332](https://github.com/otiagoo44/barberia-crm/actions/runs/39874912332), producto 8a59362: tres jobs aprobados; 29 E2E sin omisiones, 195 PNG del candidato, 74 auditorías axe sin violaciones y cero errores JS/consola/API. Base exacta b7d5cfd: 110 PNG. Árboles de producto y procedencia comprobados en [release-evidence.json](verification/definitive/release-evidence.json). La comparación HTTP/SQL y el perfil React terminaron correctamente.

Se volvieron a inspeccionar las seis hojas de contacto del candidato a 390/1440, cubriendo módulos, roles y estados; se revisaron a escala real, entre otras, recepción a 390, finanzas a 390, importes extremos a 360 y el modal al 200%. Las inspecciones anteriores incluyeron Agenda 1440, Finanzas 1440, Configuración 1440, Clientes 768, Inicio 1024, checkout 360 y tipografías a 390/1440. La validación geométrica y funcional abarca los cinco anchos. Las hojas son vistas generales, no una declaración de lectura humana individual de todos los PNG. [Selección permanente antes/después](verification/definitive/visual/README.md).

Sin P0/P1 verificados abiertos dentro del alcance ejercitado. Se conservan scroll interno de tablas/calendario y permisos por rol. No se infiere certificación de dispositivos físicos, zoom nativo de todos los navegadores, INP de usuarios reales, rendimiento cloud ni configuración de 17:17. Esos límites y los gates externos están en [RELEASE_ACCEPTANCE.md](RELEASE_ACCEPTANCE.md). [Revisión final por archivo](FINAL_FILE_REVIEW.md) compara inventarios sin borrar material inicial ni reescribir las 34 migraciones históricas.
