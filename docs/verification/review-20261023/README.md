# Evidencia de revisión del 23/10/2026

Base local y remota `99a4532637a2902504a994e39464206b1c0c1526`. Esta carpeta conserva la evidencia nueva; `../definitive/` conserva la del rediseño anterior. Los datos de imágenes son sintéticos, identificados como QA.

| Evidencia | Alcance |
|---|---|
| inventory-before.json / inventory-after.json | Inventario de trabajo con hashes; dependencias/suites heredadas identificadas. No representa cobertura ni nueva lectura humana de cada línea. |
| ui-before.json | Nueve fallos reproducidos en los componentes de la base, anteriores a las correcciones. |
| ui-after.json | Suite nueva después de las correcciones, con diez escenarios. Transporte/router sintéticos, componentes React reales; no sustituye Auth/RLS. |
| before/ y after/ | Capturas de navegación, carga, error financiero y cinco anchos. Las capturas finales desactivan animaciones al tomar la imagen para inspeccionar el estado final. |
| before/interaction-samples.json / after/interaction-samples.json | Diez interacciones por fase, requests y percentiles. Transporte sintético y sobrecoste Playwright; no son latencias API cloud ni INP real. |
| bundle-before.json / bundle-after.json | Bytes de todos los chunks de dos builds locales de producción. No es peso por ruta. |
| load-results.json / migration-upgrade.json | Nueva ejecución SQL aislada. No sobrescribe evidencia histórica y no utiliza bases externas. |
| design-lint.json / design-diff.json / design-export.css | CLI Google fijada; el export es evidencia, no una segunda hoja de tokens productiva. |

Comparación puntual de Cobrar: [antes](before/checkout-checkout-error-390.png) ofrecía preparar otra venta tras un fallo de lectura; [después](after/checkout-checkout-error-390.png) informa el fallo y permite reintentar. [Ficha correcta](after/customer-navigation-1440.png), [Agenda móvil](after/agenda-390.png) y [carga](after/agenda-loading-1440.png).

Se inspeccionan a escala real esas vistas, el estado de Inicio y la ampliación. Las hojas de contacto del rediseño integrado se revisan como evidencia histórica de los módulos sin cambios: no se presentan como nuevas capturas de esta sesión. La verificación completa privada con Supabase real queda a cargo de la CI del nuevo SHA. Ninguna captura se toma de datos productivos.
