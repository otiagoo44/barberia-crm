# Publicación en Vercel

Repositorio: `otiagoo44/barberia-crm`, rama de producción `main`, raíz del repositorio. Proyecto descubierto: `barberia-crm` (`prj_5T3VMAuA8qXr3G6zzDSc94pHMpCQ`), equipo `team_fHImRjkE8m0NyoHDOZHtaNH1`. Next.js, Node 24.x, instalación `npm ci`, build `npm run build`, output automático. `vercel.json` conserva esa selección de framework/build.

## Variables por entorno

Configurar las variables en Settings → Environment Variables antes del primer deploy. No copiar `.env.local` al repositorio ni a la landing.

| Variable | Production | Preview |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://tbcfhagteyqufjkmbxzz.supabase.co | URL canónica de otro proyecto de staging |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clave publicable de producción | Clave publicable de staging |
| APP_URL | https://barberia-crm-kappa.vercel.app | Origen HTTPS exacto del preview de prueba |
| SUPABASE_ENVIRONMENT | production | staging |
| PRODUCTION_SUPABASE_PROJECT_REF | tbcfhagteyqufjkmbxzz | tbcfhagteyqufjkmbxzz |
| BOOKING_GATEWAY_SECRET | Secreto privado de booking de producción | Secreto independiente de staging |
| WORKER_SECRET | Secreto privado de worker de producción | Secreto independiente de staging |
| CRON_SECRET | Secreto privado del scheduler | Secreto independiente de staging |

Los tres secretos deben ser distintos y de al menos 32 caracteres aleatorios. Registrar únicamente SHA256 de booking/worker en `app_private.gateway_credentials` de su entorno; el secreto original permanece en el gestor de variables. No requiere service_role ni contraseña PostgreSQL en Vercel. Las variables `NEXT_PUBLIC_*` contienen solamente configuración publicable.

`prebuild` ejecuta `scripts/validate-deployment.mjs`. Un build de Vercel falla si faltan variables, el origen no es HTTPS, los secretos son cortos/repetidos o no coincide la base con el entorno. Preview rechaza producción y permanece sin habilitar hasta disponer de staging. Los builds locales y el CI con Supabase localhost no requieren variables de producción.

## Dominio y Auth

La API de dominios confirmó `https://barberia-crm-kappa.vercel.app` como dominio verificado del proyecto. Production quedó configurado con ese APP_URL. `https://barberia-crm.vercel.app` era una URL prevista de la auditoría anterior y corresponde a otro contenido; usar el dominio con `-kappa` también en la landing. Si se agrega un dominio propio, actualizar APP_URL y Auth juntos.

En Supabase Auth, establecer Site URL al mismo origen y autorizar exactamente `/auth/callback` y el flujo de recuperación utilizado por la aplicación. Configurar SMTP y probar confirmación/recuperación. Conservar Deployment Protection según la política del equipo; los previews protegidos se inspeccionan con acceso autorizado.

## Scheduler

La API del equipo confirmó plan **Hobby** el 15/10/2026. `vercel.json` no habilita cron por minuto porque ese plan no lo permite. Para operación diaria se necesita un scheduler externo verificado que invoque `GET /api/jobs` cada minuto con `Authorization: Bearer CRON_SECRET`. El handler tiene presupuesto de 60 segundos y procesa hasta diez jobs por llamada; comprobar retries y queue lag con carga real. [Límites oficiales](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Si el plan permite cron por minuto, agregar `crons: [{"path":"/api/jobs","schedule":"* * * * *"}]` a `vercel.json`; Vercel envía el Bearer a partir de CRON_SECRET. Si el plan no lo permite, usar un scheduler externo HTTPS con el mismo header. Nunca poner secretos en la URL. Un cron diario no satisface el funcionamiento oportuno de recordatorios/cola.

## Comprobación y publicación

1. Confirmar CI del commit de `main`, incluidas las pruebas de Supabase Auth y restore local. No contar tests omitidos como aprobados.
2. Confirmar que el historial de migrations de Supabase coincide con los archivos del repositorio y que advisors no tiene errores/advertencias sin resolver.
3. Las nueve variables de Production están configuradas; los tres secretos son privados. Preview tiene SUPABASE_ENVIRONMENT y PRODUCTION_SUPABASE_PROJECT_REF, pero falla cerrado hasta completar una base/secretos de staging propios.
4. La API confirmó la conexión GitHub `otiagoo44/barberia-crm` y Production Branch `main`. El proyecto usa Node 24.x, `npm ci` y `npm run build`. Revisar dominio y APP_URL si cambia esa conexión.
5. Publicar el commit verificado. Comprobar `/api/health` y `/api/health/ready` (este último debe devolver `ready: true`), login y recuperación. Un origen ajeno debe rechazarse.
6. Probar el worker con el Bearer correcto y verificar que uno incorrecto devuelve 403. No marcar integraciones externas como entregadas sin proveedor.
7. Seguir [el onboarding de 17:17](NEW_ORGANIZATION_ONBOARDING.md) y [la checklist](PRODUCTION_RELEASE_CHECKLIST.md) antes del piloto: propietario confirmado, horarios/capacidades/precios, backup y restore, SMTP y scheduler.

El push a `main` conserva el CI y no equivale a una habilitación del negocio. No ejecutar reset, seed demo o importación histórica automática en la base remota.
