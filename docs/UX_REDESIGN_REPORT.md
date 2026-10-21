# Rediseño de Barbería OS

Revisión del 20/10/2026. Canon: [DESIGN.md](../DESIGN.md). Antecedente íntegro: [diseño oscuro anterior](design/LEGACY_DARK_DESIGN.md). Skills locales aplicados: Awesome Design MD, Google DESIGN.md, Impeccable, Taste y UI UX Pro Max; revisión React según vercel:react-best-practices. No se instaló ni copió backend de los referentes.

## Hallazgos y cambios

| Hallazgo | Criticidad | Rutas / corrección | Verificación |
|---|---|---|---|
| Tema oscuro rígido, acento cian y trece enlaces sin agrupación | Alta UX | globals.css, design-tokens.css, shell.tsx: tema claro, grupos por intención, SVG Lucide y contexto organización/local | Capturas antes/después y viewports |
| Controles redondos y paneles de igual peso | Media | Jerarquía de acción, bordes/radios discretos, tipografía y espaciado común | Revisión visual real pendiente de CI |
| Home orientado a métricas, sin próxima atención | Alta UX | day-overview.tsx: jornada de la sucursal, próxima cita real y enlaces directos; 4 KPIs principales | Operaciones Auth y screenshots |
| Datos sin visualización y capacidad desconocida agregada parcialmente | Alta | data-chart.tsx y migración reporting_health: series autorizadas, gaps desconocidos, tabla alternativa, sin tendencias inventadas | chart-values.test.ts, product-release.ts y tests DB |
| Marca calculada para fondo oscuro | Alta accesibilidad | branding.ts oscurece únicamente el acento de lectura para contraste sobre blanco; preserva brand_color | Test de contraste con blanco/negro/dorado/cian/rojo |
| Disponibilidad diaria poco visual y guardado de un bloque por vez | Alta operativa | daily-availability.tsx, save_daily_blocks: vista por profesional, descansos, guardado atómico, copia explícita y horas del motor real | Contratos DB y Playwright |
| Catálogo/equipo presentados solo como tarjetas | Media | record-manager.tsx: tablas para staff/servicios/locales, filtro local y categorías sin perder editor | Tests navegador y teclado |
| Falta nombre accesible en dialog | Alta accesibilidad | ui.tsx: aria-labelledby y dialog nativo; mantiene trap/Escape/foco | UX release Playwright |
| Error de salida sin feedback | Media | auth-form.tsx muestra error y bloquea doble click | Tests/inspección |
| Finanzas confundía semántica de primera métrica | Media | Ventas registradas netas, cobros independientes y chart por fecha correspondiente | Contratos financieros |

## Referencias

[Twenty](https://github.com/twentyhq/twenty): sidebar y claridad de navegación. [Frappe CRM](https://github.com/frappe/crm), [producto](https://frappe.io/crm): organización de listas/detalles y acciones. Análisis local Notion: superficies neutras y controles rectangulares; descartados marca, paleta y fuentes propietarias. UI UX Pro Max sugirió Swiss/minimalismo; se descartaron hero de marketing y animaciones sin utilidad. No hubo URL/archivo verificable de Ferretería Occidental; no se afirma haberlo inspeccionado.

## Evidencia visual

Capturas reales de login anterior disponibles en `docs/verification/ux/before/`. El workflow `visual-baseline` instala el main de referencia y ejecuta Auth real en Supabase aislado para fotografiar las nueve pantallas a 360/390/768/1024/1440. `supabase-e2e` captura las mismas rutas en la rama nueva. Los archivos se incorporan tras recuperar artefactos y revisarlos; no se presentan mocks como flujo completo.

## Límites

No modo oscuro paralelo; no drag-and-drop de citas. Se conservan calendario por día/semana/profesional y acciones transaccionales. Filtro de catálogo actúa sobre la página cargada y lo indica explícitamente. La estimación operativa no se convierte en beneficio ni en caja. No hay porcentajes de crecimiento sin período comparable. Se verifican teclado, foco y tamaños emulados; esto no es certificación WCAG ni prueba física en dispositivos.
