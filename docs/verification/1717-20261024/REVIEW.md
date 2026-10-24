# Revisión del candidato del 24/10

Dos pasadas del mismo agente, no revisión independiente ni piloto humano. Base `295c57362d31e55c200d27b2552d3f9e8325e417`; el commit del candidato se obtiene de Git/PR para evitar una autorreferencia imposible dentro del mismo commit.

## Fronteras verificadas

- 37 migraciones heredadas intactas; 38/39 aditivas, sin DML de configuración ni fuentes JSON comerciales. Instalación limpia y upgrade desde 27/34 con historia, caja, dedupe, grants/RLS y constraints preservados.
- Política opt-in, snapshot de fuentes con hash y lock por tenant. Anticipos elegibles por UUID; POS por fecha real de banco y neto conciliado; sin segundo descuento del fee ni ingresos compensatorios.
- Doble aprobación con identidad única de los dos socios owners, AAL2/sesiones vivas y factores verificados. Revalidación de roles, bloqueo antes de pagar y concurrencia. El UUID de sesión se conserva como evidencia sin FK a una fila efímera, para permitir logout/revocación.
- Arrastre con origen/aplicación único, meses consecutivos, PYG entero, retiros personales explícitamente clasificados y aplicación parcial sin pago negativo. Una clasificación de adelanto laboral no se reinterpreta como retiro.
- Períodos congelados, prohibición de backdate, refund posterior y rechazo de propuesta obsoleta. Reintentos de pagos finalizan también la clave de idempotencia del nuevo dispatcher.
- Tabla de límites de disponibilidad vacía por defecto: el plan de 17:17 registra domingo y pausa fija con fecha prospectiva/actor real. Motor autoritativo conserva cierres, ausencias, reservas y excepciones; un override no salta la pausa. Llegada tardía sigue siendo transición manual auditada y no-show no puede cancelar un in-service.
- Código compatible en estado cerrado con cloud 34: UI avisa y API rechaza distribuciones si falta `cash_schema_version=1`. RPC de diagnóstico ausente se informa como error de lectura, no como falta de horarios. Ningún merge activa booking o distribuciones.

## Resultados locales

Instalación limpia: 260 paquetes, cero vulnerabilidades. Lint/TypeScript/build aprobados. 22 unitarias. Suite DB completa con 51 seguridad/operaciones, 19 finanzas, 23 hardening y 18 producto, más 13 contratos nuevos de cobros y bloques de onboarding/configuración/scheduler/upgrades. Hardening explícito: 23. Carga: 10/50/100 organizaciones y organización concentrada, cero errores. La máquina ejecutó tareas concurrentes; las latencias no son un SLA. `cash-explain.json` registra EXPLAIN ANALYZE del read-model con fixture pequeño; CI compara también SQL crítico inicial/candidato.

UI: 12 pruebas aprobadas; se inspeccionó la captura móvil de la nueva proyección a 360 px, además de generar 768/1440. Conserva estado de carga/error, evidencia, componentes y aprobación propia deshabilitada; ningún pago con una sola aprobación. Las respuestas están interceptadas y no prueban Auth. Los artifacts antiguos del 23/10 se restauraron; la evidencia nueva queda en esta carpeta.

E2E local: **1 aprobado / 30 omitidos** por ausencia de Supabase Auth local. No se cuentan como prueba productiva ni como CI completa. Se agregó un E2E nuevo con dos usuarios GoTrue, tokens firmados AAL2, activación explícita y aprobaciones distintas; requiere el job supabase-e2e aislado antes de merge.

## Cloud y controles externos

Inspección real: proyecto exacto, 34 migraciones, staff real sin vínculo, cinco servicios, sin reglas semanales, sin cobros/gastos/distribuciones. Ambos correos aún ausentes en Auth. Sin escrituras de configuración, DDL ni dinero en cloud. El usuario dejó staging pendiente después del requisito de confirmar costos. SMTP, MFA, backup/restore cloud, alertas, POS y piloto no se dan por comprobados.

PR/checks/merge/deployment se registran en CIERRE_FINAL_1717_2026_10_24.md al observarlos. La protección vigente exige PR y quality/supabase-e2e estrictos, sin bypass. No se ha debilitado para este release.
