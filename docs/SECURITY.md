# Seguridad

## Fronteras

Auth identifica; PostgreSQL autoriza. `getUser()` verifica la sesión en servidor. Perfil activo y membresías/roles activos se consultan en vivo. No se concede acceso por `user_metadata`. Se separan staff y cuenta de usuario. No existe elevación automática al registrarse.

Todos los registros expuestos tienen RLS. Las escrituras directas de `anon` y `authenticated` están revocadas; wrappers RPC invoker llaman helpers privados con guards específicos. Funciones definer usan `search_path=''`, nombres calificados y EXECUTE explícito. No existe service_role en el runtime de la aplicación. La clave administrativa aparece únicamente en scripts de fixtures aislados locales y nunca en el navegador.

Los secretos de booking/worker son independientes, de alcance limitado, y se comparan con hashes SHA256 privados. La Data API debe exponer **solo public**. Conocer la clave publicable no permite leer clientes ni ejecutar booking sin secreto de servidor.

## HTTP y navegador

Cookies HttpOnly/SameSite=Lax, Secure en producción HTTPS. Solo localhost puede desactivar Secure explícitamente para tests HTTP. Mutaciones exigen Origin igual a APP_URL y JSON; streaming de payload limita tamaño antes de parsear. Zod valida shape, UUID, teléfono internacional, fecha, longitud y estados. PostgreSQL repite las validaciones de dominio.

CSP con nonce por request, strict-dynamic, sin scripts inline libres; style inline permitido para estilos React. HSTS, nosniff, frame DENY/frame-ancestors, Referrer-Policy y Permissions-Policy. No cache de workspace ni datos privados. Logo remoto HTTPS se carga sin referrer; usar un hosting de assets controlado por el negocio.

Booking público tiene honeypot, slugs server-side, límite de payload 4 KB, idempotencia y rate limiting en DB. El rate check se confirma en transacción separada para que errores de booking no reviertan el contador. IP se usa solo detrás de Vercel o proxy expresamente confiado; se guarda hash HMAC, no IP original. Fuera de proxy confiable se usa un bucket compartido conservador. No habilitar TRUST_PROXY con acceso directo al origin.

El rate limiting a nivel aplicación no sustituye protección perimetral contra DDoS. Auth usa los límites de Supabase; verificar SMTP, CAPTCHA y límites del proyecto antes de abrir registro público. No se inventa envío de WhatsApp: el enlace abre el chat, el worker externo queda awaiting_configuration.

## Auditoría y privacidad

Audit y status history append-only. El diff evita datos de clientes/credenciales; conserva claves cambiadas, transiciones y referencias internas. Request ID se propaga desde proxy a HTTP/RPC/audit. Logs públicos contienen mensajes genéricos; logs internos estructurados guardan código, status y request ID, sin SQL, stack, tokens o payload sensible.

Cambios de roles, branch access, configuración, horario, disponibilidad, cancelación/reprogramación, exports y acciones de plataforma generan auditoría. Bootstrap/revocación de platform_admin generan eventos globales sin organización; solo platform_admin los lee. Las acciones administrativas SQL de soporte deben limitarse a bootstrap/operación controlada, registrar incidente y evitar writes comerciales directos que eluden el dominio.

Export CSV requiere owner/manager autorizado y registra auditoría. Fórmulas potenciales se neutralizan. No hay DELETE comercial de clientes/citas: archive/deactivate/status. Anon ve catálogo mínimo y referencia de su reserva, nunca perfiles o datos de otros clientes.

Borrado/anonymization legal y export completo de portabilidad están preparados por claves/historial, pero requieren política y módulo específico; no afirmar que el archive es un borrado legal. No guardar información sensible en notas.

## Evidencia

Tests reales de PostgreSQL incluyen tenant spoofing, FKs, membresía desactivada, organization_id inmutable, permisos directos, helpers y rol/branch. Auth fixture y Auth real se reportan por separado en [VERIFICATION](VERIFICATION.md).

Advisors: las tablas privadas con RLS y cero políticas producen INFO deliberado (deny by default). No quitar RLS ni agregar políticas permisivas para silenciarlo. Índices “unused” en una base vacía no justifican eliminarlos.


## Continuación financiera — 12/10/2026

Anon sin acceso financiero. Authenticated solo SELECT por RLS; writes vía invoker→definer privado search_path vacío, actor/tenant/branch/rol/estado/idempotencia y audit. Finance sin gestión de cuentas. Snapshots de recepción no incluyen comisión global. Import limitado/ZIP expansion/XML sin entidades; no ejecutar fórmulas/macros ni usar nombres como customer identity. CSV seguro y export auditado. MFA platform_admin/owner/finance requiere configuración Auth real. Preview falla cerrado con Production o aislamiento incompleto.
