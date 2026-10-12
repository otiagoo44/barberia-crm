# Finanzas operativas

El módulo está implementado sobre la arquitectura existente; la habilitación del primer negocio depende del onboarding y de los controles de release en VERIFICATION. No es contabilidad fiscal ni un ERP.

## Fuente de verdad y dinero

`checkouts` y `checkout_lines` representan ventas; `payments`, cobros y devoluciones. Una cita completada sigue sin cobrar hasta registrar un checkout. Una única venta activa por cita evita duplicaciones. Walk-ins convertidos utilizan ese mismo flujo. Productos, cursos y otros ingresos usan el catálogo `finance_items`.

Importes en enteros de unidad mínima (`bigint`, límite por operación 9e12); PYG no tiene decimales. Tarifas en basis points. PostgreSQL calcula cada fee/comisión con redondeo half-up exacto. El browser no fija precio, duración, fee ni comisión oficiales. Un precio manual requiere autorización y motivo; los ingresos históricos toman el movimiento fuente.

El checkout guarda servicio/nombre/precio/moneda/barbero/sucursal. Se puede recibir un pago parcial en draft; el total recibido no puede superar el total. `post_checkout` acepta múltiples pagos y los registra junto con el post en una transacción: si falla una parte, todo revierte. Post exige suma exacta. Tarifa POS se toma al registrar el pago; comisión se toma al postear, con regla staff+servicio, override de branch y vigencia. Una regla ausente es **unknown**, no cero inventado. Cambiar catálogo o reglas no recalcula el pasado.

## Gastos, personas y liquidaciones

`expenses` separa gastos operativos, adelantos, salario y pago de comisión mediante categoría estructurada. Adelantos y salarios también tienen registros propios. Un adelanto es descontable solamente si se configuró así. Una liquidación reserva entradas de comisión, adelantos disponibles y ajustes una sola vez. Flujo draft → reviewed → paid → closed. El pago de comisión no incluye salarios ni duplica el gasto por comisión devengada. Una liquidación cerrada es inmutable; correcciones posteriores se registran como ajustes auditados. Saldos negativos requieren revisión/ajuste antes de pagar.

## Caja y cierres

Una caja abierta por sucursal/identificador recibe movimientos append-only. Esperado = apertura + cobros efectivo − egresos efectivo ± ajustes/devoluciones. Para efectivo se exige una caja abierta; no se permite salida con saldo negativo. Cierre calcula esperado server-side, solicita contado y exige motivo si hay diferencia. Sella snapshot y una revisión de `daily_closures`. Reapertura autorizada crea otra sesión vinculada, conservando la anterior. Recepción recibe solamente el snapshot operativo; los reportes completos de comisiones permanecen restringidos.

## Correcciones

No se edita ni elimina físicamente una venta posteada. Se revierte checkout + pagos + entradas de comisión y se conserva una referencia al original. Corrección de un pago draft también usa contramovimiento. Devoluciones de efectivo requieren caja abierta actual. Fees POS originales **no se dan por reembolsados**. Un gasto revertido conserva original y movimiento compensatorio. Adelantos ya aplicados y pagos de liquidación requieren ajuste auditado.

## Métricas

- `gross_revenue`: ventas posteadas menos reversión de ventas en la fecha de reversión.
- `collected`: pagos recibidos menos devoluciones, incluyendo parciales pendientes de post.
- `payment_processing_fees`: fees efectivamente registrados; ausencia histórica explícita unknown.
- `operating_expenses`: gastos normales y salarios independientes. Adelantos y pagos de comisión son salidas de fondos, pero no duplican gasto de la comisión devengada.
- `barber_commissions`: devengado por líneas posteadas menos reversals.
- `net_revenue`: ingresos por ventas menos fees POS.
- `operating_result`: net_revenue − gastos operativos − comisiones. No es beneficio contable neto; si faltan fees/comisiones se informa no disponible.
- `average_ticket`: revenue / paid checkouts. Clientes únicos identificados se cuentan por customer_id, separadamente; nombres históricos no crean identidades.

Producción de servicios completados, cobrado y pendiente actual se muestran separados. Pendiente incluye drafts no pagados y citas completadas sin checkout. Los agregados diarios financieros, de método y de staff se recalculan idempotentemente solo para branch/días afectados. El ledger original conserva autoridad. Reportes y movimientos usan filtros/paginación server-side; exports owner/finance están auditados y neutralizan fórmula CSV.

## API y permisos

`/api/finance/{view}` devuelve catalog/checkout/cash/summary/movements/expenses/settlements/closures/staff. `/api/finance/command` valida sesión/Origin/payload y llama `finance_command`. RPCs públicas son invoker; privadas definer con search_path vacío, grants explícitos y validación de actor/tenant/branch/rol/estado. Toda mutación se serializa por tenant, resuelve idempotencia, audita y registra domain event sin enviar datos financieros a notificaciones generales. Ver RLS_MATRIX y FINANCE_IMPORT_1717.

RPCs individuales: create_checkout, record_payment, post_checkout, create_expense, open/close/reopen_cash_session, record_cash_movement, record_staff_advance, record_salary_payment, create/review/pay/close_staff_settlement, record_financial_adjustment, reverse_financial_transaction. Configuración pasa por finance_command; import y export tienen RPCs acotadas propias.
