# Política financiera 17:17 — 24/10/2026

Esta página y la respuesta del propietario del 24/10 sustituyen los pendientes comerciales de reconocimiento, pérdidas, retiros, aprobación y horario público de la entrega anterior. No certifican activación cloud ni asesoría fiscal. Organización `1717-barberia`, sucursal `luque`, PYG enteros, America/Asuncion.

## Acuerdo confirmado

- Reparto mensual calendario, Esteban/Jonatan 50/50; solamente cobros efectivamente recibidos y gastos pagados registrados.
- Tarjetas: se reconocen al acreditarse en banco, con conciliación. La captura del terminal no basta.
- Anticipos de clientes: se incluyen en los cobros. Si jurídicamente son reembolsables, se exige resolver y documentar su elegibilidad antes de distribuir; no se inventa renuncia ni se cambia el pasivo fiscal por un acuerdo informal.
- Las pérdidas se recuperan en meses siguientes antes de distribuir ganancias. No hay pagos negativos.
- Los retiros personales reducen la parte del socio identificado. El exceso queda como anticipo pendiente para meses posteriores; no es un costo operativo ni se asigna al otro socio.
- Ambos propietarios aprueban independientemente el mismo cálculo, con cuentas distintas, MFA y membresías vigentes. El pago real se registra después.

## Reconocimiento exacto del nuevo read-model

La política explícita `settled_collections_including_advances` vive en `partner_cash_policies`, vinculada a una versión de `partner_distribution_policies`. Ninguna migración lee el JSON comercial para activar un tenant. La configuración empieza deshabilitada y no importa historia.

Cada `payment` o devolución se concilia una sola vez en `payment_reconciliations`. Guarda importe bruto del ledger, fecha de cobro original, fecha de elegibilidad, fecha de acreditación, comisión efectiva, impuestos, retenciones, otros cargos, eventual devolución real de comisión, neto y evidencia. Ningún campo desconocido se rellena automáticamente con cero.

Fecha de reconocimiento = máximo entre cobro, elegibilidad resuelta y acreditación, convertido a la fecha local del negocio. Un anticipo elegible en efectivo puede reconocerse al cobrarse aunque el checkout siga en draft. Un pago parcial y su saldo posterior conservan sus respectivos UUID y fechas; el post de la venta no vuelve a reconocerlos. Un POS capturado pero sin conciliar impide una propuesta definitiva; el sistema no lo considera acreditado.

Neto de cada movimiento = dirección × bruto − comisión − impuestos retenidos − retenciones − otros cargos + comisión realmente devuelta. Un crédito de comisión solo puede corresponder a una devolución y no superar el costo original conciliado. El neto declarado debe coincidir exactamente. La tarifa estimada del pago histórico permanece intacta y no vuelve a deducirse.

Los gastos existentes representan egresos pagados: operativos, salarios y pagos efectivos de comisiones de trabajadores no socios. Los anticipos de personal, retiros de propietarios y distribuciones no vuelven a reducir utilidad. Las facturas pendientes se registran aparte en `expense_payables` y no se descuentan. Al pagarlas se registra el gasto real con su referencia; no hay conversión automática ni pago externo. La clasificación fiscal de IVA/retenciones debe revisarla la contadora; este read-model mide disponibilidad distributiva conservadora.

Resultado previo = netos elegibles − gastos operativos pagados. Resultado distribuible = máximo(resultado previo − pérdidas pendientes, 0). Cada socio recibe floor(resultado distribuible/2); el resto entero queda en el negocio. Los agregados `gross_revenue` y `collected` conservan su significado histórico y no se convierten silenciosamente en el nuevo resultado.

## Pérdidas, retiros y cierres

`partner_loss_ledger` registra cada origen, aplicación y remanente con FK compuesta y una sola aplicación por par origen/período. Solo la aprobación dual escribe el arrastre. Los meses deben ser consecutivos desde un primer mes explícito. El saldo inicial cero debe confirmarse; si existen pérdidas históricas, se bloquea esta configuración y se requiere una importación revisada, nunca un cero implícito.

Los adelantos elegibles son registros reales no deducibles de `staff_advances` vinculados al socio, método/fecha/referencia/evidencia del gasto original. `classify_withdrawal` exige distinguir explícitamente retiro personal y adelanto laboral en `partner_advance_classifications`; una clasificación pendiente bloquea la propuesta. `partner_advance_applications` aplica solamente retiros identificados hasta el saldo de su participación, deja el excedente para otro mes e impide el descuento duplicado. No convierte adelantos de empleados en retiros. Un retiro aplicado no puede revertirse independientemente.

Un mes congelado guarda fuentes, política, componentes, retiros disponibles, pérdidas, hash y asignaciones. Cambios materiales antes de aprobación hacen obsoleta la propuesta: preparar otra; las aprobaciones del hash anterior nunca habilitan pagos. Las dos aprobaciones se serializan por organización y son únicas por persona/período. La base vuelve a comprobar rol, perfil, socio y sesión/factor al completar aprobación; pagos exigen dos propietarios todavía vigentes.

Períodos aprobados/cerrados son inmutables. No se reabren ni se reescriben: devoluciones y reversión económica real afectan su fecha posterior y el siguiente mes. Nuevos cobros o gastos no pueden fecharse dentro de un mes congelado. El cierre de caja es independiente del cierre societario. Reabrir caja crea otra sesión según el flujo existente; no modifica la propuesta societaria.

## Activación

`configure_cash` registra el acuerdo deshabilitado y exige los dos profesionales vinculados a owners reales. `approve_activation` requiere evidencia externa de cuentas, SMTP, MFA, contrato POS, política, staging, backup/restore, alertas y piloto. Cada socio aprueba con su sesión; únicamente dos aprobaciones sobre la misma evidencia generan una nueva versión habilitada. No se ejecutó esta activación en producción. No hay automatización de pagos o transferencias.
