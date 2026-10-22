# Rediseño operativo de Barbería OS

PR #3, rama `audit/product-release-20261020`. Base visual: PR recuperado `da9eb8ccfab9526beee89d2a74fd9d82c6674ed4`. No se reconstruyó el CRM ni se aplicaron migraciones a producción. El cierre de CI y la inspección están en [resultados](UX_TEST_RESULTS.md).

## Referencias de código verificadas

El [manifiesto](verification/ux/analysis/references.json) conserva commits y rutas.

| Fuente | Código inspeccionado | Adaptación |
|---|---|---|
| Twenty `d7499bf4ba11ed8c8a9392e02a42bb12b576e543` | `MainNavigationDrawerNavigationContent.tsx`, `RecordTable.tsx` | Navegación contextual, objetos autorizados, estados de tabla. No se incorpora metadata dinámica. |
| Frappe CRM `2c4b488bb858c18935a4ca27fe5fd7922cb45be5` | `Layouts/AppSidebar.vue`, `ContactsListView.vue`, `pages/Contact.vue`, `Activities/ActivityHeader.vue` | Identidad/contacto, actividad y notas separadas; acciones contextuales. No se traslada el pipeline de ventas. |
| Occidental `e623009abe253838b4c495d7612e7bde3555b6c4` | `DESIGN.md`, `src/styles.css`, `src/tokens.css`, `AppShell.tsx`, `common.tsx`, `Inquiries.tsx`, `RecordPanel.tsx` | Superficie continua, tabla compacta, filtros/vistas y panel lateral con pestañas. No se copia dominio, fixtures, marca ni código. |

Occidental sí fue accesible y se inspeccionó. Queda corregida la declaración de falta de referencia del informe anterior. Se usó el conector GitHub y un checkout de referencia para recorrer componentes no cubiertos por la búsqueda. Su navegación móvil no sustituye el diálogo accesible ya recuperado.

## Skills y decisiones

Se leyeron las cinco SKILL.md, coordinación y referencias pertinentes antes de editar.

| Skill | Procedimiento ejecutado | Evidencia / decisión |
|---|---|---|
| Awesome Design MD | Catálogo y análisis de Notion | Geometría y jerarquía; descartados marketing, colores y fuente propietaria. |
| Google DESIGN.md | Especificación; lint, diff y export del CLI oficial incluido 0.4.0 | [Lint](verification/ux/analysis/design-lint.json), [diff](verification/ux/analysis/design-diff.json), [export](verification/ux/analysis/design-export.css): cero errores y advertencias. El export es interoperabilidad, no una segunda fuente de tokens. |
| Taste | Brief, diales, arquitectura, rediseño y preflight | Aplicación empresarial de uso diario: variance 2, motion 1, density 7. Se conservan rutas, negocio, Lucide y Recharts. |
| UI UX Pro Max | Sistema visual, UX de foco y stack React; una consulta más estrecha al obtener patrones de landing | [Sistema](verification/ux/analysis/ui-ux-design-system.md), [UX](verification/ux/analysis/ui-ux-accessibility.md), [React](verification/ux/analysis/ui-ux-react.md). Se adopta sobriedad; se descartan hero, scroll reveal y fuentes/colores sugeridos. |
| Impeccable | Auditoría contra capturas: jerarquía, responsive, estados, accesibilidad y rendimiento | Se encontró cabecera móvil de altura fija que tapaba contenido y se corrigió. No se afirma usar un CLI de Impeccable inexistente. |

Python disponible: `C:/Users/User/.cache/watch/whisperx-venv/Scripts/python.exe`. Comandos realizados: `python .agents/skills/google-design-md/scripts/designmd.py lint DESIGN.md`, `diff <DESIGN-anterior> DESIGN.md`, `export --format css-tailwind DESIGN.md`; `python .agents/skills/ui-ux-pro-max/scripts/search.py "CRM internal workspace" --design-system -f markdown --variance 2 --motion 1 --density 7`, luego `enterprise operations dashboard`; consultas `focus modal keyboard --domain ux` y `table filtering state --stack react`. No se duplicaron skills ni modificaron licencias.

Se aplicaron las reglas React de hooks, imports dinámicos y estado local; Supabase/Postgres para RLS, proyecciones, índices y paginación. Se contrastó documentación vigente de RLS antes de ampliar lecturas. Las APIs no usan service role.

## Sistema y flujos

