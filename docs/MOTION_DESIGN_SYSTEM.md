# Revisión de estados y navegación — 23/10/2026

Se conserva el sistema CSS nativo y sus tokens, sin añadir bibliotecas de motion. La nueva suite `npm run test:ui` comprueba reduced motion, teclado, restitución del foco y selección accesible. Los errores del modal Cobrar se verifican sobre su superficie renderizada con axe. Las capturas desactivan animaciones solo al tomar la imagen para registrar el estado final; las operaciones conservan feedback inmediato. La confirmación financiera posterior al POST permanece visible durante revalidación y no espera animaciones.

Cambiar la URL en Agenda conserva Calendario/Lista y Día/Semana; cambiar de cliente reinicia su ficha y el historial asociado. Los estados de carga/error no se animan como listas vacías verificadas. [Alcance y evidencia actuales](REVIEW_2026_10_23.md). El sistema documentado a continuación conserva su vigencia.

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
