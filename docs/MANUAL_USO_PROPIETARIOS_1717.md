# Guía breve para Esteban y Jonatan

CRM: https://barberia-crm-kappa.vercel.app. Cada uno usa su cuenta; nunca compartan contraseña ni códigos MFA. Esta guía describe el flujo del producto. El instalador debe completar y verificar los pendientes productivos antes del piloto.

## Primer acceso

1. Las dos cuentas ya fueron creadas el 26/10, ambas como **Propietario**, con Luque y su profesional correcto. No creen otra cuenta.
2. Esteban usa `estebanras15@gmail.com`; Jonatan `jonatanramos2005oviedo@gmail.com`. Abrí [Iniciar sesión](https://barberia-crm-kappa.vercel.app/login) → **Reenviar confirmación**, ingresá tu propio correo y abrí el mensaje recibido. Si no llega, revisá spam con el instalador; no autoconfirmar desde el administrador.
3. Entrá con la contraseña temporal que el instalador indicó privadamente. El sistema bloquea el acceso al negocio hasta reemplazarla; no queda guardada en esta guía ni en el repositorio.
4. El primer acceso te dirige a configurar y verificar tu autenticador personal. Después, **Nueva contraseña** exige una contraseña propia de al menos 12 caracteres y rechaza reutilizar la temporal. No compartas códigos ni contraseña. La temporal anterior dejará de servir.
5. En **Seguridad de la cuenta** (`/mfa`), agregá y verificá también un segundo autenticador de respaldo independiente. Guardá la recuperación de manera privada.
6. Elegí **17:17 Barbería → Luque**. Comprobá Agenda, Clientes, Caja y Finanzas desde tu propio equipo. Si no aparecen, revisar membresía y sucursal; no quitar MFA.

## Clientes y atención sin reserva

- **Clientes → Agregar cliente**: buscá primero por nombre o teléfono para evitar duplicados. Cargá datos reales y el teléfono con código de país.
- **Sin cita**: elegí cliente existente o registrá uno, seleccioná servicios y profesional. Asigná la atención cuando exista capacidad, marcá su avance y completala al terminar.
- **Agenda**: elegí fecha y vista Día/Semana; usá **Filtros** para profesional, servicio o estado. Los chips muestran filtros activos y permiten limpiarlos.
- Esteban descansa de 12:00 a 12:30. Los domingos están cerrados. Una demora de 15 minutos requiere evaluación humana; el sistema no cobra multas ni cancela una atención en curso.
- Rulos, combo y tintes requieren conversación previa. El combo rulos + corte ocupa **120 minutos en total**.

## Disponibilidad

**Equipo → Editor semanal** permite elegir profesional, fecha futura, varios días y turno. Activá **Agregar descanso** para dividirlo. Revisá la vista previa y guardá la semana en una sola operación. El editor conserva los horarios anteriores y rechaza un cambio que deje reservas fuera del turno.

Para Esteban: lunes/martes/sábado 09–19 con pausa; miércoles/jueves/viernes 09–13 con pausa. Jonatan: lunes–sábado 13–21. Domingo queda sin seleccionar. La fecha del nuevo editor empieza a partir de mañana para proteger lo ya ocurrido; el plan inicial lo aplica el instalador.

**Turnos del día** sirve para una excepción de una fecha; **Ausencias** para una ausencia. No sustituyas horarios recurrentes por muchas excepciones. Si el editor informa una migración pendiente, el instalador debe completar el upgrade; no forzar un check verde.

## Cobro después de atender

1. **Caja**: abrir la sesión del local con el efectivo real contado. No inventar saldo inicial.
2. Desde la atención **Completada**, abrí **Cobrar**. Conserva los servicios y precios guardados en esa atención.
3. Una venta manual también permite elegir un servicio de Luque y el profesional que lo realizó. No hace falta crear un producto ficticio para cobrar un corte.
4. Elegí Efectivo, Transferencia, Débito o Crédito. Para dividir, agregá los medios y sus importes. Comprobá el pendiente antes de confirmar.
5. Si falta tarifa vigente, no se puede completar ese medio hasta que el instalador valide las condiciones. No elijas otro medio distinto del real para evitar el error.
6. El precio del servicio es el mismo por medio de pago. Un trabajo adicional real puede registrarse con precio acordado y motivo autorizado. No usarlo para trasladar u ocultar un recargo por tarjeta.
7. Ante error, los datos quedan cargados. Leé el campo o dependencia indicada; si la conexión quedó incierta, actualizá y comprobá el registro antes de repetir. No emitir devoluciones bancarias desde una reversión contable sin verificar que correspondan.

## Gastos y cierre de caja

En **Finanzas → Gastos**, registrar lo efectivamente pagado, categoría, medio, referencia y evidencia. Una factura pendiente no equivale a gasto pagado. Los retiros personales van identificados al socio y no como alquiler, insumos u otro gasto operativo.

Al terminar: revisar pagos, pendientes y reversiones; contar el efectivo real; **Caja → Cerrar caja**. Registrar diferencias con su explicación. No modificar movimientos antiguos para hacer coincidir el conteo.

## Reportes y ganancias

**Reportes / Finanzas**: elegir Luque y período; ventas, producción, cobrado, pendiente y neto acreditado representan cosas distintas. Con tarjeta, el cobro bruto y la acreditación se concilian con la liquidación de UPay. El total comunicado ya incluye los conceptos informados; no descontarlos dos veces.

**Finanzas → Reparto** permanece bloqueado hasta cerrar política y controles. La propuesta mensual considera cobros elegibles, gastos pagados, costos no duplicados y pérdidas anteriores. Cada retiro reduce solo la parte de quien lo recibió.

Una vez habilitado: revisar propuesta y versión del cálculo; Esteban aprueba con su sesión y Jonatan con otra. Una aprobación no permite pagar. Si cambia materialmente el cálculo, volver a preparar y revisar. El pago efectivo se registra por separado y nunca se genera por un simple cierre de mes.

## Piloto del lunes 26/10

Ambos deben probar sus equipos, acceso independiente, agenda, un cliente y atención reales autorizados, cobro por un medio habilitado, gasto real si existe, reporte y cierre de caja. Las pruebas ficticias se hacen en el entorno aislado. Reservas públicas y distribuciones siguen deshabilitadas hasta superar sus controles y decidir la activación.