[DESIGN.md](../DESIGN.md) es la autoridad. Canvas claro, superficies blancas, texto carbón y un acento índigo de aplicación. DM Sans Variable 5.3.0 autoalojada, SIL OFL incluida en Fontsource; Inter (OFL) se evaluó por legibilidad numérica. Se elige DM Sans por continuidad con Occidental y formas abiertas. No hay fuentes privadas ni requests a Google Fonts. Logo y brand_color siguen configurables con contraste calculado; no se impone marca de 17:17.

Navegación por Operación, Clientes, Negocio, Resultados y Configuración, según rol real. La búsqueda respeta diálogos e inputs. Recepción consulta jornada, espera y caja; Finanzas consulta su módulo sin solicitar agenda/clientes. Owner, Manager y Barber conservan proyecciones de negocio, sucursal y trabajo propio.

Agenda en día/semana con posición y duración reales, columnas estables, franjas/descansos registrados y hora actual. Cancelaciones/ausencias quedan fuera de la ocupación gráfica pero siguen accesibles. Citas cortas conservan altura; Lista permite lectura completa. Límites de fecha en tiempo transcurrido, incluso con DST y medianoche. El espacio vacío no significa disponibilidad.

Clientes conserva paginación y añade última visita/servicio/profesional en lectura acotada. Drawer con resumen, próximas reservas, actividad, notas autorizadas, rebooking y contacto. Vistas personales: sólo filtros, separadas por tenant/usuario, máximo ocho; sin búsquedas ni datos de clientes almacenados.

Caja conserva apertura/cierre, esperado/contado/diferencia, cobros y métodos reales en una pantalla. Checkout mantiene claves durables, split transaccional y confirmación sólo tras respuesta. El selector común usa el catálogo autorizado. No hay pagos ni transferencias creados por estados visuales.

Gráficos diferidos, tablas accesibles, moneda/unidades y null diferente de cero. Ventas y cobros por fechas independientes; resultado, gastos y medios reales. Reportes agrupados por operación, clientes/retorno y equipo/servicios. No hay crecimientos inventados ni capacidad desconocida convertida en 0%. Producción monetaria/comisiones por profesional siguen en vistas financieras autorizadas, sin inferirse de cantidades de citas.

## Contratos y migraciones

`20261021214500_customer_list_projection.sql` es aditiva: proyección de lista y dos índices. Reutiliza autorización de `list_customers` y `can_read_appointment`, límites/cursor, sin importes financieros nuevos. Próximas reservas usa el cliente de sesión, columnas explícitas y RLS. No se amplían roles ni se agregan writes comerciales.

Las 27 originales, las cuatro del PR y hardening 32 se conservan. La 33 requiere staging, preflight de índices/locks y verificación; no se aplica aquí a cloud. Enrolamiento/recovery MFA cloud, SMTP, backups, alertas, acuerdos de socios y piloto continúan como gates externos.

## Evidencia

`prepare-ux-fixtures.ts` y `capture-product.mjs`: Auth real aislado, tenant rotulado QA. Historia sintética explícita; cobros mediante RPC financieras. No se simulan APIs. El workflow captura el PR recuperado y el candidato, limpiando salida para impedir imágenes antiguas. Axe y consola/HTTP acompañan capturas; no equivalen a certificación WCAG ni prueba física de dispositivos.

Las iteraciones, comparación de rendimiento y limitaciones se registran en [UX_TEST_RESULTS.md](UX_TEST_RESULTS.md) y [UX_BEFORE_AFTER.md](UX_BEFORE_AFTER.md). Un candidato no queda validado por TypeScript ni por screenshots de otra revisión.

## Pendientes reales

La sesión del 22/10 corrigió el acceso por teclado a tablas, plegó la guía operativa y consolidó horarios/ausencias por rango. No pudo publicar por 403 del conector y timeout de Git; las capturas privadas y CI actuales siguen pendientes. Login/alta/recuperación sí se recapturaron en el build local y pasaron axe a cinco anchos.

También quedan diferencias de alcance que no deben confundirse con trabajo terminado: la serie de resultado muestra el neto y explica sus deducciones, pero todavía no ofrece series separadas de POS y comisiones; el gráfico de servicios está por servicio, no por categoría; clientes vencidos están en seguimiento, no en una serie histórica de retención. No se fabricaron esas series ni se ampliaron permisos para rellenarlas. Deben completarse y validarse antes de aceptar el rediseño integral.

Las tasas de cancelación/ausencia se derivan de cantidades autorizadas: denominador de citas resueltas del período (completadas + canceladas + no-shows), excluyendo activas y reprogramadas. Con cero/desconocido no se muestra 0%. La comparación por sucursal sólo se renderiza con más de una sucursal autorizada.
