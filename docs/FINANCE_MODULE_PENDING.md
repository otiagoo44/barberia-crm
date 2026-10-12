# Módulo financiero pendiente

PENDIENTE por información externa: Google Sheet real del primer cliente, significado de columnas, registro de precios/cobros, medios de pago, apertura/cierre de caja, gastos, comisiones, liquidaciones, excepciones y responsables.

No se crearon flujos falsos de caja, contabilidad, pagos ni comisiones. `appointment_services`/appointments conservan precio opcional, moneda y snapshots. Analytics expresa valor estimado de producción y ticket de visitas con precio conocido; no ingresos cobrados ni liquidación.

Extensiones futuras: payments → appointment/customer/organization/branch; cash_sessions → branch/operador; expenses → organización/branch; commission_rules y commission_entries → staff/servicio/periodo; settlements → periodo/staff. Mantener organization_id, FKs compuestas, RLS, idempotencia, eventos y auditoría. No crear estas tablas hasta validar el modelo real.

Role finance está reservado en DB y no se concede desde la UI V1; no tiene permisos de escritura operativa. No representa una implementación del módulo.

Antes de desarrollar: recibir copia anonimizada del Sheet, mapear conceptos con dueño, identificar fuente de verdad, validar redondeos/unidades/moneda y reconciliación. Definir migración/import con preview y trazabilidad. No inferir porcentajes o reglas de comisiones de ejemplos.
