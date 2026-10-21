---
version: alpha
name: Barbería OS — Workspace
colors:
  primary: "#3e4095"
  on-primary: "#ffffff"
  canvas: "#fafaf9"
  surface: "#ffffff"
  subtle: "#f5f5f8"
  foreground: "#292a35"
  muted: "#626573"
  border: "#e6e6ec"
  input: "#898b98"
  link: "#3e4095"
  success: "#246b44"
  warning: "#80591c"
  danger: "#9b332e"
  chart-primary: "#5154a0"
  chart-secondary: "#54847e"
  chart-tertiary: "#a67c36"
typography:
  heading:
    fontFamily: DM Sans Variable
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  section:
    fontFamily: DM Sans Variable
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: DM Sans Variable
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: DM Sans Variable
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
  panel: 8px
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
  subtle-panel:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.foreground}"
  border:
    backgroundColor: "{colors.border}"
  input-outline:
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
  chart-primary:
    backgroundColor: "{colors.chart-primary}"
  chart-secondary:
    backgroundColor: "{colors.chart-secondary}"
  chart-tertiary:
    backgroundColor: "{colors.chart-tertiary}"
---

## Overview

CRM operativo para recepción, profesionales y propietarios. Claro por defecto, información antes que decoración. Diales Taste: variance 2, motion 1, density 7. La autoridad visual es este archivo; `src/app/design-tokens.css` implementa sus colores. El documento anterior se conserva en `docs/design/LEGACY_DARK_DESIGN.md` como historial, sin autoridad sobre la interfaz.

Referencias de código verificadas: Twenty `d7499bf4ba11ed8c8a9392e02a42bb12b576e543` (navegación contextual y tabla), Frappe CRM `2c4b488bb858c18935a4ca27fe5fd7922cb45be5` (ContactsListView, Contact, actividades y sidebar) y [Occidental CRM](https://github.com/otiagoo44/ferreteria-crm/tree/e623009abe253838b4c495d7612e7bde3555b6c4) (DESIGN.md, styles.css, tokens.css, AppShell, common, Inquiries y RecordPanel). Inventario preciso en docs/UX_REDESIGN_REPORT.md. Se adaptan superficies continuas, tabla compacta, vistas encima de filtros y panel lateral con pestañas; no se copia código, dominio, metadata, marca ni activos. Awesome Design MD aporta su análisis completo de Notion: sólo geometría y jerarquía. Se descartan sus héroes, paletas y fuentes propietarias. UI UX Pro Max: consulta local CRM internal workspace, diales 2/1/7, UX focus modal keyboard y stack React table filtering state. Se adopta minimalismo funcional; se descartan el hero comercial, Poppins, azul/verde sugeridos y scroll reveal.

## Colors

Canvas `{colors.canvas}`, superficies `{colors.surface}` y `{colors.subtle}`. Texto `{colors.foreground}`; secundario `{colors.muted}`. El índigo `{colors.link}` identifica acciones de la aplicación. Cada organización conserva su logo y brand_color: `brandStyle` calcula texto sobre marca y un acento oscuro legible sobre blanco. No imponer una identidad no confirmada a 17:17.

## Typography

DM Sans Variable autoalojada desde @fontsource-variable/dm-sans 5.3.0, licencia SIL OFL incluida en el paquete. Inter (SIL OFL) fue evaluada por su legibilidad numérica; se elige DM Sans por su continuidad con Occidental y sus formas más abiertas. Sin fuentes privadas ni solicitudes a Google Fonts. Títulos de 28px, secciones 18px, texto 15px; inputs móviles 16px para evitar zoom involuntario. Números tabulares en importes. Nunca abreviar moneda o período de forma ambigua.

## Layout

Sidebar de 232px, grupos por intención y footer de cuenta. Cabecera compacta con organización, pantalla y local. Contenido limitado a 1600px. En móvil, menú modal y accesos inferiores; la sucursal sigue visible. Tablas/calendarios pueden desplazarse dentro de su región, nunca desbordar todo el documento. Espaciado 4/8/16/24/32px.

## Elevation & Depth

Superficies planas y bordes discretos. Sombra únicamente en overlays. Sin gradientes, glassmorphism ni fondos oscuros extensos.

## Shapes

Controles `{rounded.control}`; paneles `{rounded.panel}`. Evitar botones en forma de píldora para toda acción. Acciones principales de 44px y foco visible. Los bloques de agenda conservan altura proporcional, incluso los cortos; Lista ofrece una alternativa táctil con controles completos.

## Components

Lucide SVG coherente, iconos decorativos ocultos a lectores. Dialog nativo con nombre, Escape, foco contenido y restitución del foco. Una acción primaria por tarea; secundarias con borde y peligrosas con texto rojo. Tablas con encabezados, filas legibles y región desplazable con teclado. Charts Recharts accesibles más tabla alternativa: no depender de color ni hover. Skeleton, vacío, error y desconocido son estados distintos.

## Do's and Don'ts

Usar datos autorizados y unidades exactas. Mostrar producción estimada, ventas reconocidas, cobros y resultado por separado. No inventar tendencias sin comparación. No llenar gráficos vacíos con fixtures. Respetar reduced-motion. Mantener personalización de marca y los permisos efectivos en DB. No agregar modo oscuro hasta poder probar todos sus estados.
