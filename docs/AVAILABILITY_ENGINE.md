# Disponibilidad

Staff es recurso y la disponibilidad es un conjunto de intervalos. `effective_availability` calcula un `tstzmultirange` por día local: horario de sucursal + aperturas extraordinarias, intersectado con reglas/excepciones de staff, menos cierres, indisponibilidades, time off y reservas activas. Considera activación de branch/staff/asignación y capacidades para los servicios.

Una excepción disponible sustituye la regla semanal de ese día; excepciones no disponibles restan descansos. Time off con branch null aplica en todas las asignaciones del staff. Las citas del mismo recurso en cualquier local restan disponibilidad global. Reprogramación puede excluir la cita actual al validar el nuevo intervalo.

Timestamps en timestamptz; reglas semanales en hora local y weekdays 0=domingo. Fechas locales se convierten usando timezone IANA de branch; America/Asuncion es una opción configurable. No se fija país o moneda en el producto. El límite final del día respeta cambios de offset.

Las opciones de horario se generan al vuelo con paso configurable 5–60 min y la duración real server-side. Ese paso solo separa opciones de inicio: no limita capacidad a un turno por hora. Puede haber N reservas simultáneas para N barberos compatibles. La duración completa tiene que caber en un intervalo continuo.

V1 permite reservas dentro de un día local y horarios no cruzados por medianoche. Configurar jornadas nocturnas como dos intervalos; no aceptar intervalos invertidos. No se modela tiempo de viaje entre sucursales ni buffers de traslado. Evitar asignaciones consecutivas en locales distantes hasta definir una regla real.

Editar horarios/disponibilidad que invaliden citas futuras falla en transacción; primero reprogramar/cancelar. Desactivar staff/branch/asignación con citas activas futuras también falla. No se reescribe historia de citas por cambiar duración de servicio.

Una disponibilidad consultada puede cambiar antes de confirmar; la RPC y EXCLUDE son la protección final. Realtime ayuda a la operación visual, no reemplaza constraints.
