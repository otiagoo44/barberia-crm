# Incorporar una barbería

## Bootstrap único de plataforma

Crear/confirmar una cuenta real mediante Auth. Un operador con acceso DB privilegiado ejecuta una vez, reemplazando el email:

```sql
insert into app_private.platform_admins(profile_id)
select id from auth.users where lower(email)=lower('admin@tu-dominio.example')
on conflict(profile_id) do nothing;
```

Verificar que insertó la cuenta correcta. Este cambio genera audit global append-only. No usar user_metadata ni permitir esta operación desde navegador. Revocación: DELETE de esa fila privada mediante operador autorizado; también se audita. Proteger acceso Supabase con MFA y mínimo personal.

## Crear organización desde la aplicación

1. El propietario crea su cuenta y confirma correo; no es necesario que sea barbero.
2. Platform admin entra en `/`, usa Crear organización, nombre, slug global único, timezone IANA, moneda ISO y email del propietario registrado.
3. Owner entra en su organización; agrega sucursales (nombre, slug por organización, dirección/teléfono/timezone).
4. Configura horarios del local/cierres, staff independiente, asignaciones por local, capacidades por servicio y reglas/excepciones/time off.
5. Crea servicios con composición/duración y luego servicios/precios/duración específica por local. Si no conoce precio, dejarlo vacío.
6. Asigna usuarios registrados en Configuración → Usuarios y permisos. Manager requiere branches explícitas. Barber necesita membresía barber y enlace `staff.profile_id`; receptionist no necesita staff.
7. Agrega datos reales de clientes o registra en su primera reserva. El teléfono exige +código de país; se deduplica solo dentro del tenant. No existe importador masivo en V1; es un siguiente flujo sobre las mismas entidades, con preview/dedup/revisión.
8. Configura branding, frecuencia de retorno/metas. Activa booking organizacional y de cada local cuando estén completos servicios/capacidades/horarios.
9. Prueba `/book/{organizationSlug}` y `/book/{organizationSlug}/{branchSlug}` con una reserva controlada, luego cancelar y revisar agenda/history/audit.

Una branch oculta el selector multi-sucursal; dos o más muestran selector. Nuevos tenants son configuración y datos, sin cambios de código.

## Secretos y despliegue

Generar BOOKING_GATEWAY_SECRET y WORKER_SECRET con 32 bytes aleatorios independientes. Calcular SHA256 localmente y guardar solo hashes mediante operador:

```sql
insert into app_private.gateway_credentials(name,secret_hash)
values ('booking','HASH_SHA256_HEX_64'),('worker','OTRO_HASH_SHA256_HEX_64')
on conflict(name) do update set secret_hash=excluded.secret_hash;
```

Los placeholders no son valores válidos: reemplazar por hashes reales sin publicar secretos. Establecer secretos originales en el backend y CRON_SECRET independiente para invocación del worker. Rotar DB hash y deployment juntos; permitir breve ventana controlada de pausa del booking durante rotación. No registrar las variables en logs.

Variables runtime: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, APP_URL HTTPS, BOOKING_GATEWAY_SECRET, WORKER_SECRET, CRON_SECRET. El prefijo publicable no convierte los otros secretos en públicos. No configurar service_role en Next.

Data API expone solo public. Realtime publication ya incluye tablas operativas/horarios requeridas por migrations. Configurar Auth site URL, redirects `/auth/callback` y recuperación, SMTP real, verificación email/límites/CAPTCHA según exposición. No usar redirects wildcard de producción.

Vercel: importar Git repo, framework Next, Node 24, variables separadas Preview/Production y dominio HTTPS. Configurar scheduler compatible antes de operar; [límites oficiales de Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing). Alternativa: scheduler externo seguro con Authorization Bearer CRON_SECRET. No poner el secreto en query string. Probar worker y queue lag antes de operar.

Preview debe usar Supabase de staging, nunca credenciales/datos reales de producción. Completar [checklist](PRODUCTION_RELEASE_CHECKLIST.md), backups/restore y evidencias antes del primer cliente.

## Onboarding de 17:17

1. Revisar config/onboarding/1717.json; confirmar correo del owner y registro Auth. No crear usuarios para Jonatan/Esteban sin correos.
2. Platform admin crea 17:17 Barbería, slug propuesto 1717-barberia, America/Asuncion, PYG, owner registrado. Confirmar slug y dominio final.
3. Crear branch Luque (slug propuesto luque), dirección Cap. Dado esq. Gobernador Irala, Luque, Paraguay. Staff Jonatan/Esteban sin profile_id; capacidades y horarios individuales confirmados.
4. Validar composición y duración. Combo/tinte no publicar hasta confirmar duración. Tinte global 250000 y mechas 180000 separados; no adoptar editorial Tinte 200000. Rulos requiere consulta previa.
5. Configurar métodos efectivo/transferencia/débito/crédito y reglas prospectivas 0/0/300/500 bps, cargo fijo cero, exclusivamente de este tenant. Crear categorías/items del manifiesto. Matriz staff+servicio cero solo con confirmación owner. Política adelantos explícita.
6. Staging: abrir caja y ensayar venta/split/gasto/adelanto/salario/liquidación/reversal. No demo cloud.
7. Dry-run XLSX definitivo, revisar cuatro anomalías/mappings y reglas históricas demostrables; unknown si no hay evidencia. Importar solo desde preview confirmado.
8. 1717barber: BARBERIA_OS_PUBLIC_URL HTTPS, BARBERIA_OS_ORGANIZATION_SLUG y BARBERIA_OS_BRANCH_SLUG reales. Build valida catálogo v1/slugs/precios/duraciones/consulta. Sin keys Supabase.
9. Completar SMTP/redirects/MFA/backup/scheduler y checklist antes del piloto.

Production: APP_URL HTTPS exacto, public Supabase URL/publishable key y BOOKING_GATEWAY_SECRET/WORKER_SECRET/CRON_SECRET privados independientes; SUPABASE_ENVIRONMENT=production. Preview: SUPABASE_ENVIRONMENT=staging, credenciales distintas, PRODUCTION_SUPABASE_PROJECT_REF y APP_URL de preview. Runtime rechaza Production. No service_role frontend ni secretos NEXT_PUBLIC.

vercel.json ya no activa cron en un plan no verificado. Plan compatible: agregar cron cada minuto. Alternativa scheduler HTTPS con Authorization Bearer CRON_SECRET, timeout/retries controlados; secreto nunca en query. No operar sin probar worker/queue lag.
