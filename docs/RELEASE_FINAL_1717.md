# Release de configuración 17:17

Vigente al 24/10: [cierre actual](CIERRE_FINAL_1717_2026_10_24.md), [política confirmada](POLITICA_FINANCIERA_CONFIRMADA_1717.md), [inventario cloud real y activación](ACTIVACION_CLOUD_1717.md). Se recuperó acceso al proyecto exacto; cloud tiene 34 migraciones y ambos propietarios aún no existen en Auth. El horario público se confirmó 09–21 lunes a sábado, pausa fija y domingo cerrado. Los resultados del 23/10 siguientes son históricos y no certifican el candidato del 24/10.

## Antecedente del 23/10

## Procedencia

- HEAD al recibir la tarea: `4d2fc0df559f4bca8dbda405c78d9e98c43d6b4f`, árbol limpio.
- Main aprobado remoto: `99a4532637a2902504a994e39464206b1c0c1526`; PR #5 integrado, ningún PR abierto encontrado.
- Rama nueva: `release/1717-confirmed-20261023`, creada desde origin/main tras fetch. Se preservaron los dos commits locales de corrección/documentación mediante cherry-pick (`56f03fb`, `204b914`). No se sobrescribió trabajo en curso.
- Había **36** migraciones locales. Se agrega `20261023193417_staff_owner_profile_link.sql`; las 36 anteriores permanecen intactas.

## Configuración realmente guardada

En el repositorio: correos de ambos owners, turnos semanales, pausa provisional, catálogo completo, 200/500 bps, lead 0, reparto mensual 50/50 y gates deshabilitados. Ver CONFIGURACION_CONFIRMADA_1717.md.

Los scripts preparan SQL revisable y nunca se conectan automáticamente a cloud. `configure-confirmed-1717.mjs` exige cuatro UUID reales distintos, proyecto exacto y fecha local explícita no histórica. Requiere conexión de mantenimiento privilegiada y **contexto auténtico owner/AAL2/sesión viva**; no fabrica claims ni toma el primer owner para suplantarlo. Revalida bajo lock, conserva historia/excepciones/citas, registra versiones de precios y revierte conflictos. No ejecutar el onboarding inicial en cloud.

No se aplicó configuración, DDL, fee, membresía, período, reserva ni movimiento financiero en producción. La prueba local con fixtures se informa aparte. La periodicidad monthly está preparada en el manifiesto; no se insertó una política `confirmed=true` con acuerdos ficticios de pérdidas/aprobación.

## Supabase y usuarios

MCP ya estaba configurado al URL exacto pedido. `codex mcp login supabase` terminó **Successfully logged in**; el gestor MCP de la sesión continúa fallando al refrescar OAuth (`Failed to parse server response`). La CLI Supabase solo lista dos proyectos dentales y niega privilegios al enlazar **tbcfhagteyqufjkmbxzz**. No se eligió otro proyecto ni se extrajeron credenciales de otra aplicación.

Historial remoto actual **no verificable**: el antecedente de 34 migraciones es histórico. Hasta reconsultarlo no se afirma si 35/36 están aplicadas. Migración 37 nueva: pendiente de staging y rollout cloud. No se aplica sin backup, historial real, compatibilidad y rollback revisados.

Esteban y Jonatan: correos confirmados, existencia/Auth email/membresía/vínculo/MFA cloud **no reconsultados**. SMTP y recuperación **no verificados**. Backups/restore cloud, retención/RPO/RTO y recepción de alertas **pendientes**. La documentación histórica describe plan Free sin backups administrados; eso no sustituye una consulta actual del plan.

## Verificación

| Check local                     | Resultado actual                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                          | Aprobado, 260 paquetes instalados                                                                                                            |
| npm audit --audit-level=high    | Cero vulnerabilidades                                                                                                                        |
| npm run lint / typecheck        | Aprobados                                                                                                                                    |
| npm test                        | 22 aprobados, cero omitidos                                                                                                                  |
| npm run test:db                 | Aprobado: 51 seguridad/operación + 19 finanzas (débito 2%) + 23 hardening + 18 producto; onboarding/scheduler, upgrades y nuevo bloque 17:17 |
| npm run test:hardening          | 23 aprobados; repetición explícita de ese bloque                                                                                             |
| npm run test:load               | 10/50/100 tenants y casos concentrados, cero errores; PostgreSQL local, no SLA cloud                                                         |
| npm run build                   | Aprobado                                                                                                                                     |
| npm run test:e2e                | **1 aprobado, 29 omitidos** por ausencia de Supabase Auth local; requiere CI real                                                            |
| npm run test:ui                 | 11 aprobados tras el diagnóstico CI; UI real con respuestas interceptadas, no Auth real                                                      |
| Smoke productivo no destructivo | health/ready 200, jobs sin secreto 403, catalog 200 sin sucursales, availability 404, book 200                                               |

[Evidencia nueva](verification/1717-20261023/) y [segunda revisión de archivos](verification/1717-20261023/REVIEW.md). No se sobrescribe la evidencia histórica del rediseño. Dos errores iniciales del plan/migración fueron corregidos y se repitió la suite; el harness ahora libera la conexión incluso ante SQL fallido. Las omisiones y los mocks UI no sustituyen Auth real. CI del SHA del PR sigue siendo el gate de merge.

## Publicación observada

Vercel: proyecto `prj_5T3VMAuA8qXr3G6zzDSc94pHMpCQ`, equipo `team_fHImRjkE8m0NyoHDOZHtaNH1`. Deployment `dpl_gcTAfoQpcZsFRbgwmocorvCWEQAF`, **READY**, production, commit **99a4532**, alias https://barberia-crm-kappa.vercel.app; URL inmutable https://barberia-r1t5wg25q-ortegatiago733-2656s-projects.vercel.app.

