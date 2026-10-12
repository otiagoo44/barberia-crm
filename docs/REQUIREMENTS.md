# Requisitos recibidos

Estado: en consolidación mientras el usuario envía la especificación. Este documento no afirma que las funcionalidades estén implementadas.

## Producto y límites

Sistema operativo para barberías: clientes, reservas, agenda, disponibilidad, staff, sucursales, servicios, capacidad, walk-ins, no-shows, rendimiento, metas, retención, rebooking y actividad operacional. Debe ser la fuente de verdad para negocios que comienzan con WhatsApp, memoria y Google Sheets.

Primera versión funcional para clientes reales; sin datos de negocio hardcodeados. Una instalación y un proyecto Supabase para muchas organizaciones con una o más sucursales. La incorporación de negocios debe requerir configuración y datos, no cambios de código.

Contabilidad completa, caja, liquidaciones y comisiones están fuera del alcance inicial. Preparar extensiones para payments, cash_sessions, expenses, commission_rules, commission_entries y settlements; definir sus reglas posteriormente a partir del Google Sheet real del primer cliente.

## Datos y seguridad

- Identificadores UUID; `organization_id` en entidades comerciales y `branch_id` donde exista una ubicación específica.
- Claves foráneas compuestas para impedir referencias entre tenants; `organization_id` inmutable salvo procesos administrativos explícitos.
- Organización representa empresa/marca; sucursal representa un local físico. Configuración de dirección, teléfono, zona horaria, horarios, servicios, precios, barberos y disponibilidad por sucursal.
- Timestamps `timestamptz`; soportar America/Asuncion sin limitar el producto a Paraguay.
- Clientes pertenecen a la organización y pueden visitar distintas sucursales. Teléfono normalizado con deduplicación por organización, nunca unicidad global.
- Auth user y staff son entidades separadas. Un barbero puede no tener usuario; una recepcionista puede tener usuario sin ser barbera. Staff puede trabajar en varias sucursales.
- Roles iniciales: platform_admin, organization_owner, manager, receptionist, barber; preparar finance para una etapa futura.
- Owner accede a toda su organización. Manager únicamente a sucursales asignadas y operaciones autorizadas. Receptionist gestiona operaciones diarias. Barber accede a su agenda, servicios, clientes relevantes, métricas y disponibilidad propia cuando se permita.
- RLS en todas las tablas expuestas, permisos por objeto y registro, least privilege y deny by default. No depender de filtros o restricciones visuales.
- Helpers privilegiados en `app_private`: identidad, membresía, roles, acceso a sucursales y resolución segura de organización. SECURITY DEFINER con `search_path=''`, nombres calificados y EXECUTE explícito, fuera de esquemas expuestos.
- No exponer service_role, contraseña postgres, JWT secret, access tokens ni credenciales privadas en el navegador.
- Cabeceras CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy y protección de frames donde el stack lo permita.

## Entidades mínimas a evaluar

organizations, organization_settings; branches, branch_settings, branch_business_hours, branch_closures; profiles, organization_memberships, membership_branch_access; staff, staff_branch_assignments, staff_service_capabilities; services, branch_services y composición cuando haga falta; staff_availability_rules, staff_availability_exceptions, staff_time_off; customers, customer_notes, customer_preferences, customer_tags; appointments, appointment_services, appointment_status_history; walk_in_entries; visitas/historial normalizado equivalente; goals; tareas/actividades útiles; notifications, automation_jobs, audit_logs y mecanismo de idempotencia. Evitar duplicación y sobreingeniería.

## Auditoría

Logs append-only: UUID, organización, sucursal opcional, actor, acción, tipo e ID de entidad, diff/metadata seguros, request_id y created_at. Registrar altas/bajas de usuarios, roles, acceso a sucursales, configuración sensible, cancelaciones, modificaciones retroactivas, horarios, disponibilidad, exportaciones y acciones de platform_admin. No registrar secretos.

## Servicios y duración

