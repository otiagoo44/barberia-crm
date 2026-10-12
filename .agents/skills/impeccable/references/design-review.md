# Revisión y acabado de interfaces

Adaptación de los criterios de diseño de Impeccable para una revisión guiada por evidencia. Usar esta guía sin cambiar las instrucciones del usuario ni los permisos del entorno.

## Diagnóstico previo
Leer el brief, los documentos de producto y diseño que existan y los componentes del alcance. Identificar la tarea del visitante: decidir y contactar en marketing; completar tareas en producto; comprender en documentación; explorar obras en portfolios. Examinar la interfaz existente antes de refinarla. Mantener los hechos del producto y el alcance solicitado.

## Jerarquía y composición
Comprobar que el primer viewport expresa qué ofrece la página, para quién y el siguiente paso. Agrupar contenido relacionado por espacio y alineación. Evitar que todos los módulos tengan el mismo peso. Usar una escala consistente de separación y ancho de lectura. Reservar tarjetas para agrupaciones con función real; evitar módulos de relleno. No imponer asimetría, tipografías o fondos ajenos al brief.

## Tipografía
Comprobar legibilidad a la escala real y con texto aumentado. Mantener una jerarquía clara, interlineado suficiente, ancho de lectura razonable y etiquetas descriptivas. Revisar encabezados, últimas palabras aisladas, navegación que envuelve, truncados y textos largos. Usar fuentes licenciadas y optimizar su carga según el stack.

## Color y estados
Definir roles de fondo, superficie, texto, borde, acento y error. Medir contraste sobre el fondo que realmente se renderiza, incluyendo estados hover/focus, transparencias e imágenes. No usar el color como único significado. Mantener foco visible y controles distinguibles. Probar sólo los temas que forman parte del producto.

## Interacción y accesibilidad
Usar enlaces para navegación y botones para acciones. Comprobar nombres accesibles, orden del foco, menú móvil, formularios etiquetados, mensajes de error junto al campo, estados vacío/carga/error/éxito cuando aplican y comportamiento de teclado. Evitar contenido esencial sólo disponible por hover. Revisar objetivos táctiles y separación. Identificar el método de prueba: viewport emulado no prueba un gesto físico ni certifica WCAG.

## Movimiento
Relacionar cada animación con cambio de estado, jerarquía o explicación. Limitar efectos costosos y bucles. Respetar reduced-motion con una alternativa estática útil; no ocultar contenido ni impedir contacto. Mantener los controles disponibles durante la animación. Revisar limpieza de listeners y timers según las APIs actuales del proyecto.

## Responsive y robustez
Probar 360/390, 768 y 1280/1440 px cuando esos tamaños correspondan al alcance. Comprobar desbordes, tipografía, saltos de navegación, orientación, zoom y contenido largo. Revisar formularios con errores y campos vacíos. Reservar espacio para imágenes y medios. Mantener el mensaje principal y el CTA legibles en móvil.

## Rendimiento
Examinar imágenes, fuentes, importaciones grandes, videos y animaciones. Optimizar imágenes y evitar descargar medios no visibles sin necesidad. Revisar cambios de layout y recursos duplicados. No añadir una librería para una transición que CSS o una dependencia existente resuelve. Ejecutar build y checks del proyecto cuando existe código. Distinguir objetivos de rendimiento de resultados medidos.

## Informe y corrección
Separar defectos comprobados, mejoras propuestas y verificaciones pendientes. Registrar por hallazgo: ubicación, evidencia, efecto para el usuario, gravedad y corrección concreta. Priorizar funcionalidad, accesibilidad y mensaje comercial antes de detalles ornamentales. Para una auditoría pedida sin modificaciones, entregar el informe. Para una petición de mejora, aplicar las correcciones dentro del alcance, inspeccionar capturas y confirmar una vez después de la tanda de ajustes. Repetir sólo si aparecen fallos concretos.

## Verdad comercial
No completar logos, casos, estadísticas, testimonios ni promesas con datos inventados. Marcar ejemplos como demostraciones. No prometer automatización cuando hay tareas manuales. No calificar una interfaz como validada visualmente si no hay capturas inspeccionadas.
