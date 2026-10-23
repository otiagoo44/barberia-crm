---
version: alpha
name: Barbería OS · Negro y oro
colors:
  primary: "#D7B56D"
  on-primary: "#171715"
  canvas: "#F8F6F0"
  surface: "#FFFFFF"
  subtle: "#F1EEE6"
  foreground: "#171715"
  muted: "#67645E"
  border: "#E8E3D9"
  input: "#827A6C"
  link: "#865D16"
  sidebar: "#121313"
  on-sidebar: "#F8F6F0"
  sidebar-muted: "#BDB9AE"
  selected: "#30291C"
  success: "#246B44"
  warning: "#80591C"
  danger: "#9B332E"
  info: "#285C7E"
  disabled: "#ECE8DF"
  chart-primary: "#865D16"
  chart-secondary: "#32746A"
  chart-tertiary: "#9B6248"
  chart-quaternary: "#706084"
  chart-result: "#171715"
typography:
  heading:
    fontFamily: DM Sans Variable
    fontSize: 32px
    fontWeight: 650
    lineHeight: 1.2
  section:
    fontFamily: DM Sans Variable
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: DM Sans Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: DM Sans Variable
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: DM Sans Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  metric:
    fontFamily: DM Sans Variable
    fontSize: 32px
    fontWeight: 650
    lineHeight: 1.25
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
rounded:
  control: 10px
  panel: 14px
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  body:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.foreground}"
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.link}"
  subtle-panel:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.foreground}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.on-sidebar}"
  sidebar-secondary:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-muted}"
  navigation-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary}"
  disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.muted}"
  border:
    backgroundColor: "{colors.border}"
  input:
    backgroundColor: "{colors.input}"
  success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
  warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
  error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
  information:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.info}"
  chart-primary:
    backgroundColor: "{colors.chart-primary}"
  chart-secondary:
    backgroundColor: "{colors.chart-secondary}"
  chart-tertiary:
    backgroundColor: "{colors.chart-tertiary}"
  chart-quaternary:
    backgroundColor: "{colors.chart-quaternary}"
  chart-result:
    backgroundColor: "{colors.chart-result}"
---

## Overview

Herramienta diaria para recepción, profesionales y propietarios. Identidad propia negra/dorada: navegación oscura, contenido cálido luminoso y acciones claras. Diales Taste 4/4/5: composición funcional, movimiento perceptible y densidad media. Este documento es la autoridad canónica; src/app/design-tokens.css implementa los tokens. El PR #3 y docs/design/LEGACY_DARK_DESIGN.md son historia.

Awesome Design MD: análisis completos de Cal y Linear, adoptando jerarquía, agrupación de vistas y escalas de superficie; se descartan héroes, fuentes propietarias, paletas y marcas. No se copia Occidental/Twenty/Frappe. UI UX Pro Max: dos búsquedas de sistema, foco y stack Next.js; se adopta legibilidad y feedback. Se descartan glass, serif, scroll storytelling y GSAP. La recomendación de deduplicación de RSC no se traslada a efectos cliente sin medir.

## Colors

Canvas {colors.canvas}, superficie {colors.surface}, texto {colors.foreground} y secundario {colors.muted}. Sidebar {colors.sidebar} con texto claro. El dorado {colors.primary} tiene texto oscuro; enlaces y foco sobre blanco usan {colors.link}. Verde/rojo/ámbar/azul conservan significados, acompañados de texto.

Logo y color configurables permanecen. brandStyle calcula contraste de botón, enlace y acento sobre sidebar. No reescribir marca almacenada ni datos de 17:17. Dorado como fallback del producto. Hover no reduce contraste mediante opacidad/filtros. Disabled mantiene texto legible y se diferencia de busy con aria-busy.

## Typography

DM Sans Variable autoalojada, cuerpo 16px, controles 15–16px, tablas 15px y etiquetas 14px. Títulos 28–32px, secciones 22px, cifras 28–36px sin cortar dígitos. Números tabulares para dinero, horarios y métricas. Sin fuentes remotas en producción.

Se elige DM Sans después de comparar el listado real de Clientes con Inter Variable en cinco anchos. Ambas resultaron legibles y sin desborde de página. A 16px, la cadena monetaria ocupó 119px con DM Sans y 127px con Inter; el texto español, 347px y 366px. En escritorio DM Sans dejó visible la acción de la última columna en el mismo ancho; Inter requirió más scroll interno. La revisión a escala real en 390/1440 conservó buena lectura de teléfonos, cifras y etiquetas con DM Sans. Es una decisión de QA visual y densidad, no una prueba humana de velocidad de lectura. Evidencia y límites en FINAL_UX_AUDIT.md. Ambas fuentes OFL; Inter solo para desarrollo/QA.

## Layout

Sidebar 264px, agrupada por tarea y rol; local y búsqueda visibles. Contenido hasta 1600px, margen 32px escritorio/16px móvil. Inicio prioriza jornada/acciones; reportes conservan detalle. Modal/drawer mantienen contexto. Tablas extensas con scroll interno etiquetado y teclado. Zoom 200% permite pasar a layout móvil. Escala 4/8/16/24/32px.

## Elevation & Depth

Fondos planos, bordes cálidos, sombra tenue en hover/overlays. Z-index: cabecera 15, toast/búsqueda 40, salto 100; diálogos en top layer nativa. Sin blur ni animaciones continuas. Gráficos diferidos con tabla alternativa.

## Shapes

Controles {rounded.control}, paneles {rounded.panel}. Targets normales de al menos 44px; eventos cortos de calendario conservan duración real y vista Lista alternativa. Foco visible fuera de sticky header y navegación inferior.

## Components

Botones: hover 160ms, active 110ms/translateY(1px), foco 2px, busy inmediato con texto/indicador. Success solo después de respuesta real. Modal/drawer 200–220ms transform/opacity, Escape, foco contenido y restitución. Tabs/menús/filtros indican estado ARIA. Toast/Notice explican qué ocurrió y próximo paso. Reduced-motion elimina desplazamientos/animación conservando contenido y feedback. Ver MOTION_DESIGN_SYSTEM.md.

Puesta en marcha comprueba cuenta/rol, sucursal, catálogo, profesionales, horarios diarios, medios, reservas y seguridad con fuentes autorizadas. Lo no observable es «Verificación manual», nunca «Listo». No activar booking/distribuciones desde el diagnóstico.

## Do's and Don'ts

Preservar RLS, MFA AAL2, sesión viva, roles, idempotencia, dinero exacto y transacciones. Sin pagos optimistas. Invalidar lecturas tras writes; no mostrar finanzas previas como actuales. No persistir datos comerciales en localStorage. Respetar teclado y reduced-motion. No inventar disponibilidad, precios, alertas entregadas ni backups. No editar la landing ni el contrato público; documentar sincronización visual posterior.
