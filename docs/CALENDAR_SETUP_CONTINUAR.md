# Continuación — Calendar y puesta en marcha

Objetivo autorizado: Google Calendar por profesional y corregir indicadores obsoletos de Puesta en marcha. Rama `feat/google-calendar-and-setup-status`, carpeta canónica `C:\htdocs\tiago-systems\barberia-crm`. No usar el clon antiguo de `C:\htdocs\barberia-crm`.

Implementado: OAuth Google por cuenta, calendario secundario de la app, cifrado, cola privada, worker y cron despachador opcional, altas/cambios/cancelaciones/reasignaciones, UI en Equipo y reintentos. Documentación operativa: [GOOGLE_CALENDAR.md](GOOGLE_CALENDAR.md).

Puesta en marcha: deja de marcar reservas como «manual» incondicionalmente; consulta catálogo/disponibilidad públicos y cita pública existente. Separa configuración de profesionales de sus accesos personales. MFA se evalúa según la política real (un factor para roles que lo requieren); el segundo autenticador/recuperación permanece como control independiente. El resumen distingue comprobadas, pendientes y manuales.

Lectura productiva del 29/10: ambos flags activos, ocho servicios configurados, dos reservas públicas existentes, Esteban con correo confirmado/contraseña sustituida/un factor; Jonatan con correo sin confirmar, contraseña inicial pendiente y cero factores. No se fabricó evidencia ni se modificaron cuentas personales.

Validación ejecutada hasta el checkpoint: 40 unit tests (incluyendo ocho casos nuevos de Calendar y diagnóstico); lint/typecheck y build Next aprobados; migraciones y contratos SQL aislados aprobados; UI 390/1440 aprobada con Axe y consola limpia. Repetir sólo si nuevos cambios/fallos lo justifican. Revisar estado del PR/CI/deployment antes de publicar para no duplicarlos.

Google Cloud aún no existe: el usuario confirmó que hay que crearlo. El navegador de esta sesión devolvió `Computer Use was not approved to use Google Chrome`; después de habilitar/reinstalar y enviar @Chrome, continúa `The browser access host is unavailable` y el listado de ventanas dio timeout. No se eludieron permisos ni se leyeron cookies/sesiones del navegador. El usuario está intentando restablecer el conector. Al recuperar acceso, crear proyecto Google Cloud/Calendar API/OAuth web con el retorno documentado, sin aceptar cargos o contratos nuevos sin la acción correspondiente del usuario. No inventar OAuth ni declarar activado hasta que cada profesional autorice su cuenta.

No se crearon eventos reales ni mensajes a clientes. El código permanece inactivo para Google mientras falten credenciales y transporte.
