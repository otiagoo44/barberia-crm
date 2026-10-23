# Rendimiento medido

## Método y baseline

Primero se instrumentó el producto sin modificar src/supabase, en `9593af0` (árboles de producto del HEAD inicial b7d5cfd). CI 39851036263 ejecutó Auth/E2E y capturas reales; quality falló por lint del nuevo instrumento, no por un fallo del producto. Ese lint se corrigió; no se cuenta el workflow completo como aprobado. Artefacto 12457429399, `performance-initial.json`. SHA de checkout sintético de CI: 99c6a6afd2b270e17fe25dde207e114a925f734d.

| Pantalla | GET iniciales | Duplicadas | Listo p50 (ms) | API p95 (ms) |
|---|---:|---:|---:|---:|
| Inicio | 6 | 0 | 1050.09 | 354.46 |
| Agenda | 5 | 0 | 1024.91 | 352.27 |
| Clientes | 1 | 0 | 510.76 | 259.18 |
| Caja | 2 | 0 | 1005.13 | 412.67 |
| Finanzas | 4 | 0 | 1026.90 | 361.72 |
| Equipo | 4 | 0 | 629.21 | 357.50 |
| Reportes | 3 | 0 | 1027.32 | 385.83 |

Cinco muestras por módulo: p95/p99 son máximos de una muestra pequeña, no un SLA. «Listo» incluye navegación, render y espera de las API; no se etiqueta como tiempo exclusivo de hidratación. TTFB, DCL, transferencia, long tasks y Event Timing sintético están en el JSON. No es INP de usuarios reales ni capacidad cloud.

## Decisiones respaldadas

No se observaron duplicadas en el muestreo inicial. No se incorporan SWR, TanStack Query ni un caché de respuestas. `useResource` conserva no-store; su identidad incluye cuenta/tenant/rol/sucursal, URL y revisión. Al cambiar scope o filtros y al revalidar, no expone el resultado anterior como actual. Abort y comprobación de identidad impiden publicar respuestas tardías. Una mutación exitosa invalida lecturas montadas; logout/401/403 vacían datos. No hay persistencia comercial en localStorage.

Se difiere el catálogo de Caja hasta registrar un gasto, y la lectura de caja de Finanzas hasta abrir una operación. La guía plegada de Inicio no consulta un diagnóstico que el usuario no abrió. El formulario muestra carga/error inmediatos al necesitar datos diferidos. Se conserva búsqueda/paginación, charts diferidos y cleanup de SSE.

## Comparación controlada y SQL

El workflow del candidato vuelve a construir el SHA inicial b7d5cfd en un checkout aislado, sobre el mismo runner y los mismos datos de Supabase local. Usa la misma instrumentación para antes/después. El build React `--profile` se mide por separado: su overhead no se compara como latencia productiva. No se atribuyen diferencias pequeñas a una causa sin evidencia.

`tests/load/critical.ts`: esquemas 34/36, 2000 clientes sintéticos adicionales (2003 totales), 250 cobros reales de fixture por RPC, 20 muestras seriales y EXPLAIN ANALYZE/BUFFERS por dashboard, agenda, disponibilidad, clientes, caja, movimientos, gastos, cierres, reportes, distribuciones deshabilitadas y catálogo público. Planes directos complementan los nodos opacos de funciones PL/pgSQL; no se afirma haber visto cada plan interno. `test:load` mantiene sus escenarios 10/50/100 tenants y concurrencia. Todo es PostgreSQL aislado, separado de HTTP, Supabase administrado y Realtime cloud.

No se eliminan constraints, locks ni autorizaciones; no se agregan índices sin un coste comprobado. La migración 35 solo cambia un DEFAULT de marca para futuras organizaciones. La 36 evita recalcular por cliente el mismo brazo owner del guard en dos contadores; conserva los guards vivos dentro de la sentencia y la comprobación por fila para otros roles. La equivalencia exacta está probada en dashboard-upgrade.ts.

