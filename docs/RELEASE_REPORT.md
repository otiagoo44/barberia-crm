# Informe de continuación — 15/10/2026

## 1. Estado antes de continuar

`main` tenía tres commits locales sin subir, con finanzas y la integración nativa de reservas ya implementadas. El último intento había fallado en una prueba de atención dependiente de la hora UTC. Supabase tenía 14 migrations, una cuenta Auth y cero organizaciones/citas. Vercel tenía el proyecto conectado a GitHub pero sin deployments ni variables.

## 2. Qué se conservó

Next.js/TypeScript, las quince migrations originales, el motor único de reservas, GiST contra solapamientos, snapshots, permisos por tenant/branch, RPC transaccionales, audit/outbox, sesiones HttpOnly y CSP. Se integran los tres commits pendientes; no se reemplaza historial remoto ni se importan fixtures al cloud.

## 3. Nuevas migrations

Se aplicaron las seis pendientes: customer_detail_branding, website_booking, finance_schema, finance_transactions, finance_read_import y booking_finance_hardening. Tres adicionales de esta revisión: `20261015190206_booking_attribution_rls.sql`, `20261015190657_consolidate_financial_audit_policy.sql` y `20261015191802_worker_tick_record_scope.sql`. Las versiones remotas se alinean con los archivos CLI y la instalación desde cero se verifica en PostgreSQL aislado. La última evita el choque entre records PL/pgSQL y aliases SQL en el scheduler, detectado al invocar el endpoint real.

## 4. Nuevas tablas

El esquema financiero incorpora configuración/métodos/reglas POS, reglas de comisión, items/categorías, ventas/líneas/pagos, gastos, comisiones, adelantos/salarios/liquidaciones/ajustes, cajas/movimientos/cierres, batches/filas de import y agregados diarios financieros. [Inventario y DDL](SCHEMA.md). La base revisada tiene 67 tablas de aplicación; todas tienen RLS.

## 5. Nuevas RPCs

`finance_command`, `finance_read`, `finance_import`, `financial_export` y operaciones acotadas de checkout, pagos, gastos, caja, adelantos, salarios, liquidaciones, ajustes y reversals. Wrappers públicos invoker y helpers privados con validación de identidad/tenant/branch/rol/estado. [Contrato](FINANCE.md).

## 6. Matriz RLS financiera

| Rol | Alcance |
| --- | --- |
| Owner | Finanzas de su tenant |
| Finance | Finanzas del tenant; sin administración de usuarios/seguridad |
| Manager | Branches autorizadas |
| Receptionist | Checkout/cobro/caja/gasto operativo autorizado; sin comisiones/reportes globales |
| Barber | Lectura pertinente a su propio staff |
| Anon | Sin acceso a tablas financieras |

Sin writes directos desde navegador. La política de lectura de auditoría conserva la unión exacta de permisos anteriores en una sola evaluación para authenticated. [Matriz completa](RLS_MATRIX.md).

## 7. Checkout

Desde cita completada o venta manual, snapshot de servicios/items/precios/barbero; pagos parciales o divididos. Post exige suma exacta, calcula snapshots server-side y evita doble venta de la misma cita. Un split inválido revierte completo. Walk-ins usan el mismo checkout. Al cobrar se ofrece volver a la agenda/rebooking.

## 8. Caja

Apertura por branch/caja; movimientos append-only. Esperado = apertura + entradas efectivo − salidas ± correcciones. Cierre calcula snapshot, compara contado y exige motivo de diferencia. Reapertura crea sesión vinculada; no modifica el cierre original.

## 9. Comisiones

Reglas por staff/servicio/branch y vigencia; redondeo exacto y snapshot al postear. Cambiar reglas no cambia el histórico. Sin regla demostrable, cálculo unknown. Fees POS se guardan por pago y separados de la comisión.

## 10. Adelantos y liquidaciones

Adelanto descontable solo según política explícita; salario separado. Liquidación reserva comisiones/adelantos/ajustes una vez y pasa por draft/reviewed/paid/closed. Correcciones mediante ajustes/contramovimientos, sin editar ventas ni cierres históricos.

## 11. Mapping del XLSX

Registro Diario A:H: fecha, staff, etiqueta persona, concepto, tipo, ingreso, egreso y método. Identidades mediante IDs y mapping explícito; no se crea cliente por nombre. Archivo/hoja/fila/raw/batch conservados. Fórmulas y resúmenes ignorados. [Procedimiento](FINANCE_IMPORT_1717.md).

