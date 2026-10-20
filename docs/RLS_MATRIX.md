# Matriz RLS y permisos

La ampliación vigente por rol/objeto/registro/campo y soporte de plataforma está en [FINAL_PERMISSION_MATRIX](FINAL_PERMISSION_MATRIX.md). La migración final elimina el bypass comercial de platform_admin.

Cada celda contiene **SELECT / INSERT / UPDATE / DELETE directos**. `—` = denegado; O = organización propia; B = branches autorizadas; P = staff propio; C = cliente relevante; U = usuario propio. Todas las escrituras comerciales directas se revocaron; que una RPC permita escribir no significa que exista INSERT/UPDATE directo.

| Tabla | Owner S/I/U/D | Manager S/I/U/D | Reception S/I/U/D | Barber S/I/U/D | Anon S/I/U/D |
|---|---|---|---|---|---|
| appointment_services | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| appointment_status_history | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| appointments | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| audit_logs | O/—/—/— | B/—/—/— | —/—/—/— | —/—/—/— | —/—/—/— |
| automation_jobs | O/—/—/— | B/—/—/— | —/—/—/— | —/—/—/— | —/—/—/— |
| branch_business_hours | O/—/—/— | B/—/—/— | B/—/—/— | B/—/—/— | —/—/—/— |
| branch_closures | O/—/—/— | B/—/—/— | B/—/—/— | B/—/—/— | —/—/—/— |
| branch_services | O/—/—/— | B/—/—/— | B/—/—/— | B/—/—/— | —/—/—/— |
| branch_settings | O/—/—/— | B/—/—/— | B/—/—/— | B/—/—/— | —/—/—/— |
| branches | O/—/—/— | B/—/—/— | B/—/—/— | B/—/—/— | —/—/—/— |
| capacity_snapshots | O/—/—/— | B/—/—/— | —/—/—/— | P+B/—/—/— | —/—/—/— |
| customer_notes | O/—/—/— | C/—/—/— | C/—/—/— | C/—/—/— | —/—/—/— |
| customer_preferences | O/—/—/— | C/—/—/— | C/—/—/— | C/—/—/— | —/—/—/— |
| customer_service_returns | O/—/—/— | C+B/—/—/— | C+B/—/—/— | C+B/—/—/— | —/—/—/— |
| customer_tags | O/—/—/— | C/—/—/— | C/—/—/— | C/—/—/— | —/—/—/— |
| customers | O/—/—/— | C/—/—/— | C/—/—/— | C/—/—/— | —/—/—/— |
| daily_customer_activity | O/—/—/— | B/—/—/— | —/—/—/— | P+B/—/—/— | —/—/—/— |
| daily_metrics | O/—/—/— | B/—/—/— | —/—/—/— | P+B/—/—/— | —/—/—/— |
| daily_service_metrics | O/—/—/— | B/—/—/— | —/—/—/— | P+B/—/—/— | —/—/—/— |
| domain_events | O/—/—/— | B/—/—/— | —/—/—/— | —/—/—/— | —/—/—/— |
| goals | O/—/—/— | B/—/—/— | —/—/—/— | P/—/—/— | —/—/—/— |
| membership_branch_access | O/—/—/— | U/—/—/— | U/—/—/— | U/—/—/— | —/—/—/— |
| notifications | U/—/—/— | U/—/—/— | U/—/—/— | U/—/—/— | —/—/—/— |
| organization_memberships | O/—/—/— | U/—/—/— | U/—/—/— | U/—/—/— | —/—/—/— |
| organization_settings | O/—/—/— | O/—/—/— | O/—/—/— | O/—/—/— | —/—/—/— |
| organizations | O/—/—/— | O/—/—/— | O/—/—/— | O/—/—/— | —/—/—/— |
| profiles | O+U/—/—/— | U/—/—/— | U/—/—/— | U/—/—/— | —/—/—/— |
| services | O/—/—/— | O/—/—/— | O/—/—/— | O/—/—/— | —/—/—/— |
| staff | O/—/—/— | B/—/—/— | B/—/—/— | P/—/—/— | —/—/—/— |
| staff_availability_exceptions | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| staff_availability_rules | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| staff_branch_assignments | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| staff_service_capabilities | O/—/—/— | B/—/—/— | B/—/—/— | P/—/—/— | —/—/—/— |
| staff_time_off | O/—/—/— | B/—/—/— | B/—/—/— | P+B/—/—/— | —/—/—/— |
| walk_in_entries | O/—/—/— | B/—/—/— | B/—/—/— | P asignado/—/—/— | —/—/—/— |

