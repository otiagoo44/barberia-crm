# Continuidad — cierre de auditoría del 19/10/2026

Leer primero este archivo y [FINAL_HARDENING_AUDIT](FINAL_HARDENING_AUDIT.md). Continuar sobre el main actual; no reconstruir ni cambiar la arquitectura Next.js + Supabase + PostgreSQL.

## Entregado

- Auditoría/correcciones integradas a main mediante [PR #1](https://github.com/otiagoo44/barberia-crm/pull/1), merge `4f45b35bdafd067d810bfe535280a9cb95f9e5dd`. Commits de implementación `be7ce5a` y evidencia `e04a01a`.
- [CI del candidato final](https://github.com/otiagoo44/barberia-crm/actions/runs/39339185426) aprobada: quality y supabase-e2e. 16 unitarias, 93 contratos PostgreSQL (51 seguridad + 19 finanzas + 23 hardening), onboarding/reparto/scheduler y 13 E2E con Auth real, sin skips. [CI del merge de main](https://github.com/otiagoo44/barberia-crm/actions/runs/39359960462) también aprobada: ambos jobs success. Verificar nuevamente la CI del SHA vigente al retomar.
- Vercel desplegó automáticamente ese merge en el target production: `dpl_BuGYvc4gFtjoXqzFGUxuYufnoUkt`, estado READY, SHA `4f45b35bdafd067d810bfe535280a9cb95f9e5dd`, URL `https://barberia-kq49ec2oo-ortegatiago733-2656s-projects.vercel.app`. Alias principal confirmado en inspect: `https://barberia-crm-kappa.vercel.app`. GET por CLI autenticada del 19/10 23:41 PY: `/api/health` 200 JSON ok, `/api/health/ready` 200 JSON ready:true, `/api/jobs` sin secreto 403 JSON. Esto publica las correcciones con reservas cerradas; no certifica madurez operativa de producción.
- Supabase `tbcfhagteyqufjkmbxzz`, URL `https://tbcfhagteyqufjkmbxzz.supabase.co`, **27 migraciones** alineadas. Nueva `20261019223415_final_authorization_hardening` aplicada; no volver a ejecutarla ni editar migraciones aplicadas. MCP asignó inicialmente 20261019230245 y se alineó únicamente esa clave de metadata con el archivo, sin repetir DDL.
- Corregidos: bypass comercial de platform_admin, revocación concurrente, retención de claves financieras, preview/hash de importación, scopes finance, minimización de settings, límites SQL NULL, FKs tenant/event, upload para Vercel, borradores al cambiar sucursal, etiquetas del reparto, texto y fecha inválida.
- Owner real mantiene lectura autorizada: prueba SQL con rol authenticated, dos socios y ventas cero; transacción revertida sin writes. Cero tablas public/app_private sin RLS, dos nuevas FKs validadas, un cron activo y booking cerrado en organización/sucursal.
- Ruleset main **25439970** activo: PR, quality y supabase-e2e de GitHub Actions obligatorios, rama actualizada, conversaciones resueltas; sin bypass, force-push ni borrado. Cero aprobaciones humanas obligatorias hasta contar con otro revisor confirmado. Configuración en [.github/rulesets/main.json](../.github/rulesets/main.json).
- Restore local Docker financiero pasó en CI: [evidencia](verification/restore-final-local.json). No representa restore cloud ni RPO/RTO reales. Benchmark [SQL 10/50/100 organizaciones y carga concentrada](verification/load-results.json), sin certificar capacidad HTTP cloud.
- XLSX original conserva SHA256 `cda0fd0f0b7d708a7cea2213f089af12f19bf86eec308ee751e155939312d991`: 539 movimientos, 535 READY y cuatro a revisar (110/194/330/463). No se importó a cloud ni se subió el archivo a Git.

## Decisiones que se mantienen

17:17 tiene dos socios, Jonatan y Esteban, mismos servicios, disponibilidad cargada por día y **equal_profit_share 50/50**. No reemplazarlo por comisiones por corte. El resultado positivo se basa en ventas posteadas/reversiones menos fees, gastos operativos incluidos salarios y comisiones de otros barberos. Reparto mostrado = estimación, no pago. [Diseño mínimo de pagos/saldos](PARTNER_DISTRIBUTIONS_DESIGN.md), aún sin implementar; acordar período, retiros y aprobación antes de hacerlo.

Rulos sigue requiriendo consulta; no abrirlo por query params ni habilitar reservas públicas sin gates. Un solo scheduler PostgreSQL `barberia-internal-worker`; `/api/jobs` es fallback manual con secreto, no agregar otro scheduler. Proveedores externos permanecen awaiting_configuration. Sin seeds ficticios, historia financiera reescrita ni service role comercial.

## Pendientes para finalizar la habilitación

**Veredicto: LISTO PARA STAGING; NO LISTO PARA PRODUCCIÓN.** Publicar código en main/Vercel no abre reservas ni completa estos controles.

1. **SMTP y recuperación:** el usuario decidió configurarlo después. Remitente deseado `dentalcrmauth@gmail.com`, sin dominio propio. Configurar proveedor directamente en Supabase; si usa Gmail: smtp.gmail.com:587 y contraseña de aplicación guardada solo en dashboard. Probar signup/recovery y enlaces/redirects. No pedir ni pegar claves en chat/Git.
2. **MFA privilegiado:** falta enrollment/challenge TOTP y enforcement AAL2 probado para owner/finance/plataforma, además de MFA de proveedores y recuperación/break-glass.
3. **Staging independiente:** provisionar destino real autorizado, secretos propios y Auth redirects. Preview falla cerrado sin SUPABASE_ENVIRONMENT=staging y proyecto distinto de Production; no “arreglar” un preview copiando secretos/base de producción.
4. **Backup y restore cloud:** elegir responsable, frecuencia, retención y almacenamiento/plan; tomar copia real y restaurar en destino aislado sin notificaciones/cron salientes. Validar Auth, RLS, constraints, ledgers, saldos e idempotencia; medir y aceptar RPO/RTO. [Procedimiento](BACKUP_AND_RECOVERY.md). El usuario aún no tiene política de respaldo.
5. **Alertas:** configurar responsable/canal y comprobar recepción de alertas de health/ready, cron, dead/backlog/leases, errores y latencia. Sin proveedor inventado ni envíos simulados.
6. **Datos reales/piloto:** confirmar tarifas de tarjeta, duraciones pendientes, disponibilidad diaria y las cuatro filas históricas. Probar recepción → atención → split → caja/gasto → liquidación/reversal → próxima cita y conciliación con los roles reales. Después decidir apertura pública.
7. **Pagos reales a socios:** implementar la extensión mínima solo con decisiones de período/retiros/aprobación confirmadas; no convertir estimaciones anteriores en pagos.

## Cómo retomar y verificar

1. `git fetch origin`, comprobar árbol limpio y actualizar main por fast-forward. Leer el SHA vigente y su CI; no asumir que este merge sigue siendo el último. Crear rama nueva para cambios.
2. Comparar las migraciones locales/remotas antes de cualquier rollout. MCP Supabase está configurado para el proyecto señalado; verificar sesión sin volver a instalar ni pedir autorización si sigue válida. Ejecutar SQL de solo lectura para inventario/RLS/cron/booking antes de mutar.
3. `npm ci`, `npm run check`. Docker no estaba instalado en esta estación; Auth real/restore se probaron en CI Supabase local. No contar skips locales como aprobados. `npm run test:hardening` ejecuta los 23 contratos focalizados con PostgreSQL embedded.
4. Revisar metadata CLI del proyecto **barberia-crm**, id `prj_5T3VMAuA8qXr3G6zzDSc94pHMpCQ`, equipo `team_fHImRjkE8m0NyoHDOZHtaNH1`. Esta copia local no tiene enlace Vercel: usar destino explícito (`vercel project inspect barberia-crm --non-interactive --scope team_fHImRjkE8m0NyoHDOZHtaNH1`); no enlazar automáticamente. Dominio `https://barberia-crm-kappa.vercel.app`. Confirmar deployment/alias/SHA actuales; no confiar en que push equivale a promoción exitosa.
5. Smoke autorizado solo GET health/ready y worker sin secreto: últimos resultados 200 JSON / 200 ready:true / 403. `npm run test:smoke:production` falla si recibe protección HTML; para un deployment protegido usar Vercel CLI autenticada, sin imprimir bypass/credenciales. La autorización previa del navegador autenticado fue rechazada; no eludirla.
6. El conector GitHub lee CI pero devolvió 403 para crear PR/administrar protección. La autenticación Git existente sí tenía admin y permitió PR/ruleset; se usó en memoria sin exponer tokens. Usar autenticación autorizada disponible. Main está protegido: continuar por PR y checks, sin desactivar la regla.

Referencias de operación: [matriz](FINAL_PERMISSION_MATRIX.md), [incidentes](OPERATIONAL_INCIDENTS.md), [checklist](PRODUCTION_RELEASE_CHECKLIST.md), [inventario archivo por archivo](FINAL_AUDIT_INVENTORY.md). No afirmar producción lista hasta aportar evidencia de los pendientes externos.
