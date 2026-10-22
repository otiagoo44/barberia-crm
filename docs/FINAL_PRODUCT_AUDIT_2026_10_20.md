# Auditoría de producto — 20/10/2026

Continuación del 21/10 en [PR3_RECOVERY_AUDIT_2026_10_21](PR3_RECOVERY_AUDIT_2026_10_21.md). La tabla siguiente conserva el reconocimiento inicial; el estado de cierre y los checks del candidato se registran en [pr3-final.json](verification/pr3-final.json). No interpretar «ausente/pendiente» en esta matriz inicial como inventario del código final.

Base verificada por `git fetch origin`: `4fa4d63eaa26e31bdddb37aac68456e8c0e85ba3`, `main`, árbol limpio. Rama de trabajo: `audit/product-release-20261020`. No se modifican migraciones aplicadas ni datos cloud. Esta matriz inicial se actualiza con evidencia al cerrar la revisión.

## Reconocimiento y matriz inicial

Se leyeron README, SESSION_HANDOFF_2026_10_19, FINAL_HARDENING_AUDIT, FINAL_PERMISSION_MATRIX, PRODUCTION_RELEASE_CHECKLIST, FINANCE, OPERACION_1717, PARTNER_DISTRIBUTIONS_DESIGN, WEBSITE_INTEGRATION y VERCEL_DEPLOYMENT. Inventario anterior conservado en FINAL_AUDIT_INVENTORY. Los siete skills locales solicitados están presentes. `DESIGN (1).md` describe el tema oscuro anterior; se conserva como antecedente y se define DESIGN.md canónico.

| Dominio / rutas | Implementado en la base | Evidencia existente | Estado de esta auditoría |
|---|---|---|---|
| Tenant/roles/scopes — lib/capabilities, api/workspace, migración 27 | Membresías vivas, separación plataforma/comercio, autorización tras lock | contracts.ts, hardening.ts, permissions.spec.ts | Revalidar, preservar regresiones |
| Auth — api/auth, auth/callback, lib/auth | Password, signup, recovery, cookies HTTP-only, Origin y CSP | operations.spec.ts, tests/unit | MFA ausente: pendiente de código; SMTP externo |
| Agenda/reservas — features/appointments, api/public, scheduling RPC | GiST, bloques, composición, walk-ins, transiciones, rebooking | contracts.ts y operations.spec.ts | Revalidar; disponibilidad diaria ya existe |
| Clientes — features/customers, export/customers | Búsqueda, historial, retención y CSV neutralizado | contratos + matriz HTTP | Rediseñar preservando scopes |
| Configuración — features/configuration | Organización, local, staff, catálogo, branding, horarios | onboarding.ts | Rediseñar sin fabricar horarios |
| Finanzas — features/finance, api/finance | Checkout, split, fees, caja, gasto, salarios, comisión, liquidación, reversal, import | finance.ts, hardening.ts, restore local | Revalidar; conservar ledger y claves durables |
| Socios — profit-sharing, migración 25 | Estimación equal_profit_share, resto entero | onboarding.ts | Registro aprobado/pagos ausente; política real externa |
| Reportes — analytics/dashboard, finance_read | Consultas autorizadas y acotadas, producción separada de cobros | contratos DB | Faltan gráficos; verificar semántica |
| Jobs — api/jobs, migraciones scheduler | Outbox, lease/retries/dead, pg_cron único | hardening.ts, onboarding.ts | Revalidar; recepción de alertas externa |
| Health — api/health, api/health/ready | Liveness y conexión DB | smoke y gateway_health | Ampliar diagnóstico privado |
| Release — .github/workflows, validate-deployment | CI, build gate de staging separado, main protegido | handoff del 19/10 | CI del nuevo SHA pendiente; sin deploy comercial |
| Cloud | 27 migraciones según handoff | Evidencia del 19/10, no prueba actual | Reconsultar de solo lectura si hay acceso autorizado |

## Historial de migraciones

27 archivos incrementales, desde `20261012171437_tenant_core.sql` hasta `20261019223415_final_authorization_hardening.sql`. `git log -- supabase/migrations` confirma su historial. Las revisiones de esta rama deben agregar archivos; el diff contra la base no debe alterar esos 27. Instalación aislada desde cero y comparación remota se informan por separado.

## Gates externos iniciales

SMTP y destinatario de recuperación; staging independiente; backup/restore cloud con RPO/RTO aceptados; proveedor/responsable de alertas; decisiones societarias; datos/duraciones/tarifas/disponibilidad reales; piloto por rol. Permanecen OPEN hasta evidencia verificable. Docker no está disponible en esta estación: PostgreSQL embedded no sustituye Supabase Auth real.
