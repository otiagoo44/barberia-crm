# Activación cloud 17:17 — 24/10/2026

Estado: **bloqueada para operación comercial**. No confundir acceso MCP, CI, HTTP 200 o publicación de código con estos controles.

## Inspección real

Se verificó `get_project_url`: `https://tbcfhagteyqufjkmbxzz.supabase.co`. Primera consulta: `scripts/inspect-1717.sql` en transacción read-only; el transporte devolvió únicamente el último SELECT. Se complementó con SELECT de JSON agregado también read-only.

- Historial cloud: 34 migraciones, última `20261022162330_ux_reporting_breakdown`. Local inicial: 37. Pendientes iniciales: 35/36/37. Las nuevas se registran en el cierre de esta ejecución. No se aplicó DDL productivo.
- Organización: `db03ca0c-48cc-46d2-bcbe-86c6ba8525d4`, `1717-barberia`, PYG/America/Asuncion, activa.
- Luque: `1c10857c-c9da-442a-a1cb-46edd114832d`, activa.
- Esteban staff: `7b161038-cc4c-49ef-8505-6f63a1cb8998`. Jonatan staff: `a66354c2-2bdf-46cb-98e4-fd6389d8fd7c`. Ambos activos, `profile_id=null`.
- Las dos direcciones confirmadas no existen en Auth; no hay email verificado, membresía personal ni MFA que certificar. Existe otra membresía owner inicial; no se la confundió con ellos ni se la suplantó.
- Cinco servicios actuales: corte, barba, cejas, lavado y rulos. No figuran todavía combo rulos/corte ni tintes confirmados. Sin reglas semanales ni excepciones. No se afirma que el catálogo/horario nuevo esté guardado.
- Horario público realmente almacenado: lunes a sábado **08:00–21:00**, sin fila de domingo; todavía difiere del nuevo 09:00–21:00 confirmado. Ambos profesionales tienen asignación activa a Luque. Sin ausencias/cierres, citas ni sesiones de caja. `finance_settings` usa equal_profit_share con los dos staff y adelantos no deducibles; no existe todavía la política nueva de cobros.
- Cero checkouts, pagos, gastos o períodos de distribución. Ninguna política societaria registrada.
- Flag organización de booking=true, flag Luque=false: booking efectivo de Luque cerrado. El generador conservador exige revisar/apagar explícitamente el flag de organización con un owner antes de aplicar el plan; no lo cambia silenciosamente.
- `list_branches`: ninguna rama de Supabase. El usuario confirma que no existe staging.
- Se intentó preparar `staging-1717-release-20261024`; el servidor exigió un ID de confirmación de costo y no creó la rama. Tras informar el costo documentado y la falta de herramientas de confirmación en el conector, el usuario decidió expresamente **dejar staging pendiente**. No se vuelve a intentar ni se contrata recurso alguno.
- Advisors: ningún ERROR; WARN de protección de contraseñas filtradas deshabilitada; INFO deny-by-default de tablas privadas. No se debilitó RLS.

## Acceso e infraestructura

Vercel CLI verificó proyecto `prj_5T3VMAuA8qXr3G6zzDSc94pHMpCQ`, equipo `team_fHImRjkE8m0NyoHDOZHtaNH1`, owner `ortegatiago733-2656s-projects`. El conector Vercel devolvió 403 de scope; se usó la CLI autenticada del mismo equipo, sin cambiar protecciones. Deployment inicial READY `dpl_5dJdAK2497kwpUCyFJGJ3HqZVj1f`; el cierre registra el SHA de la publicación final cuando exista.

## Pasos pendientes concretos

1. Crear un staging independiente autorizado, sin datos reales, con secretos propios y redirects locales/de preview. No usar otro proyecto existente ni apuntar un preview a producción. No se compró un proyecto/plan.
2. Confirmar respaldo recuperable, almacenamiento, retención y RPO/RTO. Ensayar restore en destino aislado y documentar qué incluye Auth/Storage. El restore de CI no es restore cloud.
3. Ejecutar las migraciones pendientes en staging, instalación limpia/upgrade, advisors, pruebas Auth/finanzas y restore. Comparar las 34 versiones remotas con archivos antes de aplicar solo lo pendiente a producción. No reset, onboarding, seed ni backfill comercial cloud.
4. Configurar SMTP. Remitente confirmado: `dentalcrmauth@gmail.com`; usuario/proveedor y credencial aún no suministrados. Si se usa Gmail: configurar SMTP y contraseña de aplicación directamente en el dashboard, nunca chat ni Git. En [Supabase → Auth SMTP](https://supabase.com/dashboard/project/tbcfhagteyqufjkmbxzz/auth/smtp) completar host/puerto/usuario/credencial y remitente. Validar la configuración con la documentación del proveedor; no asumir que solo escribir el correo habilita envíos.
5. En Auth URL Configuration: Site URL `https://barberia-crm-kappa.vercel.app`. Redirects exactos usados por el código: `https://barberia-crm-kappa.vercel.app/auth/callback` y `https://barberia-crm-kappa.vercel.app/auth/callback?next=reset-password`; la segunda ruta conduce a `/reset-password`. Comprobar confirmación y recovery entregados a ambos, enlaces de un uso. No autoconfirmar por SQL ni desactivar MFA.
6. Cada propietario se registra/recupera su cuenta, verifica correo y configura MFA y respaldo. El actor owner operativo autorizado asigna `organization_owner` y vincula staff mediante migración 37. No asignar platform_admin ni compartir sesiones.
7. Con owner AAL2 auténtico, revisar flags y ejecutar el generador de configuración con los UUID anteriores, fecha local prospectiva y plan revisado. Debe abortar frente a excepciones dominicales, pausa incompatible, citas o configuración conflictiva, conservando historia. Inspeccionar antes/después y verificar ocho servicios, seis jornadas públicas 09–21 y 18 segmentos individuales.
8. Resolver contrato POS, precios compatibles y elegibilidad de anticipos reembolsables con la contadora; configurar la nueva política versionada deshabilitada. No fabricar saldo inicial cero si hay pérdidas previas.
9. Probar alertas con receptor real, piloto de ambos owners y entrega de avisos en staging. Cada socio debe aprobar la activación sobre la misma evidencia externa. No ejecutar esa activación mientras falten gates.

El código puede publicarse cerrado: la API bloquea mutaciones societarias de 17:17 si la base no anuncia `cash_schema_version=1`; la UI explica el upgrade pendiente. El diagnóstico de horarios informa error de lectura si aún falta su RPC. No hay activación automática al hacer merge.
