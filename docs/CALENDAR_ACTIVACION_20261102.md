# Calendar: auditoría y activación por profesional

Auditoría del 2/11/2026, antes de modificar código: main `71b59fc`, producción READY `dpl_FkkZMwyKennc7rvuL27gPbMZADab`. Staging y producción mantienen las 46 migraciones, RLS privado, cero funciones públicas security definer y cron Calendar activo. Producción tiene transporte configurado, cero conexiones y cero trabajos. El worker autenticado devuelve `configured:false`; sin secreto devuelve 403. No se regeneraron ni rotaron claves.

Vercel producción tiene `GOOGLE_CALENDAR_ENCRYPTION_KEY` y `GOOGLE_CALENDAR_WORKER_SECRET` como sensitive. No tiene `GOOGLE_CLIENT_ID` ni `GOOGLE_CLIENT_SECRET`. Esto demuestra que falta configurar OAuth en el despliegue; no demuestra por sí solo si alguien creó un proyecto en Google Cloud fuera de esta sesión. El último dato del usuario era que no existía. No se inspeccionaron contraseñas, sesiones de navegador ni tokens personales.

## Checklist exacto

- [ ] Buscar primero el proyecto del negocio en Google Cloud. Reutilizarlo si existe; no crear otro cliente ni rotar secretos a ciegas.
- [ ] Habilitar Google Calendar API y revisar consentimiento, audiencia y publicación. Cliente OAuth de tipo Aplicación web, con retorno exacto `https://barberia-crm-kappa.vercel.app/api/calendar/callback` y origen `https://barberia-crm-kappa.vercel.app`.
- [ ] Permisos: `openid`, `email`, `https://www.googleapis.com/auth/calendar.app.created`. No ampliar a calendarios personales completos. Durante Testing agregar los correos reales de las cuentas de Esteban y Jonatan como usuarios de prueba. Revisar publicación antes de declararlo permanente: el modo Testing de aplicaciones externas con este alcance puede expirar refresh tokens a los siete días.
- [ ] Guardar Client ID y Client Secret en Vercel, proyecto barberia-crm, producción, sólo servidor. Conservar intactas las dos claves Calendar existentes, el hash gateway y el secreto Vault. Nunca copiar secretos a la landing ni al chat.
- [ ] Redesplegar y verificar health/ready y que Equipo muestre la integración configurada. Verificar que cron siga activo; no lanzar un worker con un secreto distinto.
- [ ] Esteban: ingresar desde su propia sesión, comprobar su vínculo de profesional y correo Google coincidente con el del CRM. Equipo → Google Calendar → Conectar. Revisar permisos y autorizar personalmente. Confirmar calendario secundario del negocio y estado conectado.
- [ ] Jonatan: confirmar correo, cambiar contraseña inicial y cumplir MFA si aún sigue pendiente; comprobar membresía/vínculo activos. Luego repetir Conectar desde su propia cuenta Google coincidente. El owner no puede autorizar por él.
- [ ] Verificar en cada dispositivo que el calendario secundario esté visible y tenga la zona de Luque. La conexión incorpora las citas futuras activas del profesional.
- [ ] Con una cita real expresamente consentida, anotar referencia, profesional y horario; esperar el despacho y comprobar un único evento en la cuenta correcta. No crear citas de prueba en producción.
- [ ] Sólo con autorización para modificar esa visita, reprogramarla en el CRM y comprobar que el mismo evento cambie de horario sin duplicarse. Si cambia de profesional, comprobar retiro del calendario anterior y presencia en el nuevo conectado.
- [ ] Sólo con autorización para cancelar esa visita, cancelarla en el CRM y comprobar retiro del evento. Si la visita debe mantenerse, hacer esta prueba exclusivamente en staging con OAuth de staging y cuentas de prueba.
- [ ] Comprobar reintento/revocación en staging: tras un fallo temporal la cola reintenta; tras revocación solicita reconexión. No revocar una cuenta operativa para una prueba no consentida.

## Son tres funciones distintas

**Sincronización:** esta implementación proyecta altas, cambios y cancelaciones CRM → Calendar. El CRM manda; editar Google no actualiza la cita. No agrega clientes como asistentes ni comparte sus nombres, contactos o notas.

**Recordatorios:** avisan antes del horario de un evento. Cada profesional debe revisar los recordatorios del calendario y los permisos de notificaciones del dispositivo. Crear un evento no certifica que ese aviso haya llegado.

**Avisos inmediatos:** enterarse al instante de una nueva reserva es otro flujo. Esta entrega no implementa un envío automático de WhatsApp, email o push del CRM. Calendar tiene opciones de notificaciones de cambios por usuario que deben configurarse y comprobarse por separado. El botón «Avisar por WhatsApp» es manual y opcional; no reserva otra vez.

Fuentes: [recordatorios y notificaciones](https://developers.google.com/workspace/calendar/api/concepts/reminders), [OAuth y expiración](https://developers.google.com/identity/protocols/oauth2#expiration). Implementación y seguridad: [GOOGLE_CALENDAR.md](GOOGLE_CALENDAR.md).
