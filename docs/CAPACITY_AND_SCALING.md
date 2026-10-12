# Capacidad y escalado

## Definición

`available_staff_minutes`: medida de intervalos configurados efectivos antes de restar reservas; intersección branch/staff, excepciones, cierres y time off. `booked_staff_minutes`: duración de scheduled/confirmed/checked_in/in_service/completed. `completed_staff_minutes`: duración de completed. Utilización = booked/available ×100 cuando capacidad es conocida y >0.

Es capacidad planificada, no fichaje ni medición de presencia física. Los snapshots de intervalos conservan la configuración observada. Para días históricos sin snapshot oportuno se devuelve capacidad desconocida, nunca un denominador inventado a partir del horario actual. Cambios de configuración pueden variar la estimación del día en curso.

Daily metrics por branch/staff/día, servicios y actividad de cliente se recalculan desde citas/snapshots. Organizaciones y branches agregan las mismas filas mediante vistas invoker, sin tablas duplicadas de totales. Los dos días recientes son live; días anteriores usan agregados. Jobs de cambio/rebooking recalculan también fecha/branch anterior y la visita completed original. Los snapshots son append-only.

Vista de agenda permite identificar huecos por horario; reportes comparan uso por branch/staff/día. No se implementa un optimizador automático de dotación ni de viajes. Estimación walk-in es el primer hueco compatible según citas actuales, no simulación garantizada de toda la fila ni SLA de atención.

## Lecturas y límites

Clientes 50 por página, cursor `(created_at,id)`; historial 30 lazy; configuración 100 por página; agenda rango ≤8 días, ≤2000 citas con indicador de truncamiento. Reducir rango/filtros si se supera. Disponibilidad se consulta por día y servicio, no histórico completo. Dashboard período máximo 366 días. Los selects de catálogo/configuración usan límites; no descargan clientes históricos.

Índices cubren tenant+fecha/branch/phone/retorno, rangos staff/branch/customer y búsqueda trigram de nombres. Se agregaron únicamente FKs sin índice cubriente y queries reales. El benchmark incluye EXPLAIN ANALYZE BUFFERS del phone prefix. Revisar planes con volúmenes reales antes de agregar índices adicionales.

## Resultados medidos

Ver [load-results.json](verification/load-results.json): escenarios 10/50/100 tenants, dos branches, cinco staff, 100 customers y 100 appointments por tenant, más reservas durante prueba. 100 muestras por workload, concurrencia 10 por workload y cinco workloads simultáneos (hasta 50 requests SQL). Registra CPU/RAM/Node y percentiles.

Son resultados de PostgreSQL 17 nativo en Windows. Incluyen queries frías, compilación de planes y contención de la máquina; no incluyen Data API, red administrada, frontend ni Realtime. **No hay capacidad de producción certificada** ni prueba de millones de clientes. Las latencias p95/p99 elevadas en frío son una limitación conocida; usar warmup, EXPLAIN de funciones y pruebas HTTP en staging antes de crecimiento importante.

Las lecturas de agenda/clientes reutilizan autorización viva dentro del request para reducir consultas por fila. La seguridad permanece cubierta por los contratos. Un lock por tenant serializa cambios críticos; organizaciones distintas no comparten ese lock. Medir espera de locks en cadenas con alto tráfico.

## Operación observable

Observar DB connections/espera del pooler, CPU, RAM, tamaño DB/índices, queries lentas, locks, p95/p99 de HTTP, Realtime connections, invocaciones worker/Edge si se agregan, error rate, oldest pending job, queue depth, retries/dead y awaiting_configuration. Correlacionar request_id con audit/event/logs.

Health `/api/health` verifica proceso; `/api/health/ready` verifica acceso al gateway/schema. No demuestra SMTP/WhatsApp/backups. SSE dura como máximo cuatro minutos y reconecta con refetch acotado; los canales se cierran al salir. Una vista de recepción con agenda y cola puede abrir dos canales independientes; medir coste de conexiones/invocaciones en staging. Realtime carga y fallback bajo pérdida de red requieren prueba administrada específica.


## Continuación financiera — 12/10/2026

Tres agregados diarios recalculan solo branch/fecha afectada. Ledger conserva autoridad. Movimientos 50/máximo100, rango3660d, export máximo9999filas. Import1500movimientos/8MB comprimidos, límites XML/ZIP y transacción por batch. Lock tenant asegura snapshots concurrentes; medir latencia antes de cambiar granularidad. No inferir rendimiento cloud.