Nombre, descripción, duración por defecto, estado activo, categoría y metadata de UI útil. Servicios, precios y disponibilidad por sucursal; capacidades por barbero. Composición standalone/additive/included/override o equivalente: no sumar indiscriminadamente todas las duraciones. Calcular duración definitiva exclusivamente en el servidor.

## Motor de agenda

Staff es un recurso, disponibilidad son intervalos y reservas son intervalos ocupados. Combinar horario de sucursal, reglas de staff, excepciones, horarios extraordinarios, cierres/feriados, time off, descansos, compatibilidad con servicios, duración y citas existentes.

Varios barberos compatibles libres permiten varias reservas simultáneas. Sin regla de un turno por hora. Proteger solapamientos del mismo staff en PostgreSQL mediante `tstzrange`, EXCLUDE y GiST; estados no bloqueantes deben liberar capacidad. La protección debe considerar staff que trabaja en distintas sucursales.

Creación, reprogramación y cancelación mediante operaciones transaccionales en servidor: validar identidad o request público; resolver organización y sucursal; validar servicios y staff; calcular duración; validar disponibilidad; persistir bajo constraints; historial; auditoría/evento; automatizaciones; commit.

Idempotencia transaccional para creación, reprogramación, cancelación, check-in, completar servicio y trabajos automáticos. Doble click/retry no puede duplicar citas, eventos ni notificaciones.

Estados consistentes: scheduled, confirmed, checked_in, in_service, completed, no_show, cancelled, rescheduled. UI española. Agenda hoy/día/semana, columnas por barbero, hora/cliente/servicio/duración/estado, filtros por sucursal/barbero/servicio/estado y acciones de crear/editar/reprogramar/cancelar/check-in/iniciar/completar.

## Booking público

Sucursal, servicios, barbero o cualquiera, fecha/hora, datos de cliente y confirmación. Resolver tenant desde slug/token/configuración pública segura; no aceptar organización arbitraria desde el navegador ni revelar datos privados de staff. Selección de cualquiera equilibrada, explícita y testeable, preservando disponibilidad. Rate limiting, honeypot, validación, límites de payload y validación de origen cuando corresponda.

## Walk-ins

Cola por organización y sucursal con cliente existente, servicios solicitados, barbero preferido opcional, fecha, estado, espera estimada y asignación opcional. Estados waiting, assigned, in_service, completed, cancelled, left. Mostrar personas esperando, barberos trabajando/disponibles y tiempo estimado. Convertir a cita/visita real sin duplicar cliente.

## Clientes, retención y rebooking

Ficha con contacto, nacimiento opcional, tags, notas, preferencias, barbero preferido, sucursal habitual, última visita, servicio habitual, frecuencia, gasto histórico cuando exista, visitas/no-shows/cancelaciones y próximo regreso estimado. Timeline de reservas, visitas, servicios, cancelaciones, no-shows, notas y contactos.

Retorno estimado desde último servicio, configuración, frecuencia e histórico. Estados derivados active, due_soon, due, overdue, lapsed cuando sea eficiente. Página con próximos a volver, atrasados, lapsed y mantenimiento de servicios especiales. Acciones WhatsApp, agendar, posponer, no contactar. Evitar crear cientos de tareas manuales. No tratar a cada recurrente como lead.

Al completar un servicio, ofrecer agendar próxima visita con recomendación según servicio, frecuencia y configuración.

Pipeline comercial liviano, opcional y secundario únicamente para consultas sobre rulos, tintura, premium o especiales. Si se implementa: new, contacted, interested, booked, won/completed, lost.

## Dashboard, capacidad y metas

Períodos hoy, 7 días, 30 días, mes y personalizado. Servicios realizados, reservas/pendientes/cancelaciones/no-shows, clientes nuevos/recurrentes, rebooking rate, utilización, ticket promedio cuando haya precios fiables, valor estimado de producción y metas. Comparación por sucursal, barbero y servicio. No presentar valores estimados como ingresos reales.

Capacidad: available_staff_minutes, booked_staff_minutes, completed_staff_minutes. Documentar utilización booked/available o equivalente. Identificar sucursales con huecos, días de mayor ocupación, staff utilizado y horarios ociosos.

