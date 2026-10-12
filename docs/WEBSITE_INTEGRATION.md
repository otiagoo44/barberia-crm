# Contrato real entre 17:17 y Barbería OS

17:17 landing → /reservar → booking público de barberia-crm → PostgreSQL/Supabase.

## Fuente de verdad

El contrato se auditó en el código del CRM, no en documentación de calendarios externos. `src/app/book/[organization]/[[...branch]]/page.tsx` resuelve la ruta pública; `src/features/booking/public-booking.tsx` consume el catálogo, disponibilidad y booking. `src/app/api/public/[resource]/route.ts` valida entradas, aplica rate limiting y llama a RPC usando credenciales confinadas al servidor del CRM.

| Recurso | Contrato |
| --- | --- |
| GET /api/public/catalog | organization y branch públicos. Respuesta directa JSON, sin envelope; org slug, moneda, sucursales y servicios/staff por slug. |
| GET /api/public/availability | organization, branch, service repetido, date y staff opcional. Duración/capacidad desde PostgreSQL. |
| POST /api/public/booking | organization, branch, services, staff, starts_at, customer, key, website honeypot y source opcional. Origen same-origin del CRM. No acepta precio/duración/tenant UUID. |
| /book/{organization}/{branch?} | Página nativa. service opcional como slug público; source=website opcional. |

Los eventos históricos permanecen append-only: se agrega booking.attributed, sin modificar appointment.created.

El catálogo incorpora `website_booking_version: 1`, `website_category` y `consultation_required`. La categoría asignada explícitamente en el CRM vincula cada sección editorial de la landing sin mapear por texto visible; no sustituye al slug de reserva. El build rechaza un contrato antiguo o una sucursal incorrecta. No utiliza endpoints internos ni public RPC directamente desde el navegador de la landing.

## Preselección

La ruta valida sintaxis y cardinalidad del parámetro service, y el selector lo verifica contra los servicios del public_catalog de esa sucursal. Servicios desconocidos, repetidos o de consulta previa no se preseleccionan. Los servicios compuestos utilizan las mismas reglas del ServicePicker existente y requieren su base pública reservable. Agendar general no incluye service. Cambiar de sucursal limpia la selección. La API/DB valida nuevamente todo: el query param nunca decide el precio, duración, staff compatible, permisos o tenant.

## Rulos

La landing conserva consultationRequired=true y el CTA de WhatsApp. El CRM conserva la misma regla mediante consultation_required y website_category=rulos. La constraint evita desactivarla por error; resolve_public_request bloquea disponibilidad y booking públicos incluso con requests construidos manualmente. El motor interno autorizado sigue disponible para recepción tras evaluación. No se depende de esconder un checkbox como única defensa.

## Atribución

La landing agrega únicamente source=website. El servidor acepta el enum website o ausencia; rechaza otros valores y propiedades desconocidas. La DB revalida el valor, registra appointments.booking_attribution y attribution en un domain event booking.attributed dentro de la misma transacción. appointments.source sigue siendo public: se conservan los controles de habilitación y lead time del motor público. No sustituir source por website en el motor interno.

La atribución no contiene IP, campaña libre, PII ni secretos. El ledger privado enlaza organization/key con la atribución y rechaza cambiarla al reutilizar una clave de idempotencia. Reintentos devuelven la misma reserva sin duplicar audit/event. Los clientes previos que llaman a la RPC de nueve argumentos siguen funcionando sin atribución. La RPC nueva tiene diez argumentos, sin default para evitar ambigüedad de overload en PostgREST.

## Catálogo y puesta en marcha

Ningún tenant o servicio productivo existe en la base auditada. Se conserva el contenido confirmado de Corte/Barba/Perfilado/Lavado/Rulos durante la puesta en marcha, con WhatsApp. El precio/duración dudosos de Tinte quedan sin publicar. Una vez activado el catálogo, sólo se muestran servicios clasificados y activos de esa sucursal y sus precios/duraciones efectivos. Global y Mechas se muestran por separado si ambos existen bajo categoría tinte. La disponibilidad no se duplica en la landing.

La URL pública prevista es https://barberia-crm.vercel.app. Variables públicas: BARBERIA_OS_PUBLIC_URL, BARBERIA_OS_ORGANIZATION_SLUG, BARBERIA_OS_BRANCH_SLUG; SITE_URL es opcional y pertenece sólo al SEO de la landing. Los slugs siguen pendientes hasta que el CRM los configure. [Activación](BOOKING_SETUP.md) y [auditoría](BOOKING_AUDIT.md).

La migración se entrega en el repositorio del CRM; no se aplicó a ninguna base remota. La organización 17:17 debe crearse desde configuración real, sin copiar fixtures.
