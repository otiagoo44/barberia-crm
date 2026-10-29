# Landing y CRM — cierre del 29/10/2026

La landing https://1717barber.vercel.app está integrada con el CRM https://barberia-crm-kappa.vercel.app y Supabase productivo `tbcfhagteyqufjkmbxzz`. El catálogo de `1717-barberia/luque` devuelve 200 JSON, versión 1, PYG, ocho servicios y Esteban/Jonatan. Las lecturas públicas del 29/10 comprobaron capacidad futura de ambos, domingo cerrado, pausa de Esteban y rechazo de Rulos/Combo/Tintes e inexistentes en disponibilidad pública. No repetir onboarding ni abrir flags basándose en informes históricos.

La reserva real que el usuario confirmó manualmente el 27/10 fue reconsultada el 29/10: una referencia, una cita y un cliente vinculado, Corte con Jonatan, 19:50–20:30, Gs. 30.000, `source=public` y `booking_attribution=website`. La conversación guardada conserva la observación de esa cita en Agenda. La comparación de nombre del primer recibo esperaba otro nombre y marcó FAIL; la reconsulta coincide con el nombre ingresado y visto en Agenda. No se alteraron datos para hacer pasar la comprobación y no se repitió el POST productivo.

## Aviso manual por WhatsApp

Después de una respuesta exitosa del booking aparece **Avisar por WhatsApp**. Usa `branches[].phone` del catálogo de la sucursal confirmada, validado como teléfono internacional. Luque publica `+595983402497`, autorizado por el usuario como número de Esteban. Si el teléfono falta o es inválido, no se ofrece un destino inventado ni se impide la confirmación.

El mensaje contiene organización/sucursal, servicios elegidos, profesional solicitado si hubo elección explícita, fecha/hora del local, duración y referencia devueltas por el servidor. Si se eligió «Cualquiera disponible», no inventa el barbero finalmente asignado. No incorpora nombre, teléfono ni correo del cliente. Abrir el enlace no modifica ni duplica la reserva; el cliente decide enviar el mensaje. No hay envío automático ni integración con WhatsApp Business API. No se enviaron mensajes durante QA.

Pruebas: lint, typecheck, 32 unit tests y build; QA sobre Next optimizado con API interceptada exclusivamente en localhost. Doce combinaciones de query/viewport y seis escenarios de confirmación/conflicto a 390/1440: botón sólo tras éxito, contenido/destino correctos, ausencia sin teléfono, ningún éxito tras 409, una petición por intento, popup aislado y ningún desborde. Evidencia: [QA del botón](verification/booking-whatsapp-20261029/crm-browser-fixtures.json).

## Copias locales y publicación

Carpeta de trabajo actualizada: `C:\htdocs\tiago-systems\barberia-crm`. Remote: `https://github.com/otiagoo44/barberia-crm.git`, rama `main`. Vercel publica los commits de GitHub, no una carpeta del disco. La copia `C:\htdocs\barberia-crm` apunta al mismo repositorio, pero se encontró en `aa8b0e7`, 84 commits detrás de `cac1941`. Se conserva intacta. El worktree temporal `1717-crm-audit-20261027` sirvió para auditoría; no es el directorio recomendado de desarrollo.

## Acciones personales y operativas

- Jonatan: correo aún sin confirmar, cambio de contraseña obligatorio y cero factores MFA al 29/10. Debe completar su acceso personalmente. Su disponibilidad pública funciona y Esteban puede gestionar sus reservas.
- Esteban: correo confirmado, sin cambio de contraseña pendiente, membresía activa y un factor verificado. El usuario confirmó acceso interno en la conversación anterior.
- Mantener respaldo independiente recuperable, copia externa de backups y verificaciones de recuperación/alertas. La copia externa fue pospuesta por el usuario; no se certifica como completada.
- Validar tarifas POS y conciliación para cerrar repartos financieros definitivos; no bloquea el booking.
- Consultas previas por WhatsApp siguen siendo manuales y no crean leads. Precios/servicios de la landing se actualizan al reconstruir y desplegar.
