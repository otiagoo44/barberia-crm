# Conciliación UPay 17:17 — 24/10/2026

La información nueva del propietario y del mensaje de la representante sustituye las tasas anteriores de 2%/5%: **débito 2,2% (220 bps), IVA incluido; crédito 5,2% (520 bps), IVA y retención incluidos**. Según la oferta, sin alquiler ni contrato. No se recibió una liquidación completa que verifique las condiciones actuales, vigencia, cargo fijo, otros cargos o desglose. Una captura informada de G. 29.340 es compatible aritméticamente con G. 30.000 menos 2,2%; no prueba por sí sola que ese fuera su bruto ni todas las condiciones.

El manifiesto registra tasas **propuestas**, con activación false. El preparador exige `percentageBps`, componentes separados `processing/vat/withholding/other` que sumen el total, fijo confirmado, vigencia y referencias. Nunca genera un cero a partir de un valor desconocido. Los componentes numéricos usados en tests son sintéticos y no son las condiciones UPay. La retención queda separada de la comisión comercial en la conciliación real; el fee estimado del pago no sustituye ese desglose.

## Precio y norma

El propietario informó un corte anunciado de G. 30.000 y cobrado G. 31.000 con tarjeta. La [Ley 5620/2016, texto de la BACN](https://www.bacn.gov.py/leyes-paraguayas/5123/ley-n-5620-modifica-el-articulo-20-numeral-3-de-la-ley-n-547615-que-establece-normas-de-transparencia-y-defensa-al-usuario-en-la-utilizacion-de-tarjetas-de-credito-y-debito) reproduce la prohibición de agregar un cobro al precio de venta por usar débito/crédito. Debe confirmar con su contadora una política compatible antes del piloto. No se implementa recargo automático, compensación ficticia, ocultación de ingreso ni cambio del precio por elegir tarjeta. Todo importe realmente cobrado debe registrarse íntegramente y cualquier diferencia debe revisarse.

## Modelo

Venta/checkout y cobro/payment permanecen separados. La regla de fee al cobrar es un snapshot estimado con su vigencia; no cambia la venta. La liquidación conciliada agrega bruto, comisión real, impuestos, retenciones, otros cargos, neto, fechas y referencia en una tabla append-only. No modifica el pago ni las métricas históricas. El reparto por cobros usa exclusivamente ese neto, por lo que no descuenta nuevamente el fee.

Ejemplos aritméticos, sin movimientos productivos: G. 30.000 × 2,2% = G. 660; neto G. 29.340 si no hay otros descuentos. Al 5,2%, descuento total G. 1.560; neto G. 28.440 bajo la misma condición. Se exige el desglose real de comisión/impuestos/retención; el total no se etiqueta íntegramente como comisión. Si el banco informa otro neto, la conciliación queda pendiente hasta explicar los componentes. Una devolución no presume que UPay devuelve la comisión; un crédito real requiere evidencia y límite contra el costo original.

## Evidencia para el instalador

1. Contrato/plan, titular, comercio y terminal del negocio correcto; no publicar números bancarios.
2. Fechas de vigencia, débito/crédito, porcentaje, fijo, tratamiento de IVA, retenciones y otros cargos. Cero debe ser un dato verificado.
3. Para cada movimiento: UUID del pago, importe real, fecha de cobro y fecha bancaria, componentes de costos, neto y referencia privada a la liquidación.
4. Resolver precio anunciado versus cobrado con la contadora; no activar un recargo en el CRM.
5. Preparar tarifas con `prepare-1717-pos.mjs` y evidencia explícita. Ensayar en staging, conservar snapshots y reglas anteriores, revisar antes de aplicar.
6. Conciliar split payments por UUID, devoluciones y acreditaciones de otro mes; comprobar que cada componente se cuenta una sola vez.

Cloud al inspeccionar: métodos cash/transfer con reglas previas 0%/0 fijos; debit/credit sin reglas. No se escribieron tarifas ni liquidaciones productivas en esta ejecución.
