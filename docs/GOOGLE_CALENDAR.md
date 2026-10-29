# Google Calendar por profesional

Sincronización unidireccional del CRM hacia un calendario secundario propio de cada profesional. La agenda del CRM sigue siendo la autoridad: el cliente confirma allí y Google recibe una proyección posterior. La landing conserva su integración existente.

## Uso

En **Equipo → Google Calendar**, cada profesional pulsa **Conectar Google Calendar** desde su propia sesión y autoriza la misma cuenta Google que utiliza para ingresar al CRM. El propietario ve el estado del equipo, pero no puede autorizar cuentas ajenas. La cuenta debe estar activa, vinculada a un profesional de una sucursal accesible y haber cumplido las reglas de correo, contraseña inicial y MFA que corresponden a su rol.

Se crea un calendario «Nombre del negocio · Barbería OS» en esa cuenta. Se solicitan `openid`, `email` y `https://www.googleapis.com/auth/calendar.app.created`; no se leen compromisos personales. No se agregan clientes como invitados. Los eventos muestran servicio, horario/zona del local, dirección y enlace a Agenda; los contactos, nombres de clientes y notas privadas permanecen en el CRM.

Altas, cambios de horario/servicios, cambios de profesional y cancelaciones generan trabajo dentro de la misma transacción de la cita. Al cambiar de profesional se retira el evento del calendario anterior y se proyecta al nuevo si está conectado. Al conectar se incorporan los turnos futuros activos. Los eventos pueden tardar unos minutos en aparecer. Los cambios hechos directamente en Google no modifican el CRM.

## Google Cloud — alta requerida

1. Crear un proyecto del negocio, habilitar **Google Calendar API** y configurar la pantalla de consentimiento como aplicación externa si son cuentas Gmail personales.
2. Crear un cliente OAuth de tipo **Aplicación web**. Retorno productivo exacto: `https://barberia-crm-kappa.vercel.app/api/calendar/callback`. El origen es `https://barberia-crm-kappa.vercel.app`.
3. Configurar los permisos indicados y los correos de prueba durante el ensayo. Revisar la publicación de la aplicación para operación permanente: Google puede hacer expirar a los siete días los refresh tokens de aplicaciones externas en modo Testing. No declarar la conexión permanente hasta verificar el estado de publicación y el acceso real.
4. Guardar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el proyecto Vercel **barberia-crm**, exclusivamente en el servidor. No poner el secreto en la landing, en variables `NEXT_PUBLIC_*`, commits o chat. Los entornos de staging usan otro retorno y credenciales separadas.
5. Preparar `GOOGLE_CALENDAR_ENCRYPTION_KEY` (32 bytes hex) y `GOOGLE_CALENDAR_WORKER_SECRET` (aleatorio independiente). El helper genera archivos privados en `.test-data`, sin imprimir secretos:

```powershell
node scripts/configure-calendar.mjs --environment production --project-ref tbcfhagteyqufjkmbxzz --origin https://barberia-crm-kappa.vercel.app
# Después de verificar el destino y aplicar las migraciones:
node scripts/configure-calendar.mjs --environment production --project-ref tbcfhagteyqufjkmbxzz --origin https://barberia-crm-kappa.vercel.app --apply
```

Registrar los dos valores del archivo privado como secretos del mismo entorno en Vercel y redesplegar. El helper registra sólo el hash del worker en el gateway; el bearer de despacho permanece en Vault y el cron PostgreSQL llama al worker HTTPS. Nunca sustituir valores de producción por staging. No ejecutar el helper desde CI ni regenerar su archivo para rotar una instalación existente: requiere procedimiento de rotación, respaldo y reconexión.

## Fiabilidad y seguridad

- Tokens de actualización y verificadores PKCE cifrados con AES-256-GCM y contexto organización/profesional/perfil; la clave vive sólo en el servidor. Tablas privadas con RLS y sin acceso directo de clientes.
- OAuth: estado aleatorio, hash persistido por diez minutos, consumo único, vinculado a la sesión; PKCE y validación del ID token y correo de Google. Nunca registrar respuestas o errores del proveedor que pudieran contener credenciales.
- Worker con secreto dedicado y hash, cola privada separada del scheduler SQL interno, leases de tres minutos, revisión por cita, límite por lote, backoff y ocho intentos. Un cambio durante el envío queda pendiente después del acuse anterior. Los fallos de Google nunca revierten una reserva.
- ID de evento determinista por conexión/calendario/cita. Cada actualización o borrado verifica la marca privada de organización/cita. Un reintento no crea otra cita ni otro evento.
- La baja de membresía, perfil, vínculo de profesional o acceso a sucursal impide nuevas proyecciones. La revocación de Google exige volver a autorizar; los fallos transitorios se reintentan.
- **Desconectar** borra la credencial cifrada del CRM y detiene las actualizaciones. No borra eventos anteriores de Google ni revoca otras integraciones del usuario. La revocación completa se puede hacer desde la cuenta Google.
- El botón permanece deshabilitado mientras falten credenciales o transporte. Ese estado no impide operar ni reservar en el CRM.

## Validación

`npm test`, `npx tsx tests/integration/run-calendar.ts` y `npx playwright test --config tests/ui/playwright.config.ts calendar-setup.spec.ts`. El suite SQL también está integrado en `npm run test:db`. Las pruebas locales y de CI usan fixtures aisladas y respuestas controladas del proveedor; no certifican un consentimiento real de Google.

Para certificar activación: cada profesional autoriza personalmente; se comprueba un turno real consentido, actualización, profesional y cancelación permitida en el calendario correcto. No crear citas ficticias en producción ni usar la cuenta Calendar conectada a ChatGPT como credencial runtime del CRM.

Fuentes: [OAuth web de Google](https://developers.google.com/identity/protocols/oauth2/web-server), [scopes](https://developers.google.com/workspace/calendar/api/auth), [creación de calendarios](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert) y [eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events).
