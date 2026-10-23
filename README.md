# Barbería OS

Rediseño negro/dorado y auditoría del 22/10/2026: [estado de aceptación y evidencia](docs/RELEASE_ACCEPTANCE.md). [DESIGN.md](DESIGN.md) es la autoridad visual; las revisiones anteriores se conservan como historia.

> Continuación del 19/10/2026: [operación diaria de 17:17](docs/OPERACION_1717.md) y [estado de esta revisión](docs/RELEASE_2026_10_19.md). Incluye disponibilidad por día y reparto de ganancias en partes iguales.

Sistema operativo multi-tenant para barberías. Una aplicación Next.js/TypeScript y un proyecto Supabase: organizaciones, sucursales, equipo, servicios, disponibilidad por intervalos, agenda, reservas públicas, walk-ins, clientes, retención, rebooking, metas, reportes y finanzas operativas (caja, cobros, gastos, comisiones y liquidaciones). No incluye contabilidad fiscal.

La fuente de verdad es PostgreSQL. Los permisos se resuelven en DB; los writes se realizan por RPC transaccional, con auditoría, eventos, idempotencia y exclusión GiST contra double booking. No hay datos comerciales hardcodeados ni seed automático.

## Levantar desde cero

Requisitos: Node **24.15.x**, npm, Git. Docker se necesita para Supabase completo local y Auth E2E; las pruebas PostgreSQL pueden correr sin Docker.

```sh
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset --local --no-seed
```

En Windows, usar `Copy-Item .env.example .env.local`. `supabase start` aplica las migrations; `db reset --local` **borra únicamente la base local** y se usa para verificar una instalación nueva. Nunca usar reset contra producción.

Completar `.env.local` con la URL y clave publicable del proyecto (`supabase status`, salida privada), `APP_URL=http://localhost:3000` y tres secretos independientes de al menos 32 bytes: `BOOKING_GATEWAY_SECRET`, `WORKER_SECRET`, `CRON_SECRET`. No versionar ese archivo. Registrar **solamente los hashes SHA256** de los dos primeros en `app_private.gateway_credentials`, nombres `booking` y `worker`; ver [onboarding](docs/NEW_ORGANIZATION_ONBOARDING.md).

```sh
npm run dev
```

Abrir `/login`, crear una cuenta y confirmar su correo. La cuenta no recibe acceso a negocios por registrarse. Un administrador de plataforma crea la organización y asigna al propietario registrado. [Bootstrap y configuración inicial](docs/NEW_ORGANIZATION_ONBOARDING.md).

En este workspace ya se dejó `.env.local` conectado al Supabase auditado; no contiene usuarios demo. Las credenciales privadas permanecen en ese archivo ignorado por Git. Antes de desplegar, copiar los secretos mediante el gestor de variables de la plataforma y cambiar `APP_URL` al dominio real HTTPS.

## Verificación

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
npm run test:load
```

Para publicar en Vercel, seguir [la guía de despliegue](docs/VERCEL_DEPLOYMENT.md). El build de Vercel valida las variables, el origen HTTPS y la separación de bases entre Production y Preview; falla con el nombre del control, sin imprimir secretos.

Con el build de producción servido localmente (`npm start`), `npm run test:booking-ui` verifica doce combinaciones de preselección/responsive y el payload de reserva mediante respuestas API interceptadas. Usa el Chromium de Playwright (`npx playwright install chromium`), sin rutas de programas ni dependencias de otra computadora. Esta prueba no sustituye Auth/DB E2E real.

`test:db` crea PostgreSQL 17 efímero en `.test-data`, aplica todas las migrations y ejecuta aislamiento, permisos, flujos y concurrencia real. Rechaza URLs externas. Su Auth es un fixture mínimo, no Supabase Auth.

`test:e2e` usa Chromium. Sin `E2E_REAL_SUPABASE=1` solo verifica login responsive/seguridad/teclado; los casos de Auth y negocio se omiten explícitamente. El CI arranca Supabase aislado, crea usuarios reales de Auth y ejecuta esos casos. No cuenta un caso omitido como aprobado.

`test:load` crea escenarios de 10/50/100 organizaciones en DB local aislada. Registra p50/p95/p99, errores y EXPLAIN en [load-results.json](docs/verification/load-results.json). No mide capacidad de Supabase administrado, HTTP ni Realtime.

## Demo explícita, solo local

Crear una base Supabase local nueva y establecer `LOCAL_DB_URL`, `LOCAL_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `DEMO_PASSWORD` (mínimo 12 caracteres). Ejecutar:

```sh
node --env-file=.env.local --import tsx scripts/seed-demo.ts
```

El script rechaza cualquier host remoto. Crea Barbería Demo, dos sucursales, cinco barberos, servicios, clientes y reservas, además del tenant B para probar aislamiento. Login `ownerA@fixture.invalid` con la contraseña que estableciste. Los secretos de booking/worker del fixture se usan únicamente para el entorno demo; no reemplazan los de producción. El seed no corre durante migrations, build ni deploy.

## Documentación

- [Informe de continuación y estado de publicación](docs/RELEASE_REPORT.md), [configuración de Vercel](docs/VERCEL_DEPLOYMENT.md).

- [Auditoría inicial](docs/AUDIT.md), [arquitectura](docs/ARCHITECTURE.md), [schema y migrations](docs/SCHEMA.md).
- [Multi-tenancy](docs/MULTITENANCY.md), [seguridad](docs/SECURITY.md), [matriz RLS](docs/RLS_MATRIX.md).
- [Reservas](docs/BOOKING_ENGINE.md), [disponibilidad](docs/AVAILABILITY_ENGINE.md), [capacidad y escalado](docs/CAPACITY_AND_SCALING.md).
- [Backups y recovery](docs/BACKUP_AND_RECOVERY.md), [rollback](docs/ROLLBACK_PLAN.md), [checklist de producción](docs/PRODUCTION_RELEASE_CHECKLIST.md).
- [Nueva organización](docs/NEW_ORGANIZATION_ONBOARDING.md), [finanzas operativas](docs/FINANCE.md), [evidencia y limitaciones](docs/VERIFICATION.md).

La documentación distingue IMPLEMENTADO, PROBADO, NO PROBADO y PENDIENTE. El release no se considera habilitado para clientes reales hasta completar los controles externos de la checklist, incluidos correo, worker, backups y restore del proyecto real.


## Continuación financiera — 12/10/2026

Finanzas operativas implementadas: Caja, checkout/split, POS, comisiones, gastos, adelantos, salario, liquidaciones y reversals. Ver [FINANCE](docs/FINANCE.md), [import](docs/FINANCE_IMPORT_1717.md) y [auditoría](docs/CONTINUATION_AUDIT.md). config/onboarding/1717.json es preparación, no seed automático. Preview exige staging distinto de Production; scheduler compatible debe configurarse.