Primera comparación controlada aprobada: CI [39855106528](https://github.com/otiagoo44/barberia-crm/actions/runs/39855106528), artefacto sql-and-load-verification 12460025038, AMD EPYC 9V74, 4 CPU lógicas, PostgreSQL 17 embedded. Dashboard SQL: p50 **855,71 → 6,25 ms**, p95 **861,10 → 14,31 ms**, p99 **880,74 → 18,56 ms**. EXPLAIN externo: shared hit blocks 20098 → 2068. No se extrapola esa mejora a HTTP/cloud ni a roles diferentes. Los planes muestran también coste residual en scans directos bajo RLS; no se retiran políticas para reducirlo. Los p99 de veinte muestras son exploratorios.

## Comparación HTTP final del mismo runner

[CI 39874912332](https://github.com/otiagoo44/barberia-crm/actions/runs/39874912332). Ambos frontends usan el mismo Supabase local y esquema candidato; esta tabla aísla el frontend. El efecto del esquema 34/36 se mide por separado en SQL. Navegaciones completas con cinco muestras por módulo, sin SLA ni INP de campo.

| Módulo | GET antes → después | Duplicadas antes/después | Listo p50 antes → después (ms) | API p95 antes → después (ms) |
|---|---|---|---|---|
| inicio | 6/6/6/6/6 → 4/4/4/4/4 | 0/0 | 1097.95 → 999.84 | 454.23 → 384.42 |
| agenda | 5/5/5/5/5 → 5/5/5/5/5 | 0/0 | 1066.52 → 993.49 | 443.05 → 370.6 |
| clientes | 1/1/1/1/1 → 1/1/1/1/1 | 0/0 | 544.05 → 476.69 | 323.3 → 276.26 |
| caja | 2/2/2/2/2 → 1/1/1/1/1 | 0/0 | 1036.59 → 537.05 | 354.84 → 323.5 |
| finanzas | 4/4/4/4/4 → 3/3/3/3/3 | 0/0 | 1053.06 → 994.36 | 389.87 → 363.42 |
| equipo | 4/4/4/4/4 → 4/4/4/4/4 | 0/0 | 1064.65 → 709.84 | 455.48 → 360.31 |
| reportes | 3/3/3/3/3 → 3/3/3/3/3 | 0/0 | 1037 → 979.34 | 439.82 → 448.16 |

Los JSON conservan p50/p95/p99, TTFB/DCL, transferencias, LCP, long tasks, eventos sintéticos y refresco donde existe ese control. DCL no se presenta como hidratación exclusiva. No se hicieron cambios de memoización, paginación o virtualización sin coste demostrado.

Chunks estáticos totales (JS+CSS, sin comprimir, todos los módulos; no descarga de una ruta): 1401051 → 1419485 bytes. Inter QA no se importa desde src.

## SQL final aislado

Veinte muestras seriales por consulta; p99 exploratorio. Hardware: INTEL(R) XEON(R) PLATINUM 8573C, 4 CPU lógicas. 2003 clientes, 250 checkouts y 250 pagos de fixture.

| Consulta | p50 antes → después ms | p95 antes → después ms | p99 antes → después ms |
|---|---|---|---|
| dashboard | 745.21 → 6.29 | 750.95 → 12.33 | 756.06 → 17.72 |
| agenda | 2.33 → 2.35 | 2.9 → 2.77 | 3.4 → 2.87 |
| availability | 2.07 → 2.16 | 3.23 → 3.33 | 5.05 → 4.93 |
| customers | 6.82 → 6.84 | 7.92 → 8.03 | 8.53 → 8.47 |
| cash | 4.7 → 4.72 | 6.03 → 5.19 | 6.32 → 6.18 |
| movements | 28.97 → 29.05 | 29.58 → 29.5 | 30.17 → 29.5 |
| summary | 6.59 → 6.98 | 7.74 → 8.11 | 9.43 → 9.71 |
| expenses | 4.42 → 4.45 | 4.57 → 4.64 | 4.63 → 4.71 |
| closures | 4.24 → 4.45 | 4.51 → 4.56 | 4.63 → 4.85 |
| reports | 2.03 → 2.25 | 2.85 → 2.62 | 3.14 → 3.13 |
| distributions_disabled | 1.55 → 1.54 | 2.15 → 2.22 | 2.87 → 3.05 |
| public_catalog | 0.64 → 0.65 | 2.63 → 1.4 | 2.71 → 2.37 |

## React y tareas largas

Build separado con --profile y NEXT_PUBLIC_QA_PROFILE=1. Sus tiempos de navegación no se usan como build productivo ordinario. El evento de Profiler contiene solamente fase y duraciones, sin datos del negocio.

| Módulo | Commits observados (5 navegaciones) | Render p95 ms | Tareas largas en build ordinario |
|---|---|---|---|
| inicio | 110 | 20 | 5 |
| agenda | 58 | 20.8 | 0 |
| clientes | 35 | 19.7 | 0 |
| caja | 20 | 17.5 | 0 |
| finanzas | 93 | 19.9 | 6 |
| equipo | 35 | 20.5 | 0 |
| reportes | 105 | 10 | 0 |

No se infiere INP real, capacidad cloud, entrega de alertas ni latencia de Supabase administrado. El piloto y la telemetría operativa siguen pendientes. Los tiempos pequeños que fluctúan no se presentan como mejoras causales.
