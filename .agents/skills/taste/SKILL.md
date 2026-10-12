---
name: taste
description: "Diseña o rediseña landing pages y portfolios con composición propia, tipografía, ritmo, densidad y animaciones contextualizadas, a partir de Taste Skill. Úsala para evitar interfaces repetitivas sin sacrificar conversión, marca o accesibilidad."
---

# Taste

Leer [coordinación](references/coordination.md). Usar la guía principal de Taste (design-taste-frontend), no la variante gpt-taste que pide simular verificaciones. Consultar [índice](references/index.md) y leer las secciones pertinentes: brief/diales para dirección, arquitectura y layout para implementación, motion para animación, protocolo de rediseño para sitios existentes y preflight para entregar.

Declarar en una frase la lectura de público, propósito y lenguaje visual. Elegir composición por contenido y decisión del visitante. Ajustar diales explícitamente al brief: como punto de partida B2B para Tiago Systems, variance 6, motion 4, density 3; no convertirlos en una fórmula universal.

Aplicar el manual como heurísticas subordinadas al brief: no prohibir tipografías, SVG originales, hero centrado, componentes ni sistemas válidos sólo para parecer diferente. Mantener el stack existente. No agregar librerías por cumplir una lista. Repetir un CTA coherente donde ayude al visitante; evitar varios nombres para el mismo propósito.

Definir una escala de espaciado y radios, jerarquía tipográfica legible, variedad de composición motivada por contenido y una demostración del producto como evidencia. Evitar rellenar con tarjetas repetidas o gráficos sin función. Usar imágenes reales autorizadas o datos demo marcados. No generar resultados comerciales ficticios ni depender de fotos aleatorias.

Usar CSS/Motion/GSAP según la necesidad y dependencias existentes, no las tres a la vez. Mantener el contenido visible sin JS; respetar reduced-motion, teclado y touch. Evitar scroll hijacking, cursores que sustituyen affordances y animaciones que bloquean CTA. Usar Remotion sólo para demos o piezas audiovisuales que lo requieran.

Si una sección menciona una biblioteca de bloques que no existe en el proyecto, tratarla como esquema opcional; no afirmar que hay bloques instalados. Verificar cualquier API de framework o librería contra documentación primaria vigente al implementar. Probar comportamiento y capturas reales; no usar randomización simulada ni afirmar mediciones que no se ejecutaron.

Conservar licencia MIT y procedencia. La adaptación divide el manual largo para lectura selectiva; no garantiza un resultado visual sin inspeccionar el sitio concreto.