Metas genéricas por organización, sucursal opcional y staff opcional, métrica, período, objetivo y fechas. Métricas iniciales services_completed, appointments_completed, revenue solo con información válida, utilization, rebookings. Mostrar progreso.

Agregados diarios de organización/sucursal/staff/servicio donde corresponda, idempotentes, recalculables y consistentes. Transacciones/eventos originales como fuente de verdad. Recientes live; históricos en agregados, sin recalcular todos los históricos por render.

## Realtime y automatización

Realtime selectivo para agenda del día, cola, check-in, estados y disponibilidad inmediata. Actualizaciones incrementales; cleanup de suscripciones y fallback sin polling agresivo. Nunca descargar todas las tablas ante un cambio.

Separar request interactivo y trabajo secundario. Evaluar pgmq/Supabase Queues. Jobs de confirmación, recordatorios de citas/retención, reconstrucción de métricas, webhooks y exports, con retries, máximo de intentos, archivo/dead letter, logging e idempotencia.

Persistir evento/job de forma atómica con la operación; ejecutar proveedor externo después del commit. Fallos externos no deben impedir una reserva. Eventos appointment_created/confirmed/cancelled/rescheduled/completed y customer_due/overdue. Separar dominio, job y adaptador de proveedor; arquitectura preparada para WhatsApp sin fingir que existe integración.

## UX

Interfaz intuitiva para dueño/recepcionista sin experiencia técnica, sin densidad visual de ERP tradicional. Referencias: claridad, navegación, tablas, filtros, records, search y views de Twenty; estados, permisos, flujos y recursos/calendarios de Odoo.

Navegación sugerida: Inicio, Agenda, Clientes, Walk-ins, Retención, Equipo, Sucursales, Metas, Reportes, Configuración. Reducir complejidad multi-sucursal para organizaciones de un local. Desktop prioritario para administración; móvil excelente para barberos, agenda, walk-ins y consulta rápida.

## Continuación: secciones 28–53

Home por rol (owner negocio, manager branch, recepción día/cola, barber agenda/métricas propias), búsqueda global con índices, UUID/phone normalizado, keyset y rango visible, validación server-side, máquina de estados y archive/deactivate. No descargar históricos completos ni confiar en restricciones visuales.

Contratos de seguridad con A/B y A1/A2/B1, usuarios/roles reales separados del fixture; concurrencia de 100 requests, dos/tres recursos y doble click idempotente. Carga aislada de 10/50/100 organizaciones con percentiles/error/planes, sin declarar capacidad no medida. Request ID, logs seguros/error boundaries/health, backups/restore/RPO/RTO/rollback/checklist.

Migrations reproducibles y no destructivas; CI install/lint/types/build/unit/integration/migration/security. Código separado por dominio. PostgreSQL es source of truth; calendarios externos son sincronizaciones futuras. Organización nueva por configuración, personalización por tenant, seed demo explícito fuera de producción y URL book por slugs server-side.

Domain events, proveedores desacoplados, privacidad mínima y preparación de export/anonymization futuro. Documentación de arquitectura/multi-tenancy/security/booking/availability/RLS/recovery/capacidad/release/onboarding/finanzas. Finanzas/comisiones/caja esperan el Sheet real, sin inventar reglas.

La entrega incluye arquitectura/schema/migrations/matriz/roles/flujos/tests/resultados build-riesgos-pendientes/checklist/configuración manual y estados IMPLEMENTADO/PROBADO/NO PROBADO/PENDIENTE. Prioridad: auditoría→schema/auth/RLS→configuración→disponibilidad→booking→UI/clientes/walk-in/retención→analytics/queues→hardening/tests/docs/auditoría final.

La referencia completa son las 53 secciones del pedido del usuario. Este archivo las resume; [VERIFICATION](VERIFICATION.md) registra cobertura y evidencia, sin marcar probado lo que solo existe en código. Push a main al finalizar, según instrucción adicional.