Las cuatro vistas `visits`, `daily_organization_metrics`, `daily_branch_metrics`, `daily_staff_metrics` son SECURITY INVOKER: heredan permisos/RLS de tablas fuente, sin writes. Las tablas app_private (`platform_admins`, `gateway_credentials`, `idempotency_keys`, `rate_limits`) tienen —/—/—/— para todos los roles de navegador; acceso solo por helpers/operador DB confiable. Platform admin puede leer ámbitos de soporte mediante helpers; no tiene writes directos. Audit global organization_id NULL se reserva a platform admin.

## Escrituras mediante RPC

| Objeto/operación | Owner | Manager | Reception | Barber | Anon |
|---|---|---|---|---|---|
| Crear organización | Solo platform admin | — | — | — | — |
| Usuarios/roles/branch access | Organización | — | — | — | — |
| Configuración/branding/servicios globales | Organización | — | — | — | — |
| Branch crear/desactivar/reactivar | Organización | — | — | — | — |
| Branch editar dirección/contacto/horario/precios locales | Organización | Branch asignada; no activación | — | — | — |
| Staff global/capacidades | Organización | — | — | — | — |
| Asignaciones y disponibilidad | Organización | Branch asignada | — | Propia, si configuración lo permite | — |
| Clientes/notas/preferencias/tags | Organización | Relevantes | Relevantes | — | — |
| Crear/reschedule/cancel cita | Organización | Branch asignada | Branch autorizada | Solo rebooking propio autorizado | Solo gateway secreto, slugs y validación |
| Check-in/in-service/completed | Organización | Branch asignada | Branch autorizada | Cita propia | — |
| Walk-in crear/asignar/cerrar | Organización | Branch asignada | Branch autorizada | — | — |
| Metas | Organización | Branch asignada | — | — | — |
| Audit/history/events | Inserción solo dominio | Inserción solo dominio | Inserción solo dominio | Inserción solo dominio | Inserción solo gateway de dominio |
| Métricas/jobs/notifications | Solo worker privado | — | — | — | Gateway worker con secreto específico |
| Export CSV activos | Organización | Branch autorizada/relevantes | — | — | — |

No existe DELETE normal de customers/staff/branches/services/appointments. Quitar una regla/exception/capacidad sí tiene RPC explícita, comprobando alcance y citas futuras; no elimina historial operacional. Perfil/Auth global se administra fuera del CRUD de tenant. Finance habilitado por RPC.

Membresía/profile/organización activos se evalúan en cada request; el owner accede a toda la organización, manager solo branches asignadas y barber a su recurso. `can_access_branch` permite leer historia de branches archivadas; `can_operate_branch` exige activación.

Fuente exacta: migrations authorization/reporting_access/archived_branch_history y guards de cada RPC. Tests cross-tenant y de permisos en `tests/security/contracts.ts`; la evidencia distingue fixture Auth de Auth real.


## Matriz financiera

Writes directos INSERT/UPDATE/DELETE denegados. O=tenant,B=branch autorizada,P=staff propio.

|Área|Owner|Finance|Manager|Reception|Barber|Anon|
|---|---|---|---|---|---|---|
|Checkout/pago/caja RPC y lectura|O|B|B|B|—|—|
|Gasto normal|O|B|B|B|—|—|
|Adelanto/salario/comisión/liquidación/ajuste|O|B|B|—|P lectura|—|
|Reportes/cierres sellados|O|B|B|—|P resumen|—|
|Métodos/items/categorías catálogo|O|O|O|O|O lectura|—|
|Reglas POS/config global|O|O|—|—|—|—|
|Reglas comisión|O|O|B lectura|—|—|—|
|Import/export|O|B|—|—|—|—|
|Usuarios/seguridad|O|—|—|—|—|—|

Recepción recibe snapshot operativo sin financial. Cierres completos requieren report. Finance.* audit disponible finance/manager de branches autorizadas. Helpers comprueban profile/membership/organization/branch. Finance puede usar sucursales asignadas o all_branches explícito; manager requiere asignación explícita. No se concede seguridad a finance.

Revisión 15/10/2026: todas las tablas de aplicación, incluido `app_private.booking_attributions`, tienen RLS. La lectura de audit_logs usa un único predicado para authenticated que conserva la unión owner/manager/finance anterior. La regresión verifica que finance solo obtiene acciones finance.* de su tenant y recepción no obtiene filas de auditoría.
