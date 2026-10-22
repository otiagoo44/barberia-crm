# Entrega de integración para 17:17 — 20/10/2026

Esta revisión trabaja únicamente en `otiagoo44/barberia-crm`. No modifica otra landing, producto o base. El contrato de website se conserva en WEBSITE_INTEGRATION.md; sus afirmaciones sobre inventario cloud son históricas y deben contrastarse con el destino antes de activarlo.

## Lo que se conserva

Jonatan y Esteban atienden el catálogo configurado, disponibilidad **por fecha**, sin turnos semanales inventados. `equal_profit_share` continúa 50/50 después de ventas netas, POS, gastos operativos/salarios y comisiones ajenas. Guaraníes enteros; resto retenido en el negocio. Completar una cita no registra un cobro. Rulos conserva consulta previa en DB; query params no lo habilitan. Duraciones/precios desconocidos no se publican por conveniencia.

## Cambios de operación

- Equipo → Turnos del día: seleccionar fecha/profesional, cargar bloques y descansos, guardar lote atómico y consultar horas reales por servicio. Copiar a otra fecha requiere confirmación expresa y no elimina citas/bloques existentes.
- Cuenta → Seguridad: enrolar TOTP y confirmar código; agregar autenticador de respaldo separado. Owner, manager, finanzas y plataforma necesitan AAL2 efectivo en servidor y DB.
- Caja/Finanzas: se preserva checkout/split/cierre/reversal/import. Gráficos separan cobros, ventas y resultado; no muestran capacidad desconocida como cero.
- Finanzas → Distribuciones a socios: nueva extensión sin migrar historia. Ausencia de política significa bloqueado. Confirmar reglas crea una versión; preparar calcula snapshot, aprobar asigna, registrar pago exige entrega real, referencia y saldo; efectivo exige caja abierta. No ejecuta transferencias. Ajustes y devoluciones son nuevos registros auditados.

## Confirmaciones pendientes del propietario

Periodicidad manual/semanal/mensual; responsable de aprobación; tratamiento de retiros/adelantos y pérdidas anteriores; gastos pendientes de registrar; cierre por sucursal y eventual consolidación. El sistema no asume consolidación entre locales ni arrastra pérdidas automáticamente. No activar distribuciones con datos de ejemplo. La aplicación de un retiro solo admite adelanto real no deducible identificado, mismo socio/local, sin uso anterior; errores de clasificación requieren ajuste explícito auditado.

SMTP/remitente real, recuperación asistida y responsable; tarifas POS demostrables; duraciones faltantes; disponibilidad efectiva de cada día; cuatro filas XLSX a revisar (110/194/330/463). Ninguna importación histórica ejecutada. Confirmar logo/brand_color reales en Configuración, sin inventar assets.

## Puesta en marcha y evidencia

Staging independiente, backup/restore cloud, alertas recibidas y piloto por rol continúan OPEN. Antes de activar website confirmar slugs y flags de organización/sucursal, probar disponibilidad y una reserva consentida con datos reales. No se abrieron reservas ni se registró dinero real desde esta rama. Las pruebas de desarrollo usan fixtures aisladas, identificadas como tales.

Consultar PRODUCTION_READINESS.md para rollout; SECURITY_RELEASE_MATRIX.md para fronteras; FINAL_PRODUCT_AUDIT_2026_10_20.md para resultados finales. El PR es la unidad de revisión, no una autorización implícita para aplicar DDL en producción.
