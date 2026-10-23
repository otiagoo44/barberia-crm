# Movimiento de Barbería OS

DESIGN.md define identidad y tokens; `src/app/motion.css` implementa el movimiento con CSS nativo. Sin biblioteca adicional.

| Interacción | Duración | Respuesta |
|---|---|---|
| Pulsación | 110 ms | translateY(1px), scale(.98), sin esperar la animación para ejecutar |
| Hover/foco de superficie | 160 ms | Color, borde y sombra; navegación se desplaza 2px |
| Estado, toast, vacío, menú, página | 180 ms | Opacity y translateY(5px), sin ocultar contenido hasta un timer |
| Modal/drawer | 220 ms | Opacity/transform; drawer recorre 20px |
| Busy | Inmediato | aria-busy, control disabled y señal visual de proceso; el resultado depende del servidor |
| Success/error | Después de respuesta | Notice con texto, icono semántico y estado accesible; sin sacudidas |

Se conserva el diálogo nativo, foco contenido, Escape y restitución. Las transiciones no cambian permisos, importes, estados de pago ni momento de ejecución. No hay actualizaciones optimistas financieras. Los gráficos conservan geometría y datos sin reconstrucciones animadas por filtro; no se agrega animación repetida a cada punto.

Reduced-motion desactiva animaciones, transiciones, desplazamientos y scroll suave en elementos/pseudoelementos. Mantiene texto, busy, error, éxito y controles. El spinner queda estático y aria-busy conserva el significado. La navegación sigue operable por teclado durante la entrada.

Checks del candidato: Playwright verifica clic/transform, foco, Escape, reduced-motion, estados y cinco anchos. El render local o una regla CSS no constituyen por sí solos la verificación final: los resultados exactos se registran en RELEASE_ACCEPTANCE.md.
