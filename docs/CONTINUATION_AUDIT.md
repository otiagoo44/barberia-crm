# Reauditoría de continuación

Base: commit `922df3e`, 12 de octubre de 2026. Inspección antes de modificar el producto.

- Se conservan Next, TypeScript, las 15 migrations, RPC de reservas, EXCLUDE GiST, snapshots, tenant/branch scopes, outbox, SSE y cookies HttpOnly.
- Baseline ejecutado: lint y typecheck sin errores; 5 unit tests y 47 contratos PostgreSQL aprobados, incluyendo 100 reservas concurrentes y 100 retries. Las 15 migrations se aplicaron desde cero en PostgreSQL aislado.
- E2E existente: un test público de login/responsive y tres tests de Auth/negocio que requieren Supabase local. Docker no está disponible en PATH; no deben contarse como aprobados al omitirse.
- Supabase MCP apunta a `tbcfhagteyqufjkmbxzz`, igual que `.env.local`. Hay 35 tablas públicas y 4 privadas, todas con RLS; cero usuarios, organizaciones y citas.
- Remoto: 14 migrations. Falta `20261012184839_customer_detail_branding.sql`. No se sustituye historial remoto ni se resetea la base.
- La vista invoker `visits` recibió grants INSERT/UPDATE/DELETE por defaults administrados; tablas subyacentes siguen sin writes y con RLS. Se revocarán explícitamente los grants de la vista.
- Advisors iniciales: solo cuatro INFO por tablas privadas sin policy, intencionalmente inaccesibles. Cero WARNING/ERROR de seguridad.
- Finanzas no están implementadas: el dashboard muestra producción estimada, no cobros. El rol finance existe en DB pero está excluido del editor de membresías y del tipo de rol.
- Booking público/interno y walk-ins comparten el mismo motor; no se duplica. Consulta pública resuelve slugs a IDs, compone precios/duración en servidor y valida capacidades.
- Automatizaciones: notificaciones internas y rebuilds funcionan; proveedores externos quedan `awaiting_configuration`.
- CI contiene quality, Supabase local, restore y browser. La consulta inicial de runs para el commit base no devolvió ejecuciones; no se afirma CI verde.
- Vercel tiene cron de un minuto sin evidencia del plan contratado. Preview/Production no están vinculados todavía.

## Evidencia de planilla y landing

Se encontró `C:/Users/User/Downloads/Barberia 17_17.xlsx`, SHA256 `cda0fd0f0b7d708a7cea2213f089af12f19bf86eec308ee751e155939312d991` (verificar el hash con el dry-run; no copiar datos personales al repositorio). No se encontró inicialmente la copia `(1)`. Se utiliza la copia encontrada para análisis estructural mientras se solicita la ruta exacta.

Cuatro hojas: Registro Diario, Cierre Diario, Resumen General, Configuración. Hay 539 filas con tipo de movimiento. La fila 110 dice egreso pero contiene 40000 en Ingresos y Egresos vacío: se excluye hasta revisión. Hay conceptos con espacios, clientes sin nombre, importes variables para corte y comisiones calculadas con fórmulas. Los derivados I:K y resúmenes no se importan.

Landing `C:/htdocs/1717barber`: tiene modificaciones ajenas activas, incluyendo un adaptador de booking nativo en construcción; se preservan. Su contrato exige `website_booking_version: 1`, `website_category` y `consultation_required`. Rulos requiere evaluación previa. Tinte editorial actual no tiene precio; la discrepancia anterior de 200000 frente a global 250000/mechas 180000 queda documentada y no se resuelve inventando un precio.

## Diseño antes de migrar

Finanzas operativas, sin ERP fiscal. Venta, pagos, comisiones, gastos, caja y liquidaciones son fuentes separadas con referencias compuestas. Dinero bigint en unidades mínimas con límite seguro para transporte JSON; tarifas enteras en basis points. Redondeo half-up por pago/línea, calculado en PostgreSQL mediante numeric exacto.

Checkout draft toma snapshots de appointment_services; completar no cobra. Pagos parciales/split se reciben por RPC, sumatoria nunca supera total. Post exige igualdad exacta; una sola venta activa por cita. Reglas con vigencia no solapada; snapshots inmutables al cobrar/postear. Reglas ausentes producen desconocido, nunca una comisión inventada.

Caja usa entradas append-only por cobro/egreso/movimiento. Saldo esperado deriva de apertura más movimientos; cierre sella snapshot y exige motivo de diferencia. Correcciones/refunds generan contramovimientos en caja abierta actual y referencias al original, preservando cierres anteriores.

Comisiones, adelantos descontables, salarios y liquidaciones se contabilizan separadamente. Una liquidación reserva entradas/adelantos, requiere revisión y pago, y queda sellada; correcciones posteriores son ajustes. Adelantos/liquidaciones no duplican gasto operativo de la comisión devengada.

Agregados se regeneran solo para fechas/branches afectados, en la transacción financiera. Reportes leen agregados y consultas acotadas de identidad/pendientes, no todo el ledger. Cierres tienen snapshots; reportes normales son recalculables.

Importación: upload, preview normalizado con IDs explícitos, revisión de anomalías, confirmación y transacción idempotente. Se preserva provenance por fila. Nunca se usa nombre como identidad de cliente ni fórmulas como fuente; reglas actuales no prueban vigencia histórica. Dry-run no escribe remoto.
