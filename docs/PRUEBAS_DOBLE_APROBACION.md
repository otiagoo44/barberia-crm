# Pruebas de doble aprobación y reparto

Código: `tests/integration/cash-distributions.ts`. Datos sintéticos únicamente en PostgreSQL aislado, con sesiones/factores SQL de prueba. Esas pruebas no certifican que Esteban/Jonatan existan en GoTrue ni sustituyen el E2E con tokens reales.

Casos: configuración explícita deshabilitada; gates externos de activación; dos owners ligados a profesionales distintos; una aprobación no paga; duplicación de identidad rechazada; owner externo rechazado; dedupe durable; pérdida inicial, meses consecutivos y recuperación parcial/total; pagos parciales/draft y saldo al mes siguiente; POS unknown y diferencia de neto bloqueados; comisión efectiva descontada una vez; originales intactos; factura impaga excluida; retiro individual con excedente; refund posterior; PYG entero y resto; aprobaciones concurrentes; cambio material invalida propuesta; revocación/AAL1/tenant y escritura directa denegados; períodos congelados inmutables; diagnóstico semanal con motor autoritativo.

Comando focal: `npx tsx tests/integration/run-cash.ts`. Integración completa: `npm run test:db`. El resultado de la ejecución y el SHA exactos se registran en `CIERRE_FINAL_1717_2026_10_24.md`; no interpretar esta lista como evidencia de ejecución.

La CI conserva quality, supabase-e2e y visual-baseline. Exigir Auth real sin omisiones antes de merge. Restore/upgrade, DB/hardening/carga y EXPLAIN se ejecutan en entorno aislado. El piloto humano y la recuperación cloud son gates independientes.
