# Multi-tenancy

Una instalación, un Supabase y múltiples organizaciones independientes. Organización es empresa/marca; sucursal es local físico. Los clientes pertenecen a la organización y conservan identidad entre sucursales. Staff tiene asignaciones múltiples y no necesita cuenta Auth.

UUID globales, `organization_id` en registros comerciales y `branch_id` cuando existe local. FKs compuestas hacen imposible referenciar cliente, servicio, branch, staff asignado o cita de otro tenant. La exclusión de agenda usa staff global, por lo que cambiar de local no evita un conflicto.

Cada RPC valida identidad, membresía viva, rol y acceso al objeto. Una organización no se toma de metadata editable ni del tenant seleccionado visualmente. Las funciones públicas resuelven organización/sucursal por slugs y configuración habilitada. Anon no puede leer las tablas comerciales.

`organization_id` no puede cambiar tras insertar. Archivar conserva historial. Sucursales inactivas siguen siendo visibles dentro del alcance autorizado para consultar historia/reactivar; las operaciones y la disponibilidad requieren sucursal activa.

Manager ve sus branches asignadas. Un cliente es relevante si tiene sucursal habitual o cita/walk-in en una branch autorizada. Barber ve clientes que tienen citas propias en una branch autorizada y solo sus citas. El historial de visitas se filtra independientemente por acceso a cada cita. Notas/preferencias/tags son información organizacional del cliente relevante; no representan entidades privadas separadas por visita.

Las tablas privadas de credenciales, idempotencia, limitadores y administradores tienen RLS sin políticas y ningún grant de lectura a roles de navegador. Los helpers autorizados acceden como propietarios de función. Ningún esquema privado se expone en Data API.

Nuevas organizaciones se crean mediante administración de plataforma, usando nombre, slug, timezone, moneda y propietario registrado. Todos los demás ajustes son datos; no se requiere fork ni IDs en código. Ver [onboarding](NEW_ORGANIZATION_ONBOARDING.md).
