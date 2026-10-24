# Distribuciones a socios

Vigente 24/10: el módulo base ya existe desde la migración 29. La extensión de cobros/conciliación/aprobación dual se implementa incrementalmente en la migración 38; no es una tabla de diseño sin código. [Política implementada](POLITICA_FINANCIERA_CONFIRMADA_1717.md), [pruebas](PRUEBAS_DOBLE_APROBACION.md), [estado de publicación y cloud](CIERRE_FINAL_1717_2026_10_24.md). El diseño histórico siguiente explica las decisiones anteriores; no sustituye el reconocimiento por cobros de 17:17 ni habilita aprobación por una sola persona.

## Diseño histórico

Estado: diseño, sin tablas ni pagos implementados. `equal_profit_share` sigue calculando una estimación. No reinterpretar `staff_settlements` de comisiones como pagos a socios.

## Semántica actual verificada

Resultado del intervalo inclusivo de fechas locales de **una sucursal**: ventas posteadas menos ventas revertidas en el período, menos fees registrados, gastos operativos y salarios, menos comisiones devengadas de otros barberos. Los socios no generan comisión por servicio desde la configuración de ese modelo. Post requiere cobro completo, pero cobro y post pueden estar en períodos distintos; los parciales no adelantan el reconocimiento de la venta.

El selector de fechas define el período de la estimación. No hay período societario cerrado implícito. Cada sucursal se resume por separado; no sumar participaciones ya redondeadas de varios locales para efectuar un pago global. La fecha del pago, del post, de la reversión y la timezone no se intercambian. No se deducen gastos pendientes sin registrar, adelantos o retiros personales como si fueran nuevamente gastos operativos. Sí se deducen salarios registrados. Descuentos forman parte del precio efectivo del checkout; no existe un módulo separado de descuentos promocionales. Devolver una venta no implica que la adquirente devuelva el fee original.

Unknown de fees/comisiones bloquea la cifra definitiva. Pérdida produce reparto cero. PYG usa guaraníes enteros: `floor(max(resultado,0)/2)` para cada socio; el resto queda en el negocio. Un cierre diario conserva su snapshot; una reversión posterior afecta su fecha y no reescribe ese cierre. La estimación no garantiza efectivo disponible ni reserva deuda pagadera.

## Extensión propuesta

1. `partner_distribution_periods`: organization_id, branch_id, intervalo inclusivo de fechas locales, moneda, versión de política, estado draft/approved/closed, corte de datos, hash y snapshot de componentes del resultado. FK compuesta de sucursal. EXCLUDE por organización/sucursal/rango para impedir períodos aprobados solapados. Sin modificación de períodos aprobados/cerrados; rectificación mediante ajuste vinculado.
2. `partner_distribution_allocations`: período, socio staff del mismo tenant, participación racional y monto entero aprobado, resto retenido. Única asignación por período/socio. Congelar integrantes y porcentaje al aprobar, bajo lock de organización, con conciliación contra gastos pendientes y desconocidos; impedir aprobación si faltan evidencias. 17:17 exige Jonatan y Esteban 50/50.
3. `partner_distribution_payments`: asignación, importe efectivamente entregado, medio, fecha real, referencia, autor y clave de idempotencia durable. Append-only; reversión mediante contramovimiento enlazado, único. El pago no puede exceder saldo aprobado. Efectivo requiere sesión abierta, genera un cash_movement y se verifica saldo; transferencia requiere referencia confirmada por operador. Nunca ejecutar una transferencia bancaria externa automáticamente.
4. `partner_withdrawal_allocations`: aplicar un retiro/adelanto ya registrado a una asignación, con referencia única, saldo disponible y semántica explícita de capital/reparto. Aplicación y pago se serializan; no crear otro egreso ni restar otra vez un salario/comisión. Los retiros existentes sin clasificación quedan pendientes de revisión, sin conversión automática.

Saldo por socio = asignado aprobado + ajustes posteriores − pagos netos − retiros aplicados. Todos los movimientos conservan moneda y claves compuestas. La suma pagada y aplicada no puede superar la asignación ajustada. Una devolución tardía se registra en el siguiente período/ajuste enlazado, nunca sobrescribiendo una asignación pagada. Bloquear cierre con saldos o ajustes sin conciliar según política acordada.

## Permisos y experiencia

Owner/finance con membresía activa y acceso a la sucursal preparan, revisan y confirman importes. Confirmación separada muestra período, socios, base, ajustes, pagos previos y saldo. Manager puede consultar estimación de su local pero no aprobar/pagar distribuciones globales. Recepción no recibe asignaciones ni saldos; barber solo consulta asignaciones propias mediante proyección sin datos de compañeros, si además es socio. Platform_admin necesita membresía comercial explícita para estas acciones. Cada RPC valida actor/organización/membresía/rol/sucursal/registro/estado; wrappers invoker, helpers privados, RLS, auditoría/outbox transaccional y dedupe `finance.*`.

## Gates de implementación

Antes de migrar: acordar período (semanal/mensual), aprobación por sucursal o consolidación multi-sucursal, clasificación de retiros, gastos devengados aún impagos y tratamiento de pérdidas acumuladas. No inventar decisiones societarias. Pruebas obligatorias: dos pagos concurrentes, aprobación repetida, solapamiento, saldo negativo, refund tardío, resto de 1 Gs., retiro aplicado dos veces, recuperación tras timeout, scopes y restore de asignaciones/pagos. No migrar historia ni dar por pagados repartos estimados anteriores.
