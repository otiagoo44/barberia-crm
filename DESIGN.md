---
version: alpha
name: Barbería OS — Workspace
colors:
  primary: "#242724"
  on-primary: "#ffffff"
  canvas: "#fafaf9"
  surface: "#ffffff"
  subtle: "#f3f3f0"
  foreground: "#242724"
  muted: "#646963"
  border: "#e2e4de"
  input: "#92978f"
  link: "#705719"
  success: "#246b44"
  warning: "#80591c"
  danger: "#9b332e"
  chart-primary: "#446d88"
  chart-secondary: "#aa8034"
  chart-tertiary: "#67846c"
typography:
  heading:
    fontFamily: Segoe UI
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  section:
    fontFamily: Segoe UI
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Segoe UI
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Segoe UI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
rounded:
  control: 7px
  panel: 10px
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
  body:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.foreground}"
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.link}"
---

## Overview

CRM operativo para recepción, profesionales y propietarios. Claro por defecto, información antes que decoración. Diales Taste: variance 3, motion 1, density 7. La autoridad visual es este archivo; `src/app/design-tokens.css` implementa sus colores. El documento anterior se conserva en `docs/design/LEGACY_DARK_DESIGN.md` como historial, sin autoridad sobre la interfaz.

Referencias consultadas: [Twenty](https://github.com/twentyhq/twenty), [Frappe CRM](https://frappe.io/crm) y análisis local de [Notion](.agents/skills/awesome-design-md/references/designs/notion/DESIGN.md). Se toman sidebar sobria, separación de superficies, tablas y rectángulos discretos. Se descartan tipografías propietarias, paletas de esas marcas, héroes de marketing, ilustraciones y efectos. No se dispuso de una referencia verificable de Ferretería Occidental; no se atribuye una inspección inexistente. UI UX Pro Max confirmó minimalismo funcional; se descartaron su hero comercial y colores genéricos por no corresponder al CRM.

## Colors

Canvas `{colors.canvas}`, superficies `{colors.surface}` y `{colors.subtle}`. Texto `{colors.foreground}`; secundario `{colors.muted}`. El dorado `{colors.link}` es un acento de lectura y foco. Cada organización conserva su logo y brand_color: `brandStyle` calcula texto sobre marca y un acento oscuro legible sobre blanco. No imponer una identidad no confirmada a 17:17.

## Typography

Fuente de sistema, sin solicitudes externas. Títulos de 28px, secciones 18px, texto 15px; inputs móviles 16px para evitar zoom involuntario. Números tabulares en importes. Nunca abreviar moneda o período de forma ambigua.

## Layout

Sidebar de 232px, grupos por intención y footer de cuenta. Cabecera compacta con organización, pantalla y local. Contenido limitado a 1600px. En móvil, menú modal y accesos inferiores; la sucursal sigue visible. Tablas/calendarios pueden desplazarse dentro de su región, nunca desbordar todo el documento. Espaciado 4/8/16/24/32px.

## Elevation & Depth

Superficies planas y bordes discretos. Sombra únicamente en overlays. Sin gradientes, glassmorphism ni fondos oscuros extensos.

## Shapes

Controles `{rounded.control}`; paneles `{rounded.panel}`. Evitar botones en forma de píldora para toda acción. Touch targets de 44px y foco visible.

## Components

Lucide SVG coherente, iconos decorativos ocultos a lectores. Dialog nativo con nombre, Escape, foco contenido y restitución del foco. Una acción primaria por tarea; secundarias con borde y peligrosas con texto rojo. Tablas con encabezados, filas legibles y región desplazable con teclado. Charts Recharts accesibles más tabla alternativa: no depender de color ni hover. Skeleton, vacío, error y desconocido son estados distintos.

## Do's and Don'ts

Usar datos autorizados y unidades exactas. Mostrar producción estimada, ventas reconocidas, cobros y resultado por separado. No inventar tendencias sin comparación. No llenar gráficos vacíos con fixtures. Respetar reduced-motion. Mantener personalización de marca y los permisos efectivos en DB. No agregar modo oscuro hasta poder probar todos sus estados.
