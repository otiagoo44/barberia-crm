# Operación de 17:17

## Antes de abrir

Jonatan y Esteban hacen todos los servicios del catálogo. Su disponibilidad cambia: se carga por día, sin imponer turnos semanales. Reparten la ganancia en partes iguales después de los gastos del negocio.

1. En **Equipo → Turnos del día**, elegir la fecha, el barbero y cada bloque disponible. Se pueden cargar mañana y tarde por separado y descontar descansos. Una reducción que afecta citas requiere reasignarlas primero en Agenda.
2. En **Servicios**, revisar duración y precio de cada servicio del local. Rulos requiere consulta previa; combos y tintes sin duración confirmada se completan antes de ofrecerlos. Asignar a ambos cualquier servicio nuevo desde **Equipo → Servicios por barbero**.
3. En **Finanzas → Configuración financiera**, verificar **Ganancia en partes iguales después de gastos**, con Jonatan y Esteban. Cargar las tarifas vigentes de débito y crédito con evidencia. Los porcentajes históricos del Excel no se aplican automáticamente a cobros nuevos.
4. Completar SMTP y una política de respaldos con recuperación comprobada. La confirmación y recuperación por correo deben probarse con un destinatario autorizado antes del lanzamiento.
5. Al tener horarios y catálogo revisados, habilitar reservas tanto en **Configuración → Preferencias del negocio** como en **Sucursales → Reservas del local**. Comprobar una reserva de prueba con los horarios cargados.

## Durante el día

Abrir **Caja** con el efectivo inicial. Registrar cada atención en Agenda; al completarla, abrir **Cobrar**, revisar servicios/importes y elegir uno o varios medios de pago. Completar una cita no registra el cobro por sí solo.

Registrar alquiler, servicios, insumos y demás costos en **Finanzas → Gastos**. Los gastos fijos deben cargarse en el período que se quiere repartir. Al cerrar, contar el efectivo y registrar cualquier diferencia con su motivo.

## Reparto

**Ganancia estimada = ventas cobradas − tarifas POS − gastos operativos − comisiones registradas de otros barberos.** Los socios no generan una comisión por cada servicio. El resultado positivo se divide entre ambos; el resto indivisible permanece en el negocio y se muestra por separado. Si hay pérdida, el reparto es cero.

El resumen depende de los gastos registrados: no adivina alquileres pendientes ni importa pagos históricos. Adelantos, salarios y retiros personales no se descuentan automáticamente del reparto. Revisar esos movimientos antes de realizar cualquier pago real. El cálculo de reparto no ordena transferencias ni crea liquidaciones pagadas.

La modalidad y sus participantes se protegen después de la primera venta registrada para mantener el significado del historial. No cambiar comisiones históricas ni usar ajustes ficticios para representar un reparto.

## Correo y respaldos pendientes

El propietario confirmó que todavía no tiene SMTP ni una política de respaldo. Configurar un SMTP propio en Supabase Auth, con remitente/dominio verificados, y probar registro y recuperación. No guardar credenciales en Git ni compartirlas por chat. [Guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Elegir un responsable, frecuencia, retención y almacenamiento privado de copias. Ejecutar una restauración aislada con la copia del proyecto real antes de habilitar clientes; el restore local del CI no demuestra recuperación cloud. [Procedimiento del proyecto](BACKUP_AND_RECOVERY.md) y [documentación de backups](https://supabase.com/docs/guides/platform/backups). No se contrató ningún servicio o plan automáticamente.
