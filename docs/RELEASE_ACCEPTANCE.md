# Aceptación de Barbería OS

**En verificación; no habilita producción.** Rama `redesign/black-gold-audit-20261022`, [PR #5](https://github.com/otiagoo44/barberia-crm/pull/5). Base b7d5cfd, incluye correcciones del PR #4 aún pendientes en main. Sin merge, deploy, bypass ni apertura de reservas/distribuciones.

## Evidencia requerida

| Área | Estado actual |
|---|---|
| Dos pasadas iniciales e inventario por archivo | Registradas en INITIAL_FILE_AUDIT.md y FINAL_UX_AUDIT.md |
| DESIGN.md | Lint oficial 0.4.0: cero errores/advertencias; diff y export ejecutados. Pendiente verificación visual final |
| Código | Build y typecheck local aprobados durante implementación; el candidato final requiere CI completa |
| Unitarios | 20 aprobados en la iteración; repetir después de cambios relevantes |
| Base, finanzas, hardening y carga | Pendientes del candidato final |
| Auth/E2E, accesibilidad y capturas | Baseline real descargado; candidato y pruebas nuevas pendientes |
| Rendimiento | Baseline medido; comparación del mismo runner y perfil React pendientes |
| Migración 35 | DEFAULT de marca, incremental y sin reescritura; verificar instalación/upgrade antes de rollout |

## Gates humanos de producción

Reconectar Supabase y reconsultar la organización/sucursal existentes; confirmar cuentas independientes de Jonatan/Esteban, vínculo a staff, roles, MFA y respaldo. Confirmar catálogo/duración, rulos con consulta, disponibilidad real por fecha y descansos, tarifas POS y apertura de caja. Confirmar política 50/50 después de gastos, pérdidas/retiros y evidencias antes de habilitar distribuciones. SMTP y recuperación entregados, backup/restore cloud con RPO/RTO, alertas recibidas, staging independiente y piloto acompañado siguen separados de CI.

No recrear registros ni inventar turnos semanales. No importar historia ambigua. No alterar la landing: sincronizar su identidad posteriormente conservando WEBSITE_INTEGRATION.md. Reservas públicas solo tras decisión expresa y configuración válida. Tener el PR listo no autoriza publicar ni operar datos reales.
