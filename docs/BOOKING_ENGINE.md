# Motor de reservas

## Transacción

`create_booking`, `reschedule_booking`, `transition_booking`/`cancel_booking` son la API del dominio. El gateway público resuelve slugs/configuración y llama el mismo motor interno. La transacción valida permisos y tenant, toma lock de organización, valida branch/staff/servicios, calcula duración y precio, valida intervalos, inserta o cambia cita, snapshots, history, audit, evento y jobs. El proveedor externo se ejecuta después del commit.

Una comprobación de disponibilidad no garantiza una reserva. PostgreSQL agrega `EXCLUDE USING gist (staff_id WITH =, during WITH &&)` para estados scheduled/confirmed/checked_in/in_service. `during=tstzrange(starts_at,ends_at,'[)')`: citas adyacentes son válidas. Distintos barberos pueden atender simultáneamente; el mismo staff no puede superponerse ni cambiando de branch.

El lock por organización sincroniza booking con cambios de configuración que podrían invalidarlo. La exclusión sigue protegiendo la DB independientemente de la RPC. No se pretende máxima escritura paralela dentro de una cadena grande; medir contención antes de reemplazar el lock por granularidad más fina.

## Composición

- standalone: un principal por reserva.
- additive: suma duración; puede requerir principal asociado.
- included: requiere su principal y no suma minutos/precio.
- override: sustituye duración del principal; solo un override compatible.

Duración de branch tiene precedencia sobre default. Precio puede ser null; si falta un componente con precio necesario, la reserva no recibe un total falso. SQL valida capacidades de staff para todos los servicios elegidos y hace snapshots de nombre, duración, composición, precio y moneda. El navegador nunca envía duración definitiva.

“Cualquiera” elige un staff compatible cuyo intervalo completo cabe. Orden: menor carga reservada de ese día en todas sus branches, luego UUID como desempate determinista. La exclusión protege incluso una selección concurrente. No se intenta optimización de traslados entre locales.

## Idempotencia y estados

Clave UUID, scope por organización/actor/operación y fingerprint de parámetros. El resultado se guarda en la transacción. Retry idéntico devuelve el mismo resultado; una misma clave con payload diferente falla. Retención de claves: 30 días. Eventos/jobs asociados no se duplican. Una clave vencida no es protección indefinida: integrar clientes con retries acotados.

scheduled → confirmed/checked_in/cancelled/no_show. confirmed → checked_in/cancelled/no_show. checked_in → in_service/cancelled. in_service → completed. completed es terminal. No-show exige que haya pasado el inicio; check-in/inicio/completar respetan ventanas y coherencia temporal. El SQL es la máquina de estados autoritativa.

Reprogramar mantiene el ID de cita y vuelve a scheduled, con evento/history rescheduled y snapshots anteriores seguros. `rescheduled` está reservado como estado terminal para imports/admin futuros; no se crean dos citas activas por una reprogramación. Cancelled/no_show/completed no bloquean futuras reservas, sin borrar historia.

Walk-in asignado crea cita source walk_in, mantiene mismo customer y enlaza queue→appointment. Su evolución sigue la cita. Completar calcula regreso por preferencia del cliente, principal/override, mediana del histórico suficiente o configuración organizacional; servicios marcados con mantenimiento reciben retorno específico. Rebooking enlaza nueva cita al completed original; barber puede hacerlo solo para cliente relevante y su propio recurso.

Booking público retorna referencia aleatoria, fechas y duración; no incluye customer/staff/organization IDs. La referencia no concede API de lectura o cancelación pública. V1 confirma registro y deriva cambios posteriores a recepción; el portal de autogestión firmado puede añadirse más adelante.