Smoke público: health 200, ready 200 `ready:true`, worker sin secreto 403. Catalog 200 JSON con `branches:[]`; availability Luque 404; book 200 HTML. No POST productivo. No se afirma que el nuevo release esté desplegado. El helper autenticado Vercel devuelve 403 sobre aliases; no se cambian protecciones.

Estos GET no registran operaciones comerciales ni configuración; el gateway puede actualizar sus contadores internos de rate limit. El cero de mantenimiento cloud significa que no se ejecutó DDL/SQL de configuración ni mutaciones comerciales, no que una solicitud HTTP omita toda telemetría interna.

## Instalador: controles restantes

1. Recuperar acceso efectivo al proyecto Supabase exacto (MCP reiniciado y credenciales autorizadas); ejecutar `scripts/inspect-1717.sql` read-only. Registrar UUID de org/Luque/Esteban/Jonatan, 37 versiones esperadas al finalizar y estado real de servicios/reglas/excepciones/flags/cuentas. No copiar datos privados a artifacts públicos.
2. Proveer staging independiente y secretos propios; ensayar migración 37 y el plan con contexto real autorizado. Obtener backup recuperable y rollback compatibles antes de cualquier DDL productivo. Los cambios de UI son compatibles con el esquema previo: este seguirá rechazando el vínculo owner hasta migrar, sin conceder permisos indebidamente.
3. Preparar/aplicar el plan solo con esos UUID y fecha local prospectiva; comprobar versiones de precios/auditoría, historia intacta, 18 intervalos, capacidades, excepciones, pausas/cierres y citas previas. Conservar flags cerrados.
4. Completar registro, email, membresías owner y MFA de ambos según ONBOARDING_DOS_PROPIETARIOS.md; verificar Luque en teléfono/computadora.
5. Resolver SMTP/remitente/redirects y confirmar entrega/recovery a los dos destinatarios autorizados. Acordar responsable de backup/restore y alertas; ensayar recuperación/recepción.
6. Obtener evidencia POS (proveedor, vigencia, IVA/cargos). Preparar `prepare-1717-pos.mjs` con fixedAmountMinor explícitos; revisar nueva vigencia y testear split/reversal/conciliación, sin recalcular snapshots previos.
7. Preguntar únicamente los puntos pendientes de CONFIGURACION_CONFIRMADA_1717.md; registrar definición contable, retiros/pérdidas/aprobación antes de activar monthly. No distribuir ni pagar por cálculo estimado.
8. Completar piloto real de ambos y registrar evidencia. Habilitar booking solo al cerrar todos sus controles. No hacer la prueba destructiva con datos reales.

GitHub fue reconsultado: ruleset `main-quality-and-pr` **25439970 activo**, sin bypass, PR requerido y checks estrictos `quality`/`supabase-e2e`; sin aprobaciones mínimas, hilos resueltos requeridos. Git permite push de la rama (dry-run aprobado). Se publicará el candidato y se verificará la CI de su SHA; no usar force push ni alterar el ruleset. Ningún bloqueo externo se considera resuelto por la existencia de este documento.

## PR y control de publicación

[PR #6](https://github.com/otiagoo44/barberia-crm/pull/6), abierto contra main. Commit de implementación `35fff7c937da4a336eaedd1559698f0eff891d81`; los commits posteriores cierran documentación/evidencia. SHA final: consultar HEAD de esta rama y los [checks del PR](https://github.com/otiagoo44/barberia-crm/pull/6/checks).

El conector GitHub pudo leer, pero rechazó crear PR con 403 `Resource not accessible by integration`. El canal de Computer Use no estaba disponible. La API estándar creó el PR con la autenticación del proveedor normal de Git que ya había autorizado el push al mismo repositorio; ninguna credencial se imprimió, guardó en un archivo o extrajo de bases de otra aplicación. No se modificaron permisos ni protecciones.

El PR abierto no equivale a merge. Exigir CI del HEAD final, sin errores ni omisiones de Auth, y compatibilidad del runtime actual. Las migraciones/configuración privada cloud y la activación comercial siguen los controles independientes anteriores. El estado remoto definitivo debe consultarse en el PR; no inferirlo de un commit de documentación previo a la finalización de CI.

## Primera CI y corrección de layout

[Run 40015699810](https://github.com/otiagoo44/barberia-crm/actions/runs/40015699810), SHA `01cb960`: quality y visual-baseline aprobados; supabase-e2e falló con **29 E2E aprobados / 1 fallido**. Upgrade, advisors, restore real local, build y diez UI habían aprobado. No se cuentan como aprobadas las mediciones posteriores omitidas por ese fallo.

La prueba de cifras grandes consultaba el ancho inmediatamente después de cambiar viewport. Reproducción con componentes reales y respuestas sintéticas: Recharts medía temporalmente 598 px en viewport 360 y se ajustó a 360 después de ResizeObserver. El E2E conserva la exigencia de ancho exacto, espera su cumplimiento y adjunta diagnóstico si persiste. No se oculta overflow ni se reduce el tamaño mínimo de cifras.

Además, la captura real mostró que la cabecera móvil de altura fija 70 px tenía contenido hasta 112 px y tapaba el main. `height:auto` conserva el wrap del rediseño y reserva el alto real (123 px a 360/390). La nueva regresión comprueba scroll exacto y que los hijos queden dentro de la cabecera en cinco anchos. Once UI aprobados, lint/typecheck/build repetidos; revisión Impeccable y checklist React aplicados. Evidencia antes/después y captura de CI en `verification/1717-20261023/`. El merge requiere la nueva CI del HEAD corregido.
