---
name: google-design-md
description: "Crea, migra y valida DESIGN.md con la especificación de Google, tokens YAML, contraste y exportación a CSS/Tailwind. Úsala para documentar una identidad visual coherente o revisar cambios del sistema de diseño."
---

# Google DESIGN.md

Leer [coordinación](references/coordination.md), la [especificación oficial](references/spec.md) y la parte necesaria de [CLI](references/cli-reference.md). Esta es una adaptación para Codex del formato y herramienta de Google, no una skill oficial de Google.

Leer el DESIGN.md existente antes de editar. Para un sistema nuevo, definir YAML con name, colors, typography, spacing, rounded y components; explicar las decisiones en las secciones Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components y Do's and Don'ts en ese orden. Referenciar tokens con `{colors.primary}` y no duplicar valores contradictorios en CSS.

Resolver rutas desde la carpeta real de esta skill (`<skill-dir>`), nunca asumir el cwd ni una carpeta skill fija:

```bash
python3 <skill-dir>/scripts/designmd.py lint /ruta/proyecto/DESIGN.md
python3 <skill-dir>/scripts/designmd.py diff /ruta/antes.md /ruta/despues.md
python3 <skill-dir>/scripts/designmd.py export --format css-tailwind /ruta/proyecto/DESIGN.md
```

El wrapper ejecuta la CLI oficial fijada en 0.4.0. La CLI oficial está incluida y requiere sólo Node >=18; funciona sin descargar paquetes y no instala dependencias dentro del proyecto. Si no está disponible, informar que no se ejecutó el lint oficial y continuar con revisión manual claramente identificada.

Corregir referencias rotas y pares de contraste problemáticos. Leer el JSON: salida 0 no significa cero advertencias. El lint sólo cubre tokens, estructura y pares declarados; no certifica accesibilidad de la web renderizada, imágenes, transparencias, estados ni overlays. Confirmar éstos en la interfaz real. Exportar el formato que corresponda al stack detectado y revisar el diff antes de sustituir CSS.

Conservar licencia y procedencia. El formato upstream es alpha; mantener la versión fijada hasta verificar una actualización.
