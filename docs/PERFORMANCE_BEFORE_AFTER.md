# Rendimiento medido

## Método y baseline

Primero se instrumentó el producto sin modificar src/supabase, en `9593af0` (árboles de producto del HEAD inicial b7d5cfd). CI 39851036263 ejecutó Auth/E2E y capturas reales; quality falló por lint del nuevo instrumento, no por un fallo del producto. Ese lint se corrigió; no se cuenta el workflow completo como aprobado. Artefacto 12457429399, `performance-before.json`. SHA de checkout sintético de CI: 99c6a6afd2b270e17fe25dde207e114a925f734d.

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

`tests/load/critical.ts`: esquemas 34/35, 2000 clientes sintéticos, 250 cobros reales de fixture por RPC, 20 muestras seriales y EXPLAIN ANALYZE/BUFFERS por dashboard, agenda, disponibilidad, clientes, caja, movimientos, gastos, cierres, reportes, distribuciones deshabilitadas y catálogo público. Planes directos complementan los nodos opacos de funciones PL/pgSQL; no se afirma haber visto cada plan interno. `test:load` mantiene sus escenarios 10/50/100 tenants y concurrencia. Todo es PostgreSQL aislado, separado de HTTP, Supabase administrado y Realtime cloud.

No se eliminan constraints, locks ni autorizaciones; no se agregan índices sin un coste comprobado. La migración 35 solo cambia un DEFAULT de marca para futuras organizaciones. La comparación final y las limitaciones observadas se completan con los artefactos del candidato verificado.
