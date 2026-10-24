# Pruebas de configuración — piloto 17:17

Referencia inicial `65a84d329d1ae6ff1e9be3f2b710f6aac44088c2`. Ninguna prueba crea clientes, cobros o gastos sintéticos en producción. Las consultas cloud de esta intervención fueron de solo lectura.

## Cobertura agregada

| Área | Comprobación |
|---|---|
| Servicios | `otro` se normaliza a null; límites de duración/composición coherentes con SQL; validación cliente/API por campo; slug duplicado devuelve error específico; campos preservados; siguientes pasos de precio/capacidad visibles |
| Semanal | Descanso divide turno; domingo sin selección implícita; una transacción; historia anterior conservada; futuro sustituido con snapshot auditado; excepciones/ausencias intactas; conflicto con reserva produce rollback |
| Concurrencia | Dos editores con versión antigua: solo uno guarda; clave repetida retorna la misma respuesta; actor revocado no puede repetir; tenant externo y permisos insuficientes rechazados |
| Compatibilidad | Instalación limpia y upgrade desde las 34 migraciones actuales; venta/pago/precios/snapshots/horarios de fixtures sin cambios; no se crean políticas ni reconciliaciones de tenants automáticamente |
| Cobro | Servicio real seleccionable en venta manual, sin producto ficticio; profesional obligatorio; tarjeta sin tarifa rechaza todo el post; G. 30.000 permanece G. 30.000 al elegir débito/crédito |
| UPay aislado | Débito 220 bps → G. 660 estimados / G. 29.340; crédito 520 bps → G. 1.560 / G. 28.440, con fijos cero expresamente sintéticos. No son liquidaciones productivas ni clasifican toda retención como comisión |
| Diagnóstico | Cuenta, vínculo, membresía, capacidades y factores individuales; tarifas/evidencia/acreditación separados; validación contable manual; flags de booking no equivalen a reserva comprobada; errores de lectura no se vuelven verdes |
| Interfaz | Formularios, vista previa, filtros plegables y limpieza de filtros; responsive y axe en el editor semanal; casos nuevos se ejecutan junto a las pruebas existentes |
| Seguridad y finanzas previas | Suite completa de aislamiento, roles, MFA/sesiones, RLS, caja, split/reversión, conciliación, pérdidas/retiros y aprobación dual preservada |

## Ejecución local

Comprobado en esta intervención: **26 unitarios**, **15 pruebas UI**, contratos DB completos (51 seguridad/operación, 19 finanzas, 23 hardening, 18 producto, más onboarding/upgrades/reparto conciliado/17:17 y los contratos nuevos), upgrade desde 34 y guardado semanal con concurrencia/revocación. Carga con 10/50/100 organizaciones y tenant concentrado: **cero errores**. Lint y typecheck aprobados.

La compilación npm tuvo un aborto nativo de libuv en Windows después de compilar. Se repitió el mismo `next build` mediante Node directamente y terminó correctamente, incluido TypeScript. Se conservan ambos logs; la CI ejecuta además el comando npm completo en Ubuntu sobre el HEAD publicado. Esto no se atribuye a un fallo funcional del CRM ni se oculta como prueba aprobada.

- `npm run lint`, `npm run typecheck`, `npm test`.
- `npm run test:db`: instalación limpia, upgrades de 27 y 34, contratos de configuración/operación/finanzas/hardening/producto, reparto conciliado y editor semanal.
- `npm run test:hardening`, `npm run test:load`, `npm run build`.
- `npm run test:ui`: componentes Playwright aislados; estos fixtures **no** acreditan Auth real.
- E2E con Supabase Auth real, restore y advisors se ejecutan en la CI de GitHub con Docker aislado. Docker no está disponible en este Windows; no se afirma una ejecución local de Auth real.

Los logs de esta intervención se conservan en `docs/verification/pilot-20261024/`. Las corridas de CI y el SHA de despliegue deben asociarse al HEAD aceptado en el PR, no a una corrida vieja de main. Una compilación o una respuesta HTTP 200 no certifica operación comercial.

Publicación y comprobante final: [PR #8](https://github.com/otiagoo44/barberia-crm/pull/8), cuyo estado, SHA, checks y deployment deben comprobarse antes de declarar el merge. Este documento se prepara antes de ese paso y no presenta un PR abierto como fusionado.

## Gates externos que estos tests no sustituyen

Backup de producción recuperable y restore, entrega SMTP, alta/confirmación/MFA de ambos propietarios, condiciones/liquidaciones UPay, alertas entregadas y piloto desde ambos equipos. Ver [pendientes manuales](PENDIENTES_MANUALES_1717.md). Migraciones productivas aplicadas en esta intervención: **0**.