## 12. Anomalías que no se importaron

Dry-run anterior: 539 movimientos, 535 estructuralmente válidos y cuatro NEEDS_REVIEW: fila 110 egreso colocado en ingresos; 194 y 330 sin método; 463 sin concepto. No se importó ningún movimiento al cloud. Fees/comisiones históricas sin evidencia quedan unknown. Tinte global/mechas y sus duraciones requieren reconciliación con el owner.

## 13. Tests reales

`npm ci` y audit: cero vulnerabilidades. Lint/typecheck y catorce tests unitarios pasan. PostgreSQL aislado: 51 contratos de reservas/seguridad y 19 financieros; incluyen 100 solicitudes concurrentes, idempotencia, snapshots, cierres y permisos. Browser local: login/responsive/headers/teclado aprobado; cuatro casos con Auth real omitidos por falta de Docker local. QA de booking: doce combinaciones de query/viewport y envío con API interceptada aprobados. No equivalen a una reserva comercial real. Gateway cloud devuelve ready; lectura anónima de payments rechazada con 42501.

## 14. Build

Build de producción completado. Prebuild de Vercel valida origen HTTPS, variables, secretos distintos y base correcta; la validación tiene tests para Production/Preview y mantiene CI/local aislados.

## 15. CI

Se conserva el workflow completo de quality, Supabase local con Auth real, restore financiero y navegador. La [primera ejecución de esta continuación](https://github.com/otiagoo44/barberia-crm/actions/runs/38792012187) detectó dos fallos del entorno de verificación: sockets de PostgreSQL pendientes al apagar el servidor Linux y restore de funciones administradas de Realtime con parámetros privilegiados. Se corrigieron esperando los cierres reales y delimitando el backup de aplicación/Auth, conservando pruebas RLS, financieras y de concurrencia. El resultado de la siguiente ejecución se registra al finalizar; no se considera verde por controles locales.

## 16. Supabase advisors

Advisors: cero ERROR; rendimiento sin WARN después de consolidar audit_logs. Seguridad conserva un WARN por protección contra contraseñas filtradas, pendiente de configuración de Auth; la función requiere Pro o superior según [Supabase](https://supabase.com/docs/guides/auth/password-security). No se cambia de plan automáticamente. Los INFO de tablas privadas sin policies son deny-by-default intencional; índices sin uso son esperables sin negocio/tráfico.

## 17. Configuración de Vercel

Proyecto `barberia-crm`, GitHub `otiagoo44/barberia-crm`, Production Branch `main`, Node 24.x, npm ci/build. Dominio verificado `https://barberia-crm-kappa.vercel.app`. El push disparó un deployment READY; `/login`, `/api/health` y `/api/health/ready` respondieron 200. Nueve variables de Production configuradas; booking/worker/cron como secretos privados. Preview solo tiene sus dos controles de aislamiento y falla cerrado hasta configurar staging separado. Equipo Hobby: cron por minuto requiere scheduler externo; no se configura un cron incompatible. [Guía exacta](VERCEL_DEPLOYMENT.md).

## 18. Onboarding de 17:17

Confirmar propietario registrado y bootstrap admin; crear organización `1717-barberia` y branch `luque`, timezone America/Asuncion, PYG y dirección confirmada. Crear staff Jonatan/Esteban sin cuentas inventadas, confirmar capacidades/horarios, servicios/composición/precios/duraciones, reglas POS/comisiones/adelantos. Ensayar operación en staging. Revisar preview del XLSX y recién entonces confirmar import. Activar catálogo y configurar la landing con dominio/slugs reales. [Pasos completos](NEW_ORGANIZATION_ONBOARDING.md).

## 19. Pendientes reales

Base/secretos propios de staging; scheduler externo; SMTP/redirects y recuperación; protección de contraseñas filtradas; backup/restore cloud con RPO/RTO; owner, horarios, capacidades y reglas confirmadas; onboarding e import revisado. La cuenta Auth existente no recibió privilegios de plataforma automáticamente. No se habilitan reservas de 17:17 sin configuración real.

## 20. Veredicto

Código preparado para desplegar y validar en staging; la publicación técnica de Production tiene configuración preparada. **Todavía no habilitado para piloto con clientes reales**: completar los pendientes operativos anteriores y verificar CI/deployment del commit publicado. Un build o push no demuestra operación, SMTP o recuperación cloud.
