# Operación de 17:17

## Procedimiento vigente — 23/10/2026

La [configuración confirmada](CONFIGURACION_CONFIRMADA_1717.md) sustituye la disponibilidad exclusivamente diaria descrita en los antecedentes de abajo. Hay turnos semanales confirmados y excepciones por fecha en el mismo motor. Esteban: L/M/S 09–19 y X/J/V 09–13, con pausa provisional 12–12:30. Jonatan: L–S 13–21. Domingo cerrado para disponibilidad ordinaria hasta confirmación; horario comercial del local pendiente.

Primero completar [acceso de ambos propietarios](ONBOARDING_DOS_PROPIETARIOS.md), MFA, SMTP, respaldo recuperable y piloto. No ejecutar el alta inicial otra vez: reconsultar UUID y actualizar únicamente 17:17/Luque con el plan autorizado. Los scripts preparados no demuestran que se hayan guardado turnos o tarifas en cloud.

Al abrir: Esteban verifica Caja, abre con efectivo real contado, consulta Agenda y las excepciones/ausencias de cada profesional. Para un cambio puntual usa Equipo → Turnos del día; una excepción disponible reemplaza la regla semanal de ese día, por lo que debe conservar explícitamente la pausa de Esteban. No copia una pausa a Jonatan. Una reducción que afecta citas requiere resolverlas primero, sin borrarlas.

Durante el día: encontrar/crear cliente, registrar Sin cita, asignar profesional y servicio, iniciar/completar, abrir Cobrar, revisar importes de servidor, cobrar en uno o varios medios y confirmar la respuesta real. Completar atención no equivale a cobro. Lavado se vende aparte; en checkout puede ser otra línea. El combo Rulos + Corte ya incluye Corte: 120 minutos totales/200000 PYG, sin agregar 40 minutos ni 30000. Rulos y tintes restringidos requieren evaluación.

Al cerrar: registrar gastos reales con su categoría, conciliar efectivo/transferencias/POS, contar efectivo y explicar diferencias antes de confirmar cierre. Débito 2% y crédito 5% están confirmados comercialmente, pero requieren evidencia/vigencia/cargos antes de activar versiones productivas. Los cierres y snapshots pasados no se recalculan.

Revisión mensual: 50/50 entre Esteban y Jonatan. La pantalla actual muestra una estimación según ventas posteadas y costos registrados; no garantiza caja disponible ni paga a socios. Mantener aprobación/pago de distribuciones bloqueados hasta acordar reconocimiento, POS, retiros, pérdidas y aprobador. [Estado y pendientes reales](RELEASE_FINAL_1717.md).

## Antecedentes anteriores al 23/10 (no usar como configuración vigente)

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

**Ganancia estimada = ventas posteadas − reversiones de ventas − tarifas POS − gastos operativos (incluidos salarios) − comisiones registradas de otros barberos.** Los socios no generan una comisión por cada servicio. El resultado positivo se divide entre ambos; el resto indivisible permanece en el negocio y se muestra por separado. Si hay pérdida, el reparto es cero.

El resumen depende de los gastos registrados: no adivina alquileres pendientes ni importa pagos históricos. Los salarios registrados sí integran el gasto operativo. Adelantos y retiros personales no se descuentan automáticamente del reparto. Revisar esos movimientos antes de realizar cualquier pago real. El cálculo no ordena transferencias ni crea liquidaciones pagadas. Los filtros son inclusivos por fecha local de la sucursal: una venta totalmente cobrada se reconoce al postear; un pago parcial anterior figura como cobrado en su fecha, sin adelantar esa venta al reparto.

El resumen sigue siendo una estimación. El registro de distribuciones aprobadas, pagos reales y saldos está implementado en **Finanzas → Distribuciones a socios**, como extensión opt-in. Sin política confirmada por el propietario permanece bloqueado. Preparar o aprobar no registra un pago ni ordena una transferencia. Ver [entrega vigente](1717_INTEGRATION_HANDOFF.md); [PARTNER_DISTRIBUTIONS_DESIGN](PARTNER_DISTRIBUTIONS_DESIGN.md) se conserva como diseño histórico.

La modalidad y sus participantes se protegen después de la primera venta registrada para mantener el significado del historial. No cambiar comisiones históricas ni usar ajustes ficticios para representar un reparto.

## Correo y respaldos pendientes

El propietario confirmó que todavía no tiene SMTP ni una política de respaldo. Configurar un SMTP propio en Supabase Auth, con remitente/dominio verificados, y probar registro y recuperación. No guardar credenciales en Git ni compartirlas por chat. [Guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Elegir un responsable, frecuencia, retención y almacenamiento privado de copias. Ejecutar una restauración aislada con la copia del proyecto real antes de habilitar clientes; el restore local del CI no demuestra recuperación cloud. [Procedimiento del proyecto](BACKUP_AND_RECOVERY.md) y [documentación de backups](https://supabase.com/docs/guides/platform/backups). No se contrató ningún servicio o plan automáticamente.
