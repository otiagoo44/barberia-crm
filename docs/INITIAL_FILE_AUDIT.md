# Inventario inicial por archivo

Base `b7d5cfd42611d83347b4307e0c53db173d7b967f`. Se recorrieron todos los archivos versionados de producto, tests, scripts, SQL y configuración, extrayendo imports con AST TypeScript, exports, objetos SQL y hashes. La lectura estática no demuestra por sí sola cobertura ni ausencia de defectos. Los tests asociados indican suites que ejercitan la responsabilidad, no cobertura de cada línea.

## .env.example

- Responsabilidad: configuración de .env.example.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## .github/rulesets/main.json

- Responsabilidad: automatización / protección de .github/rulesets/main.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## .github/workflows/ci.yml

- Responsabilidad: automatización / protección de .github/workflows/ci.yml.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## .github/workflows/load.yml

- Responsabilidad: automatización / protección de .github/workflows/load.yml.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## .gitignore

- Responsabilidad: configuración de .gitignore.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## .vercelignore

- Responsabilidad: configuración de .vercelignore.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## config/onboarding/1717.json

- Responsabilidad: configuración de config/onboarding/1717.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## eslint.config.mjs

- Responsabilidad: configuración de eslint.config.mjs.
- Dependencias: @eslint/js, typescript-eslint, eslint-plugin-react-hooks
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## next-env.d.ts

- Responsabilidad: configuración de next-env.d.ts.
- Dependencias: ./.next/types/routes.d.ts, ./.next/types/root-params.d.ts
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## next.config.ts

- Responsabilidad: configuración de next.config.ts.
- Dependencias: next
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## package-lock.json

- Responsabilidad: configuración de package-lock.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## package.json

- Responsabilidad: configuración de package.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## playwright.config.ts

- Responsabilidad: configuración de playwright.config.ts.
- Dependencias: @playwright/test
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/capture-product.mjs

- Responsabilidad: herramienta operativa / QA de scripts/capture-product.mjs.
- Dependencias: @playwright/test, node:fs/promises, node:path, node:crypto, node:child_process, @axe-core/playwright
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/ci-environment.mjs

- Responsabilidad: herramienta operativa / QA de scripts/ci-environment.mjs.
- Dependencias: node:child_process, node:fs, node:path
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/configure-1717-operations.sql

- Responsabilidad: herramienta operativa / QA de scripts/configure-1717-operations.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/enable-scheduler.sql

- Responsabilidad: herramienta operativa / QA de scripts/enable-scheduler.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/finance-dry-run.ts

- Responsabilidad: herramienta operativa / QA de scripts/finance-dry-run.ts.
- Dependencias: node:fs/promises, ../src/features/finance/import-parser
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/onboard-1717.d.mts

- Responsabilidad: Implementa onboardingSql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/onboarding.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/onboard-1717.mjs

- Responsabilidad: Implementa onboardingSql.
- Dependencias: node:fs/promises, node:path, node:url
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/onboarding.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/prepare-pr3-release.mjs

- Responsabilidad: herramienta operativa / QA de scripts/prepare-pr3-release.mjs.
- Dependencias: node:fs/promises, node:crypto
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/prepare-release.mjs

- Responsabilidad: herramienta operativa / QA de scripts/prepare-release.mjs.
- Dependencias: node:fs/promises, node:path
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/prepare-ux-fixtures.ts

- Responsabilidad: herramienta operativa / QA de scripts/prepare-ux-fixtures.ts.
- Dependencias: node:fs/promises, node:crypto, pg, ../tests/integration/fixtures, ../tests/integration/database
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/qa-website-booking.mjs

- Responsabilidad: herramienta operativa / QA de scripts/qa-website-booking.mjs.
- Dependencias: @playwright/test, node:fs/promises, node:assert/strict
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/seed-demo.ts

- Responsabilidad: herramienta operativa / QA de scripts/seed-demo.ts.
- Dependencias: @supabase/supabase-js, pg, node:crypto, ../tests/integration/fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/smoke-production.mjs

- Responsabilidad: herramienta operativa / QA de scripts/smoke-production.mjs.
- Dependencias: node:assert/strict
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## scripts/validate-deployment.mjs

- Responsabilidad: herramienta operativa / QA de scripts/validate-deployment.mjs.
- Dependencias: ../src/lib/environment-boundary.ts
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## skills-lock.json

- Responsabilidad: configuración de skills-lock.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/(workspace)/[organization]/[module]/page.tsx

- Responsabilidad: Implementa dynamic, Module.
- Dependencias: next/navigation, @/features/appointments/agenda, @/features/analytics/dashboard, @/features/customers/customers, @/features/walk-ins/queue, @/features/goals/goals, @/features/configuration/configuration, @/lib/auth, @/lib/http, @/features/finance/cash, @/features/finance/dashboard, @/lib/capabilities
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: F05: Inicio recepción monta Agenda+WalkIns en vez de ReceptionHome disponible.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/app/(workspace)/[organization]/layout.tsx

- Responsabilidad: Implementa dynamic, WorkspaceLayout.
- Dependencias: next/navigation, @/lib/auth, @/lib/http, @/features/organizations/context, @/components/shell, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/auth/[action]/route.ts

- Responsabilidad: Implementa POST.
- Dependencias: zod, @/lib/supabase/server, @/lib/http, @/lib/auth
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/auth/mfa/[action]/route.ts

- Responsabilidad: Implementa dynamic, POST.
- Dependencias: zod, @/lib/auth, @/lib/http
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/export/customers/route.ts

- Responsabilidad: Implementa dynamic, GET.
- Dependencias: zod, @/lib/auth, @/lib/http, @/lib/validation, @/lib/types
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/finance/[resource]/route.ts

- Responsabilidad: Implementa dynamic, GET, POST.
- Dependencias: zod, @/lib/auth, @/lib/validation, @/lib/http
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/finance/import/route.ts

- Responsabilidad: Implementa dynamic, POST.
- Dependencias: zod, @/lib/auth, @/lib/http, @/lib/validation, @/lib/capabilities, @/features/finance/import-limits, @/features/finance/import-parser
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/health/operations/route.ts

- Responsabilidad: Implementa dynamic, GET.
- Dependencias: @/lib/supabase/server, @/lib/secret-auth
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/health/ready/route.ts

- Responsabilidad: Implementa dynamic, GET.
- Dependencias: @/lib/supabase/server
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/health/route.ts

- Responsabilidad: Implementa GET.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/jobs/route.ts

- Responsabilidad: Implementa dynamic, maxDuration, GET.
- Dependencias: @/lib/secret-auth, @/lib/supabase/server, @/lib/http
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/live/route.ts

- Responsabilidad: Implementa dynamic, maxDuration, GET.
- Dependencias: @/lib/http, zod, @/lib/auth
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/public/[resource]/route.ts

- Responsabilidad: Implementa dynamic, GET, POST.
- Dependencias: node:crypto, zod, @/lib/supabase/server, @/lib/http, @/lib/validation
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/api/workspace/[resource]/route.ts

- Responsabilidad: Implementa dynamic, POST, GET.
- Dependencias: zod, @/lib/auth, @/lib/http, @/lib/validation
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/auth/callback/route.ts

- Responsabilidad: Implementa GET.
- Dependencias: next/server, @/lib/supabase/server
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/book/[organization]/[[...branch]]/page.tsx

- Responsabilidad: Implementa dynamic, BookingPage.
- Dependencias: next/navigation, @/features/booking/public-booking, @/lib/validation, @/lib/public-booking
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/design-tokens.css

- Responsabilidad: Implementación de tokens de DESIGN.md.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/error.tsx

- Responsabilidad: Implementa ErrorPage.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/globals.css

- Responsabilidad: Primitivas globales, layouts, formularios y responsive.
- Dependencias: ./design-tokens.css, @fontsource-variable/dm-sans
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: F01/F04: escala y feedback inconsistentes; estado disabled con opacidad global/cursor wait.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/app/icon.svg

- Responsabilidad: producto de src/app/icon.svg.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/layout.tsx

- Responsabilidad: Implementa metadata, RootLayout.
- Dependencias: next, ./globals.css, ./workspace.css
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; tests/integration/hardening.ts; tests/security/contracts.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/login/page.tsx

- Responsabilidad: Implementa dynamic, Login.
- Dependencias: @/features/auth/auth-form, @/components/ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/mfa/page.tsx

- Responsabilidad: Implementa dynamic, MfaPage.
- Dependencias: next/navigation, @/lib/auth, @/features/auth/mfa-form
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/not-found.tsx

- Responsabilidad: Implementa NotFound.
- Dependencias: next/link
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/page.tsx

- Responsabilidad: Implementa dynamic, Organizations.
- Dependencias: next/link, next/navigation, @/lib/auth, @/lib/http, @/features/organizations/create-organization, @/features/auth/auth-form
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/reset-password/page.tsx

- Responsabilidad: Implementa dynamic, Reset.
- Dependencias: @/features/auth/auth-form, @/lib/auth, next/navigation
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/app/workspace.css

- Responsabilidad: Presentación del CRM; overrides de tipografía y componentes.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: F01: controles 13px, etiquetas 10/11px, KPI móvil 18px. Ajustar jerarquía y contraste en capturas.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/components/chart.tsx

- Responsabilidad: Implementa ChartPoint, ChartProps, DataChart.
- Dependencias: next/dynamic, ./ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/components/data-chart.tsx

- Responsabilidad: Implementa DataChart.
- Dependencias: react, recharts, ./ui, ./chart, @/features/finance/client
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/chart-values.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/components/saved-views.tsx

- Responsabilidad: Implementa SavedViews.
- Dependencias: react, ./ui, @/features/organizations/context
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/components/shell.tsx

- Responsabilidad: Navegación, contexto de local, búsqueda y cuenta según rol.
- Dependencias: next/link, next/navigation, react, date-fns-tz, lucide-react, @/features/organizations/context, @/features/auth/auth-form, @/lib/validation, @/lib/client, ./ui, @/lib/types, @/lib/branding
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: F06: actividad vacía se muestra durante carga/error; faltan estados explícitos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/components/ui.tsx

- Responsabilidad: Diálogo nativo, estados, campos y badges compartidos.
- Dependencias: react, lucide-react
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/components/workspace-ui.tsx

- Responsabilidad: Implementa Toast, DateRangePicker, RecordDrawer, FilterBar, DataTable, ViewSwitcher, Tabs, MetricCard, ActivityTimeline, ErrorState, ConfirmDialog.
- Dependencias: react, ./ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/analytics/dashboard.tsx

- Responsabilidad: Implementa Dashboard.
- Dependencias: next/link, react, date-fns, date-fns-tz, @/features/organizations/context, @/lib/client, @/components/ui, @/lib/types, @/features/configuration/record-manager, @/features/goals/goals, @/features/finance/dashboard, @/features/organizations/launch-guide, ./day-overview, @/components/chart, @/lib/chart-values, ./operation-home, @/components/workspace-ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/security/contracts.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/analytics/day-overview.tsx

- Responsabilidad: Implementa DayOverview.
- Dependencias: next/link, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/types, @/components/ui, @/hooks/use-clock
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/analytics/operation-home.tsx

- Responsabilidad: Implementa ReceptionHome.
- Dependencias: next/link, date-fns-tz, @/features/organizations/context, @/lib/client, @/features/finance/client, ./day-overview, @/components/ui, @/components/workspace-ui, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/appointments/agenda.tsx

- Responsabilidad: Implementa Agenda.
- Dependencias: react, next/navigation, date-fns, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/validation, @/hooks/use-live, @/components/ui, @/lib/types, ./booking-form, ./appointment-dialog, ./time-calendar
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/permissions.spec.ts; tests/e2e/ux-release.spec.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/appointments/appointment-dialog.tsx

- Responsabilidad: Implementa AppointmentDialog.
- Dependencias: @/hooks/use-clock, react, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/validation, @/components/ui, @/lib/types, ./booking-form, @/features/finance/checkout
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/appointments/booking-form.tsx

- Responsabilidad: Implementa BookingForm.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/validation, @/components/ui, @/features/services/service-picker, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/appointments/time-calendar.tsx

- Responsabilidad: Implementa TimeCalendar.
- Dependencias: date-fns-tz, @/lib/validation, @/lib/types, @/hooks/use-clock, @/lib/calendar
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/auth/auth-form.tsx

- Responsabilidad: Implementa AuthForm, SignOut.
- Dependencias: react, @/lib/client, @/components/ui
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/auth/mfa-form.tsx

- Responsabilidad: Implementa MfaForm.
- Dependencias: next/link, react, lucide-react, @/lib/client, @/components/ui, @/components/workspace-ui, ./auth-form
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/booking/public-booking.tsx

- Responsabilidad: Implementa PublicBooking.
- Dependencias: react, date-fns-tz, @/lib/client, @/lib/validation, @/components/ui, @/features/services/service-picker, @/lib/branding, @/lib/public-booking
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/configuration/configuration.tsx

- Responsabilidad: Implementa Configuration.
- Dependencias: react, @/features/organizations/context, ./record-manager, ./definitions, ./daily-availability, @/lib/client, @/components/ui, @/lib/validation, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/configuration/daily-availability.tsx

- Responsabilidad: Implementa DailyAvailability.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, @/components/ui, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/configuration/definitions.ts

- Responsabilidad: Implementa FieldDefinition, Definition, definitions.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/configuration/record-manager.tsx

- Responsabilidad: Implementa currencyScale, RecordManager.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, ./definitions, @/components/ui, @/components/workspace-ui, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/customers/customers.tsx

- Responsabilidad: Implementa Customers.
- Dependencias: react, next/navigation, next/link, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/validation, @/components/ui, @/features/appointments/booking-form, @/components/saved-views, @/lib/types, @/components/workspace-ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/cash.tsx

- Responsabilidad: Implementa Cash.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, @/components/ui, ./client, ./checkout, ./forms
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/checkout.tsx

- Responsabilidad: Implementa CheckoutDialog.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, @/components/ui, ./payment-method-selector, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/client.ts

- Responsabilidad: GET/POST y ciclo de carga del frontend.
- Dependencias: @/lib/client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/dashboard.tsx

- Responsabilidad: Implementa FinancialDashboard, FinanceTable.
- Dependencias: react, @/components/workspace-ui, @/components/chart, @/lib/chart-values, date-fns-tz, @/features/organizations/context, @/lib/client, @/lib/capabilities, @/components/ui, ./client, ./forms, ./import-ui, ./financial-charts, ./staff-charts, ./partner-distributions, ./profit-sharing
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/financial-charts.tsx

- Responsabilidad: Implementa FinancialCharts.
- Dependencias: @/components/chart, @/components/ui, @/lib/client, @/lib/chart-values, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/forms.tsx

- Responsabilidad: Implementa FinanceForm.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/components/ui, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/import-limits.ts

- Responsabilidad: Implementa MAX_IMPORT_UPLOAD_BYTES, MAX_IMPORT_JSON_BYTES, MAX_IMPORT_BASE64_LENGTH.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/import-parser.ts

- Responsabilidad: Parsing XLSX/CSV acotado, normalización y hash de fuente.
- Dependencias: fflate, fast-xml-parser, node:crypto
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/import-ui.tsx

- Responsabilidad: Implementa FinanceImport.
- Dependencias: react, @/features/organizations/context, @/lib/client, @/components/ui, ./client, ./import-parser, ./import-limits
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/partner-distributions.tsx

- Responsabilidad: Implementa PartnerDistributions.
- Dependencias: react, date-fns-tz, @/features/organizations/context, @/lib/client, @/components/ui, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/payment-method-selector.tsx

- Responsabilidad: Implementa PaymentMethodSelector.
- Dependencias: @/components/ui, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/profit-sharing.tsx

- Responsabilidad: Implementa ProfitSharingSummary, ProfitSharing, RemunerationSettings.
- Dependencias: react, @/features/organizations/context, @/components/ui, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/finance/staff-charts.tsx

- Responsabilidad: Implementa StaffFinancialCharts.
- Dependencias: react, @/components/chart, @/components/workspace-ui, @/lib/chart-values, ./client
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/goals/goals.tsx

- Responsabilidad: Implementa Goals, GoalCard.
- Dependencias: @/features/organizations/context, @/lib/client, @/features/configuration/record-manager, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/organizations/context.tsx

- Responsabilidad: Scope autenticado y cambio de sucursal.
- Dependencias: react, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/organizations/create-organization.tsx

- Responsabilidad: Implementa CreateOrganization.
- Dependencias: react, @/lib/client, @/components/ui
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/organizations/launch-guide.tsx

- Responsabilidad: Guía inicial y flags reales de reservas, sin diagnóstico completo.
- Dependencias: next/link, ./context, @/lib/client, @/components/ui, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: F02: cuatro enlaces estáticos; solo flags booking consultados, no diagnóstico de puesta en marcha.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/features/services/service-picker.tsx

- Responsabilidad: Implementa PickableService, nextServiceSelection, ServicePicker.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/domain.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/features/walk-ins/queue.tsx

- Responsabilidad: Implementa WalkIns.
- Dependencias: react, @/features/organizations/context, @/lib/client, @/hooks/use-live, @/features/appointments/booking-form, @/features/appointments/appointment-dialog, @/components/ui, @/lib/types
- Riesgos: Legibilidad, estados, teclado, responsive y coste de render/requests.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/hooks/use-clock.ts

- Responsabilidad: Implementa useClock.
- Dependencias: react
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/hooks/use-live.ts

- Responsabilidad: Suscripción EventSource, reconexión y limpieza.
- Dependencias: react
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/auth.ts

- Responsabilidad: Identidad verificada, perfil activo, sesión viva y gate MFA.
- Dependencias: server-only, ./supabase/server, ./http, react
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/branding.ts

- Responsabilidad: Contraste dinámico de la marca configurable del tenant.
- Dependencias: react
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/chart-values.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/calendar.ts

- Responsabilidad: Implementa calendarBounds, visibleInterval.
- Dependencias: date-fns-tz
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/calendar.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/capabilities.ts

- Responsabilidad: Implementa capabilities, hasCapability.
- Dependencias: ./types
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/chart-values.ts

- Responsabilidad: Implementa chartInteger, utilization.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/chart-values.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/client.ts

- Responsabilidad: GET/POST y ciclo de carga del frontend.
- Dependencias: react
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: F03: datos previos visibles durante reload. Las lecturas independientes sin deduplicación son un riesgo a medir, no un fallo demostrado; el muestreo inicial posterior encontró cero duplicadas y no justificó un caché.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Corregir el hallazgo indicado y volver a verificar.

## src/lib/cookie-security.ts

- Responsabilidad: Implementa secureCookies.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/environment-boundary.ts

- Responsabilidad: Implementa assertEnvironmentBoundary, assertDeploymentEnvironment.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/environment.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/http.ts

- Responsabilidad: Implementa HttpError, correlationId, readJson, response, fail.
- Dependencias: server-only, node:crypto, zod
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/public-booking.ts

- Responsabilidad: Implementa PublicPickableService, parsePublicBookingQuery, directlyBookable, preselectedServices.
- Dependencias: ./validation, ../features/services/service-picker
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/public-booking.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/secret-auth.ts

- Responsabilidad: Implementa matchesSecret.
- Dependencias: node:crypto
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/supabase/server.ts

- Responsabilidad: Implementa publicEnvironment, supabaseServer, gatewayClient.
- Dependencias: server-only, @supabase/ssr, @supabase/supabase-js, next/headers, @/lib/cookie-security, @/lib/environment-boundary
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/types.ts

- Responsabilidad: Implementa Json, DataRow, Role, Organization, Branch, Staff, Service, Appointment, Page, Workspace.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; tests/unit/domain.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/lib/validation.ts

- Responsabilidad: Implementa uuid, slug, phone, date, normalizePhone, customerInput, statuses, statusLabels, retentionLabels, roleLabels, csvCell.
- Dependencias: zod
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/domain.test.ts; tests/unit/finance-import.test.ts; tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/proxy.ts

- Responsabilidad: Renovación de sesión, nonce CSP y cabeceras.
- Dependencias: @supabase/ssr, next/server, @/lib/cookie-security, @/lib/environment-boundary
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## src/services/automation/provider.ts

- Responsabilidad: Interfaz del proveedor de automatización sin credenciales inventadas.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts; permissions.spec.ts; capture-product.mjs.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/.gitignore

- Responsabilidad: configuración de supabase/.gitignore.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/config.toml

- Responsabilidad: configuración de supabase/config.toml.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171437_tenant_core.sql

- Responsabilidad: Define public.profiles, public.organizations, public.organization_settings, public.branches, public.branch_settings, public.branch_business_hours, public.branch_closures, public.organization_memberships, public.membership_branch_access, public.staff, public.staff_branch_assignments, public.services, public.branch_services, public.staff_service_capabilities, public.staff_availability_rules, public.staff_availability_exceptions, public.staff_time_off, public.customers, public.customer_notes, public.customer_preferences, public.customer_tags, public.appointments, public.appointment_services, public.appointment_status_history, public.walk_in_entries, public.goals, public.domain_events, public.automation_jobs, public.notifications, public.audit_logs, public.daily_metrics, public.daily_service_metrics, app_private.platform_admins, app_private.gateway_credentials, app_private.idempotency_keys, app_private.rate_limits, customers_return_idx, customers_name_search_idx, appointments_branch_range_idx, appointments_staff_range_idx, appointments_customer_range_idx, appointments_status_range_idx, memberships_profile_idx, staff_profile_idx, customer_notes_timeline_idx, walkins_queue_idx, jobs_claim_idx, audit_timeline_idx, events_timeline_idx, app_private.touch_and_protect_tenant, app_private.deny_history_mutation, app_private.create_profile.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171442_authorization.sql

- Responsabilidad: Define app_private.current_profile, app_private.is_platform_admin, app_private.is_org_member, app_private.has_org_role, app_private.current_staff_id, app_private.can_access_branch, app_private.current_organization_id, app_private.can_operate_branch, app_private.can_read_staff, app_private.can_read_customer, app_private.can_read_appointment, app_private.can_read_profile, profiles_read, organizations_read, organization_settings_read, memberships_read, membership_access_read, branches_read, staff_read, customers_read, services_read, appointments_read, appointment_services_read, appointment_history_read, capabilities_read, timeoff_read, goals_read, notifications_read, scoped_read, scoped_read, customer_read, management_read, walkins_read, public.visits.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171446_configuration.sql

- Responsabilidad: Define app_private.record_audit, app_private.emit_event, app_private.idempotency_begin, app_private.idempotency_finish, app_private.lock_organization, app_private.create_organization, app_private.update_organization, app_private.manage_membership, app_private.manage_record, public.create_organization, public.update_organization, public.manage_membership, public.manage_record.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171451_scheduling.sql

- Responsabilidad: Define app_private.service_plan, app_private.effective_availability, app_private.compatible_staff, app_private.availability_slots, app_private.list_availability, app_private.create_booking_internal, app_private.create_booking, app_private.reschedule_booking, app_private.transition_booking, app_private.cancel_booking, app_private.check_gateway, app_private.rate_limit, app_private.public_rate_check, app_private.public_catalog, app_private.resolve_public_request, app_private.public_availability, app_private.public_booking, public.list_availability, public.create_booking, public.reschedule_booking, public.transition_booking, public.cancel_booking, public.public_rate_check, public.public_catalog, public.public_availability, public.public_booking.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171456_operations.sql

- Responsabilidad: Define app_private.list_customers, app_private.customer_detail, app_private.customer_timeline, app_private.create_walkin, app_private.assign_walkin, app_private.close_walkin, app_private.day_status, app_private.search_workspace, customers_phone_prefix_idx, staff_name_search_idx, app_private.remove_schedule_record, public.list_customers, public.customer_detail, public.customer_timeline, public.create_walkin, public.assign_walkin, public.close_walkin, public.day_status, public.search_workspace, public.remove_schedule_record.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012171501_analytics_automation.sql

- Responsabilidad: Define public.capacity_snapshots, capacity_source_idx, capacity_read, app_private.compute_metric_day, app_private.rebuild_metric_day, public.daily_branch_metrics, public.daily_organization_metrics, public.daily_staff_metrics, app_private.dashboard, app_private.record_export, app_private.claim_jobs, app_private.process_job, app_private.fail_job, app_private.worker_tick, public.dashboard, public.record_export, public.claim_jobs, public.process_job, public.fail_job, public.worker_tick.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012173606_read_models.sql

- Responsabilidad: Define app_private.session_context, app_private.create_organization_for_email, app_private.list_agenda, app_private.appointment_detail, app_private.goal_progress, public.session_context, public.create_organization_for_email, public.list_agenda, public.appointment_detail, public.goal_progress.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012180348_product_hardening.sql

- Responsabilidad: Define app_private.request_id, public.customer_service_returns, service_returns_due_idx, service_returns_service_idx, service_returns_branch_idx, service_returns_read, public.daily_customer_activity, customer_activity_period_idx, customer_activity_customer_idx, customer_activity_branch_idx, customer_activity_staff_idx, customers_created_idx, customer_activity_read, app_private.estimate_return_days, app_private.refresh_service_returns, app_private.membership_directory, app_private.maintenance_due, app_private.gateway_health, app_private.manage_record, app_private.transition_booking, app_private.create_booking, app_private.update_organization, app_private.reschedule_booking, app_private.create_booking_internal, app_private.rebuild_metric_day, app_private.process_job, app_private.claim_jobs, app_private.worker_tick, app_private.dashboard, public.membership_directory, public.maintenance_due, public.gateway_health.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012181534_final_read_models.sql

- Responsabilidad: Define app_private.dashboard, app_private.customer_timeline, app_private.list_memberships, public.list_memberships.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012182755_advisor_foreign_key_indexes.sql

- Responsabilidad: Define capacity_snapshots_staff_fk_idx, capacity_snapshots_actor_fk_idx, customer_service_returns_actor_fk_idx, daily_customer_activity_actor_fk_idx.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012183007_reporting_access.sql

- Responsabilidad: Define reporting_read.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012183207_bounded_read_permissions.sql

- Responsabilidad: Define app_private.list_agenda, app_private.list_customers.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012183541_archived_branch_history.sql

- Responsabilidad: Define app_private.request_id, app_private.can_access_branch, app_private.can_operate_branch, app_private.list_customers.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012183917_platform_admin_audit.sql

- Responsabilidad: Define app_private.audit_platform_admins.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012184839_customer_detail_branding.sql

- Responsabilidad: Define app_private.list_customers, app_private.customer_detail.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012210000_website_booking.sql

- Responsabilidad: Define app_private.booking_attributions, app_private.public_catalog, app_private.resolve_public_request, app_private.manage_record, app_private.public_booking, app_private.public_booking, public.public_booking.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012223818_finance_schema.sql

- Responsabilidad: Define public., public.settlement_adjustments, finance_checkout_period, finance_checkout_pending, finance_payment_period, finance_expense_period, finance_commission_period, app_private.finance_access, app_private.finance_staff_access, app_private.finance_checkout_access, finance_catalog_read, fee_rules_read, commission_rules_read, finance_operational_read, checkout_lines_read, expense_read, own_finance_read, finance_report_read, financial_import_read, own_finance_read, app_private.finance_guard.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012223852_finance_transactions.sql

- Responsabilidad: Define app_private.finance_amount, app_private.finance_round, app_private.finance_session, app_private.finance_expected, app_private.finance_rebuild_day, app_private.finance_create_checkout, app_private.finance_record_payment, app_private.finance_post_checkout, app_private.finance_create_expense, app_private.finance_reverse_payment, app_private.finance_command, public.finance_command, public..
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012224111_finance_read_import.sql

- Responsabilidad: Define app_private.finance_read, public.finance_read, app_private.financial_export, public.financial_export, app_private.finance_import, public.finance_import.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261012224355_booking_finance_hardening.sql

- Responsabilidad: Define app_private.manage_membership, app_private.finance_configuration_guard, financial_audit_read, app_private.finance_child_guard, app_private.finance_posted_consistency.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts; hardening.ts; tests/e2e/operations.spec.ts; permissions.spec.ts; unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261015190206_booking_attribution_rls.sql

- Responsabilidad: migración histórica aplicada de supabase/migrations/20261015190206_booking_attribution_rls.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261015190657_consolidate_financial_audit_policy.sql

- Responsabilidad: migración histórica aplicada de supabase/migrations/20261015190657_consolidate_financial_audit_policy.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261015191802_worker_tick_record_scope.sql

- Responsabilidad: Define app_private.worker_tick.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261019154027_database_scheduler.sql

- Responsabilidad: Define app_private.worker_tick_core, app_private.worker_tick, app_private.claim_jobs_core, app_private.claim_jobs, app_private.process_job_core, app_private.process_job, app_private.fail_job_core, app_private.fail_job, app_private.run_scheduled_jobs.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261019213732_profit_sharing.sql

- Responsabilidad: Define app_private.configure_profit_settings, app_private.profit_share_summary.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261019220146_enable_database_cron.sql

- Responsabilidad: migración histórica aplicada de supabase/migrations/20261019220146_enable_database_cron.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261019223415_final_authorization_hardening.sql

- Responsabilidad: Define automation_jobs_tenant_event_idx, notifications_tenant_event_idx, app_private.is_org_member, app_private.has_org_role, app_private.can_access_branch, app_private.can_read_profile, app_private.finance_access, finance_settings_read, app_private.platform_support_snapshot, public.platform_support_snapshot.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021005325_privileged_mfa_sessions.sql

- Responsabilidad: Define app_private.session_is_live, app_private.requires_mfa, app_private.assurance_allowed, app_private.security_context, public.security_context, session_assurance.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021005630_partner_distributions.sql

- Responsabilidad: Define public.partner_distribution_policies, public.partner_distribution_periods, public.partner_distribution_allocations, public.partner_distribution_payments, public.partner_distribution_adjustments, public.partner_withdrawal_allocations, distribution_read, on, partner_payments_allocation, partner_adjustments_allocation, partner_withdrawals_allocation, partner_allocations_staff, app_private.distribution_period_guard, app_private.partner_balance, app_private.partner_distribution_command, public.partner_distribution_command, app_private.partner_distributions, public.partner_distributions, app_private.partner_own_distributions, public.partner_own_distributions.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021010224_reporting_health.sql

- Responsabilidad: Define app_private.financial_series, public.financial_series, app_private.exact_financial_json, app_private.finance_read_exact, public.finance_read_exact, app_private.financial_export_exact, public.financial_export_exact, app_private.scheduler_heartbeat, app_private.operations_health, public.operations_health.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021011210_daily_blocks.sql

- Responsabilidad: Define app_private.assert_schedule_appointments, app_private.manage_record, app_private.save_daily_blocks, public.save_daily_blocks.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021202056_audit_release_boundaries.sql

- Responsabilidad: Define app_private.mfa_factor_mutation_locks, app_private.retain_verified_mfa_factor.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261021214500_customer_list_projection.sql

- Responsabilidad: Define appointments_customer_completed_lookup, appointments_customer_upcoming_lookup, app_private.customer_list_view, public.customer_list_view.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## supabase/migrations/20261022162330_ux_reporting_breakdown.sql

- Responsabilidad: migración histórica aplicada de supabase/migrations/20261022162330_ux_reporting_breakdown.sql.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Autorización, scope y contratos DB/API; conservar guards, grants, locks e historia.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts; revocation.spec.ts; tests/integration/product-release.ts; tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/mfa-helper.ts

- Responsabilidad: Implementa totp, mfaFixture, verifyRequest, verifyClient.
- Dependencias: node:crypto, node:fs/promises, @playwright/test, @supabase/supabase-js
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/mfa-helper.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/operations.spec.ts

- Responsabilidad: Escenarios y asserts de operations.spec.ts.
- Dependencias: @playwright/test, node:fs/promises, @supabase/supabase-js, ../integration/fixtures, ./mfa-helper
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/operations.spec.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/permissions.spec.ts

- Responsabilidad: Escenarios y asserts de permissions.spec.ts.
- Dependencias: @playwright/test, node:fs/promises, @supabase/supabase-js, pg, ../integration/fixtures, ./mfa-helper
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/permissions.spec.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/revocation.spec.ts

- Responsabilidad: Escenarios y asserts de revocation.spec.ts.
- Dependencias: @playwright/test, @supabase/supabase-js, pg, node:fs/promises, ./mfa-helper
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/revocation.spec.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/security-release.spec.ts

- Responsabilidad: Escenarios y asserts de security-release.spec.ts.
- Dependencias: @playwright/test, @supabase/supabase-js, pg, node:fs/promises, ./mfa-helper, @axe-core/playwright
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/security-release.spec.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/setup.ts

- Responsabilidad: Escenarios y asserts de setup.ts.
- Dependencias: @supabase/supabase-js, pg, node:crypto, node:fs/promises, ../integration/fixtures, ../integration/database, ./mfa-helper
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/setup.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/e2e/ux-release.spec.ts

- Responsabilidad: Escenarios y asserts de ux-release.spec.ts.
- Dependencias: @playwright/test, node:fs/promises, ./mfa-helper, pg, ../integration/fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/e2e/ux-release.spec.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/database.ts

- Responsabilidad: Define auth.users, auth.sessions, auth.mfa_factors, auth.fixture_session, auth.jwt, auth.uid.
- Dependencias: embedded-postgres, pg, node:crypto, node:net, node:fs/promises, node:path
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/database.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/finance.ts

- Responsabilidad: Implementa financeContracts.
- Dependencias: node:assert/strict, node:crypto, pg, ./database, ./fixtures
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/finance.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/fixtures.ts

- Responsabilidad: Implementa FixtureUsers, fixtures.
- Dependencias: node:crypto, pg
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/fixtures.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/hardening.ts

- Responsabilidad: Implementa hardeningContracts.
- Dependencias: node:assert/strict, node:crypto, pg, ./database, ./fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/hardening.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/migration-upgrade.ts

- Responsabilidad: Implementa migrationUpgradeContracts.
- Dependencias: node:assert/strict, node:crypto, node:fs/promises, ./database, ./fixtures, pg
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/migration-upgrade.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/onboarding.ts

- Responsabilidad: Implementa onboardingContracts.
- Dependencias: node:assert/strict, node:crypto, pg, node:fs/promises, ./database
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/onboarding.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/product-release.ts

- Responsabilidad: Implementa productContracts.
- Dependencias: node:assert/strict, node:crypto, pg, ./database, ./fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/product-release.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/run-hardening.ts

- Responsabilidad: Escenarios y asserts de run-hardening.ts.
- Dependencias: ./database, ./hardening
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/run-hardening.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/run-product.ts

- Responsabilidad: Escenarios y asserts de run-product.ts.
- Dependencias: ./database, ./product-release
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/run-product.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/integration/run.ts

- Responsabilidad: Escenarios y asserts de run.ts.
- Dependencias: ./database, ../security/contracts, ./finance, ./onboarding, ./hardening, ./product-release, ./migration-upgrade
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/integration/run.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/load/run.ts

- Responsabilidad: Escenarios y asserts de run.ts.
- Dependencias: ../integration/database, node:crypto, node:fs/promises, node:os
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/load/run.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/recovery/local-supabase.ts

- Responsabilidad: Escenarios y asserts de local-supabase.ts.
- Dependencias: node:child_process, pg, node:crypto, node:fs/promises, node:assert/strict, ../integration/database, ../integration/fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/recovery/local-supabase.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/recovery/upgrade-local.ts

- Responsabilidad: Escenarios y asserts de upgrade-local.ts.
- Dependencias: node:child_process, node:crypto, node:path, pg, @supabase/supabase-js, ../integration/migration-upgrade, ../integration/fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/recovery/upgrade-local.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/security/contracts.ts

- Responsabilidad: Implementa contracts.
- Dependencias: node:assert/strict, node:crypto, pg, ../integration/database, ../integration/fixtures
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/security/contracts.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/calendar.test.ts

- Responsabilidad: Escenarios y asserts de calendar.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/calendar
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/calendar.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/chart-values.test.ts

- Responsabilidad: Escenarios y asserts de chart-values.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/chart-values, ../../src/lib/branding, ../e2e/mfa-helper
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/chart-values.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/domain.test.ts

- Responsabilidad: Escenarios y asserts de domain.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/validation, ../../src/features/services/service-picker, date-fns-tz
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/domain.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/environment.test.ts

- Responsabilidad: Escenarios y asserts de environment.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/environment-boundary
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/environment.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/finance-import.test.ts

- Responsabilidad: Escenarios y asserts de finance-import.test.ts.
- Dependencias: node:test, node:assert/strict, fflate, ../../src/features/finance/import-parser, ../../src/lib/validation
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/finance-import.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/public-booking.test.ts

- Responsabilidad: Escenarios y asserts de public-booking.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/public-booking
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/public-booking.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tests/unit/secret-auth.test.ts

- Responsabilidad: Escenarios y asserts de secret-auth.test.ts.
- Dependencias: node:test, node:assert/strict, ../../src/lib/secret-auth
- Riesgos: Dinero exacto, idempotencia o identidad; confirmar con contratos aislados.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: tests/unit/secret-auth.test.ts.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## tsconfig.json

- Responsabilidad: configuración de tsconfig.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: CI quality/supabase-e2e; tests/unit/environment.test.ts según frontera.
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## vercel.json

- Responsabilidad: configuración de vercel.json.
- Dependencias: Entorno, esquema/historial o consumidor; sin imports estáticos.
- Riesgos: Compatibilidad y efectos del entorno; verificar antes de ejecución.
- Defectos comprobados: Ninguno registrado en la pasada inicial; no equivale a ausencia garantizada de fallos.
- Pruebas relacionadas: Ejecutar su comando documentado en entorno aislado; no asumir cobertura unitaria directa..
- Mejora necesaria / conservación: Conservar comportamiento; instrumentar o ajustar presentación solo donde exista evidencia.

## Assets y documentación

| Archivo | Clasificación | SHA256 |
|---|---|---|
| DESIGN.md | documentación (vigencia requiere revisión) | b597475f2ccdd617ee2da623e6ee53068d8205355eae80e12ea4a84d2d7cc83e |
| README.md | documentación (vigencia requiere revisión) | 6193e9b182cd73c345c5ed9e60e63f152ee424229098d8813ccd3df70db9905b |
| docs/1717_INTEGRATION_HANDOFF.md | documentación (vigencia requiere revisión) | 4022da2fefdb7aeeaaad8821544f6b080479c87aa430f642241f40a07b263466 |
| docs/ARCHITECTURE.md | documentación (vigencia requiere revisión) | 63a94e47b7658769ee68719bed40d023b0b8a4429428adc4a270eddc2e14fe83 |
| docs/AUDIT.md | documentación (vigencia requiere revisión) | 23051d452e5a3fecfa1eaf7ffb195ee444dd19f36c81bc39f352b1115e88af5b |
| docs/AVAILABILITY_ENGINE.md | documentación (vigencia requiere revisión) | 593058dc12f66ca6f48d9074288084274ac8abc6cfe3b367d09494c9780bcc4d |
| docs/BACKUP_AND_RECOVERY.md | documentación (vigencia requiere revisión) | dc508515f2e6e5c655878d0fd9ec344df309ff2c541f7a7d941979afba95b01c |
| docs/BOOKING_ENGINE.md | documentación (vigencia requiere revisión) | 892fe8bac548b89e7141fe718ef6334ae7e9f08f82ca8d69834a855e94269f3e |
| docs/CAPACITY_AND_SCALING.md | documentación (vigencia requiere revisión) | 5ce5fb3c74f241b0efc96e2bb10c7bfcb9f394a53d643bdceb96ba8a45efbced |
| docs/CONTINUATION_AUDIT.md | documentación (vigencia requiere revisión) | 689f9d466cd3544c877a61d580e8ac683e7f5529ba24d1955f7abb6f2d0a967c |
| docs/FINAL_AUDIT_INVENTORY.md | documentación (vigencia requiere revisión) | d0c8d1b58998f3d7d1ec95d447054f243daa2ddad8105d5b2521c21c2bd08030 |
| docs/FINAL_HARDENING_AUDIT.md | documentación (vigencia requiere revisión) | 271604a2edb2126724b4e68586c4e0c173212476b418578d6ad54395ddae0dcc |
| docs/FINAL_PERMISSION_MATRIX.md | documentación (vigencia requiere revisión) | 21c465f58ee79f8a98ba7c318ea37f3488523dd6a486f0010b235b90465e6666 |
| docs/FINAL_PRODUCT_AUDIT_2026_10_20.md | documentación (vigencia requiere revisión) | a02e056f01a5961dff8c27be8d46d6c81c525ea4533cc191681c3acad6f04867 |
| docs/FINANCE.md | documentación (vigencia requiere revisión) | 119e75bb9d6d43497def789c8d57598912d74686a65b371f379ec5525497a9e7 |
| docs/FINANCE_IMPORT_1717.md | documentación (vigencia requiere revisión) | ff3c87b1285e9e31e6a0e916d10d6f54a6661756ec989b73c23adb76abc03d01 |
| docs/MULTITENANCY.md | documentación (vigencia requiere revisión) | 8ad5adda4de464957753ff1a2de778456ea6e6770f8af47a1b563bc4d7c17241 |
| docs/NEW_ORGANIZATION_ONBOARDING.md | documentación (vigencia requiere revisión) | 216ed6f93005642487f8a14069516f1818e6210e2a65d7a5a8a200669130aeb0 |
| docs/OPERACION_1717.md | documentación (vigencia requiere revisión) | cbe5cbdf2a33c284ae37abfef85c5b08b9dc0b8c9c3a652ef5229f26da90c864 |
| docs/OPERATIONAL_INCIDENTS.md | documentación (vigencia requiere revisión) | ce3b1f3f35e1503388969862597bd7ed6f3ac25ad0ed58f95db43667621d9a29 |
| docs/PARTNER_DISTRIBUTIONS_DESIGN.md | documentación (vigencia requiere revisión) | 522c9372a5317ca8c0a10c3085e88224611a45cdec4568aad7deafe57aef8adc |
| docs/PILOTO_ESTEBAN_JONATAN.md | documentación (vigencia requiere revisión) | ee919a16ca512982601a55f20baa03c6f57d72857660e86ba678e1d640fcf00a |
| docs/PR3_RECOVERY_AUDIT_2026_10_21.md | documentación (vigencia requiere revisión) | 9cbab6ca34778919cb34cd183d7c153a95b91efbdbe840ba8352f0eff1ac0483 |
| docs/PRODUCTION_READINESS.md | documentación (vigencia requiere revisión) | 2d6699d69cf417353b757f8eee42d3cb9844643ccd6f943850a444d5409edfee |
| docs/PRODUCTION_RELEASE_CHECKLIST.md | documentación (vigencia requiere revisión) | e373f4ddb50b11bba212f0493bb30099289b5490b2b33b272295b47e7f1d8b84 |
| docs/RELEASE_2026_10_19.md | documentación (vigencia requiere revisión) | 634a851f29754d1f4fae3d4af3057e56c670fe78fa3604d0512be67dd943f9f3 |
| docs/RELEASE_REPORT.md | documentación (vigencia requiere revisión) | e2fa3b4d91890efe85f641b2a58975ee98e1eb35195fc306fe20bcd1c1735ddc |
| docs/REQUIREMENTS.md | documentación (vigencia requiere revisión) | 13594797d0509649106af6ab1eb02d8cc5ccb3a38f44739dcb241fee7d8866dd |
| docs/RLS_MATRIX.md | documentación (vigencia requiere revisión) | 4b12ce394724edf0ec0dc924bfa899259217448074b8a3aafa16a78f9c0db1e6 |
| docs/ROLLBACK_PLAN.md | documentación (vigencia requiere revisión) | 12e95fcab9a5642318261a34cad82ad9fc2f4e35025522c471c983bb28ab4015 |
| docs/SCHEMA.md | documentación (vigencia requiere revisión) | c3a5d3d7c75ab151951c253f4b7961e4abb3b681215e2e22876a0d9600f56150 |
| docs/SECURITY.md | documentación (vigencia requiere revisión) | 6dc8f3eb5589ba8b6bdef8a377f0b5967b0e98b9a6f465592f91d4abbef2f24b |
| docs/SECURITY_RELEASE_MATRIX.md | documentación (vigencia requiere revisión) | 70aa9f3c1ca9162a59206b4389d928714fd5e74c61009a5352f7462540c5dc11 |
| docs/SESSION_HANDOFF_2026_10_19.md | documentación (vigencia requiere revisión) | 6e7decb04faefc838ae5a29a0f1da942b827a3ea51fb21a3a948c9c1be8d2b1b |
| docs/STAGING_ROLLOUT_PR3.md | documentación (vigencia requiere revisión) | 6134131443496fe197b48babeed8c04028dabbb91017f48aaaaaeee6863f51d1 |
| docs/UX_BEFORE_AFTER.md | documentación (vigencia requiere revisión) | 4beec757a2c147df81e9843efba3cdb6dfa98d0ced6a341750e1e760ff7b9ab8 |
| docs/UX_COMPONENT_INVENTORY.md | documentación (vigencia requiere revisión) | d218a8d49447be286b57b015ba35e39806669da487338144d0d5078100ca13b5 |
| docs/UX_REDESIGN_REPORT.md | documentación (vigencia requiere revisión) | 3e1072ec5266438b31b3e2a5c62947b290a399a1203bb9cd7541b4b5334a9590 |
| docs/UX_TEST_RESULTS.md | documentación (vigencia requiere revisión) | 58cc09f07458ff835c22ec52d9ddadbcab5b2532fee1bcd5a2e8fb6322f0aa21 |
| docs/VERCEL_DEPLOYMENT.md | documentación (vigencia requiere revisión) | fd552b24535c624ce70da63c6413f03ddd2eb3ba8956ba12a401ec9484a8fec3 |
| docs/VERIFICATION.md | documentación (vigencia requiere revisión) | e2beea91bde3dab5df6299eeefd9b0fbf36bd1d1d736d7d381b9db1fd050e2b9 |
| docs/WEBSITE_INTEGRATION.md | documentación (vigencia requiere revisión) | 24a6044a4689cc044077e1278518841cb13a1f108da5649a30e4678e9c0827f6 |
| docs/design/LEGACY_DARK_DESIGN.md | documentación (vigencia requiere revisión) | a80338b38b859974604ba4f06722a691ff75974eb4ac7ff51d41264f1f8189ce |
| docs/verification/applied-migrations-27.json | evidencia QA | f22e2d0e37ac1685d84f3b66779e962ac99a6c85e07e09da165af1b286463692 |
| docs/verification/deployment-observed-20261020.json | evidencia QA | aa4b0dfdfaa1a86140c22bd1c093680c139c89154944cd61758d2eac70897155 |
| docs/verification/final-file-inventory.json | evidencia QA | 747c1b362b32f768b35eb50d5034409ce161acbcea25b0da03c702ab11b8c871 |
| docs/verification/load-results.json | evidencia QA | 1617d7fdde9ec2766fb14f7384988bd815aeb8b5ef08009b41537f1746ddf2c9 |
| docs/verification/migration-upgrade.json | evidencia QA | 8ec301003ae7645a8c7bbd0304f5eac2069705980a409f3f486d56144c3feaa5 |
| docs/verification/pr3-failure-analysis.json | evidencia QA | 474a0377d0b40f4ab119110c6c28a6b30a09ece9acc55236240671585682775e |
| docs/verification/pr3-final.json | evidencia QA | bfa521c3cf2bbd4212bfdc7c4db8e37486bbd5c47c73c51fa166e4a62d485fc5 |
| docs/verification/pr3/daily-cash-closed.png | evidencia QA / asset binario | ccfe809528fe7cbb16b4622576aa411a2aadc4c8899466e6e9723aef2fffa9a8 |
| docs/verification/pr3/daily-owner-movement.png | evidencia QA / asset binario | aade16a024b7e1af76edc05a7cfc9916d66fb7d7106860ed5ab643c9574f3217 |
| docs/verification/pr3/daily-split-paid.png | evidencia QA / asset binario | 43fe40c4f9f68c46dafcdca80023d56dbdc52c24f0d93cc5b25b48efd812e62f |
| docs/verification/pr3/mobile-menu-focus.png | evidencia QA / asset binario | bf536e750d474c2ae864ea87e1b7dfa1a7ca3b661b66586decfc908051cc0360 |
| docs/verification/restore-final-local.json | evidencia QA | 6e18cae517a97c22a43fa7ed31c94ee6e1520123c3bef152c59f3cf77b144db7 |
| docs/verification/ux/after/login-1440.png | evidencia QA / asset binario | 101647596ca30015aa95d75f7d154959e513834192068f22e7f47709f4f34023 |
| docs/verification/ux/after/login-360.png | evidencia QA / asset binario | a5ef66e6cb94027518fc5f06d8c5b65fd374ea3a95bb756768c2792cd2c9b507 |
| docs/verification/ux/after/login-390.png | evidencia QA / asset binario | 3f3696a4ffb07960d843635f7e87e8087aaf6175909b1e883f0208ea276027d0 |
| docs/verification/ux/after/login-768.png | evidencia QA / asset binario | 487c23f5386f1a8f28427b84345b707862f244db5e34b431a49d34f3f5a5f8ed |
| docs/verification/ux/analysis/design-diff.json | evidencia QA | 0a690a9984379f6bd80b19cbb85e17700f1f36b7b962498c446721e9094655d6 |
| docs/verification/ux/analysis/design-export.css | evidencia QA | 482a8f84d8fadd5bdf3265e055415dd7ce48cbc3eff97476c21bc039c599faf2 |
| docs/verification/ux/analysis/design-lint.json | evidencia QA | 95ef8111e430a32ddd084fb44a5d83ba92edb525ba8fc30e98feb61b835036e9 |
| docs/verification/ux/analysis/local-checks.json | evidencia QA | 44257c169203c7782376089699f5f127dfd60846345f217599167b0c36c34231 |
| docs/verification/ux/analysis/references.json | evidencia QA | 32f17cb17b652ade0e7f8031508d7853f86846ad5c01a24017ef1224f01481f9 |
| docs/verification/ux/analysis/rollout-bundle-local.json | evidencia QA | 47fb862912831425a3456b299f68ee55508e2069ff63495f7da10eac2e0ffca3 |
| docs/verification/ux/analysis/ui-ux-accessibility.md | evidencia QA | 6dbfd60b2105935edce8313c56cd048e0856f961111b51a80662d057208560bf |
| docs/verification/ux/analysis/ui-ux-design-system.md | evidencia QA | 9eb464747931316bb7a847c547d3302ded4386667102199d3f189c8689b14cc3 |
| docs/verification/ux/analysis/ui-ux-enterprise.md | evidencia QA | 52aff8b227cdceae9233363a990df2a9d5240d0caac66c1f2002313b8d2e97ea |
| docs/verification/ux/analysis/ui-ux-react.md | evidencia QA | 9001f34efa81a71c9500919ebdea60506dfb6141a75dd736903f0349119ac247 |
| docs/verification/ux/before/agenda-1024.png | evidencia QA / asset binario | e9afe01826d5d370c882a655dd8a3c0df4e4deae1b58fc43c2f3a1260a66aa37 |
| docs/verification/ux/before/agenda-1440.png | evidencia QA / asset binario | b9362ecea94fa6f24ba361d8974d5fbf9cde18a0359fe4e4236aa8cec95d6792 |
| docs/verification/ux/before/agenda-360.png | evidencia QA / asset binario | 804af8699b494294f96aeb972ab0383994280060820850ff980a62b1c84783c4 |
| docs/verification/ux/before/agenda-390.png | evidencia QA / asset binario | 78719104e429db80eba98d21df6763326baac3196fe9c833a91e91a9c83a0a03 |
| docs/verification/ux/before/agenda-768.png | evidencia QA / asset binario | f27c2c8317331d8cc3f352c3faac7bc84f4c156c3a9d7d96a0068075d95a2302 |
| docs/verification/ux/before/caja-1024.png | evidencia QA / asset binario | 06b6d2d8a9c95559a46d9b7101f5c114790f10f1e87c48fcd0ee8c4422876345 |
| docs/verification/ux/before/caja-1440.png | evidencia QA / asset binario | 1a4db2b8ad414ed749d1131a9b70225544cba8f632ec7a3805c2d27af1fcb044 |
| docs/verification/ux/before/caja-360.png | evidencia QA / asset binario | 759fde510091369e065c4fa86e6906cedcccb318a9a5f4b1b93d0d0f5b97bf16 |
| docs/verification/ux/before/caja-390.png | evidencia QA / asset binario | 04f1b1ba7f925a2cf2c450382d8a4c51abdea698cd99c0be8022d78413b8a54d |
| docs/verification/ux/before/caja-768.png | evidencia QA / asset binario | d2cfaaef2239138558259a8f3d9936b16414fcb9dd8349d21ab884ed7de30c8c |
| docs/verification/ux/before/clientes-1024.png | evidencia QA / asset binario | 4938b20cf83a4011f7167b9c85bde42f6255630572c41cc9aa59184e4bef05f5 |
| docs/verification/ux/before/clientes-1440.png | evidencia QA / asset binario | 834a2a21a8f7b9465a3af5117dd88ce13a536ebe4e6875ee188bbd7a54a37c8d |
| docs/verification/ux/before/clientes-360.png | evidencia QA / asset binario | fc1a4d66975de807d0f1e667fc877edc659e3f028c6be4922f0847128eec16b1 |
| docs/verification/ux/before/clientes-390.png | evidencia QA / asset binario | c0f8ec525007631b7e6de556eb112bc0d42781f404b7d53a6aaba4a76a08416d |
| docs/verification/ux/before/clientes-768.png | evidencia QA / asset binario | 30a36eff70c9a1309852dc6afcc9ef76d06ba8a4fa164630d71a66688ec673d1 |
| docs/verification/ux/before/configuracion-1024.png | evidencia QA / asset binario | 53cd6ccae2db1ced88b8b42635071034cca7daf69ebb349d70d048877ff3297c |
| docs/verification/ux/before/configuracion-1440.png | evidencia QA / asset binario | 5a640528a859abde29d9b07bd07c7baa3b157de86f07a10d1a0dc593644f1d2d |
| docs/verification/ux/before/configuracion-360.png | evidencia QA / asset binario | 35b06c97e4b4c9bd3d38cdd83c58bf694e6714d0039e7c31d187d81d20d22df0 |
| docs/verification/ux/before/configuracion-390.png | evidencia QA / asset binario | 42cc4802466999773bc5cca8e4d1aa49c2bf82b5f6b703728dfe2246b0793ea0 |
| docs/verification/ux/before/configuracion-768.png | evidencia QA / asset binario | 8cb72003f50e8f551e1cbf74ce0db602dd6e358c1d706938dbd2c01d1112fc6b |
| docs/verification/ux/before/equipo-1024.png | evidencia QA / asset binario | 9694657e6ee2f509281d9e8e787eae388a23b9feb9625cdcdac2a723999fb3eb |
| docs/verification/ux/before/equipo-1440.png | evidencia QA / asset binario | d722762ae33cec4b1b410fc4a2cb93497fc0178dc3257473354d7f03c417a4bc |
| docs/verification/ux/before/equipo-360.png | evidencia QA / asset binario | a01ff6e7412ea56e29137fb3ea6e4b677b25e048b79f9c506beaa9fa1f874fed |
| docs/verification/ux/before/equipo-390.png | evidencia QA / asset binario | 5ff2ffe2403d750b54a1944e430e050004bb202c24c96dcaf92411da0248b4ef |
| docs/verification/ux/before/equipo-768.png | evidencia QA / asset binario | a0d3a318eedea668a2e5719ae797cd34a64bf12d19ab446d3d727ff13b3dcf44 |
| docs/verification/ux/before/finanzas-1024.png | evidencia QA / asset binario | 51a8ab6db7b16e3133a03a1bee64cb3c96d79302f0ac576b6ae4859767c04c8c |
| docs/verification/ux/before/finanzas-1440.png | evidencia QA / asset binario | e2cf4c47f633a969a113dcb2726657c39a6129551cef84ce4b8b6a064c69aaff |
| docs/verification/ux/before/finanzas-360.png | evidencia QA / asset binario | 6474f0dd244b55c6ed15e47415d3c2f360fe07dce51d27c2c18ecc81c1e7d235 |
| docs/verification/ux/before/finanzas-390.png | evidencia QA / asset binario | 511cdbb2baa1eedb4ad27a1b310ec57cb2aa2cea30b60046c5d14239459f88a0 |
| docs/verification/ux/before/finanzas-768.png | evidencia QA / asset binario | b9f595f24f3cadb577eb829bb4d113b3974be2553899e08a2fe8442cbb8283b6 |
| docs/verification/ux/before/inicio-1024.png | evidencia QA / asset binario | b7f51f349aba888db5873e0e825c2a20cb6c19bdd0cde7e5ccdec35d40dc9d5a |
| docs/verification/ux/before/inicio-1440.png | evidencia QA / asset binario | 31bab9241dab0b97c1fb67b2bcec539199eb448435a93928717c888c4ac288ab |
| docs/verification/ux/before/inicio-360.png | evidencia QA / asset binario | d3d944f4f47fe589bdb1cc46aabfe225ad2a79715f04e0d6b4e05b12df3fd7b7 |
| docs/verification/ux/before/inicio-390.png | evidencia QA / asset binario | 9e2f44a52fb1041ae5c4a5af5d677dc86bda3b9ce4fac196f479cfe44ac1ae0a |
| docs/verification/ux/before/inicio-768.png | evidencia QA / asset binario | a7b37b3457d9d1c2f14a3fe5a29c9e7fc58ff247ec21416a4257e414078db1f5 |
| docs/verification/ux/before/login-1440.png | evidencia QA / asset binario | b1d8b13ab522a0d6ef6b8a84aedfb02314c6fa627274581ff67628366d3a4f1b |
| docs/verification/ux/before/login-390.png | evidencia QA / asset binario | 2ef3f885e705558b17cefa75a060669ef50ee46a9b5d49615290954d6202de05 |
| docs/verification/ux/before/reportes-1024.png | evidencia QA / asset binario | 7580d346dbf60d6864e9778835bb5528bfdb390e30357ff96e0aef3aeac227bd |
| docs/verification/ux/before/reportes-1440.png | evidencia QA / asset binario | 3ba3f4a2d20ec9497ebef78b9437ff51c02d50f27e96777f5f8bcc389c7b15ce |
| docs/verification/ux/before/reportes-360.png | evidencia QA / asset binario | 29c68410fef96240870d55260b0d8cd5855512c13fcb66407939bf5a5513ba52 |
| docs/verification/ux/before/reportes-390.png | evidencia QA / asset binario | 6aceb7ae2b00fb26d5f0a72af990cf61625b36b7f8d044e79d5934dd7fba253b |
| docs/verification/ux/before/reportes-768.png | evidencia QA / asset binario | e12229c6f31249a469152271b7dc2a356f4a2523739a9c543ae008e2f69d5fc5 |
| docs/verification/ux/before/results.json | evidencia QA | c1f8a7194520df6979982284863e5092d7098d17fcfb8e0e70928f6069fc0628 |
| docs/verification/ux/before/servicios-1024.png | evidencia QA / asset binario | e542d5d37606197aa44f4af8e1aeb28edfd9e9cd01ab735ba13f6c7163ca234c |
| docs/verification/ux/before/servicios-1440.png | evidencia QA / asset binario | 347821b9ec5427eeacd93fe4cbbddc641778a5ced9c61e20805deec04956ff50 |
| docs/verification/ux/before/servicios-360.png | evidencia QA / asset binario | 89861b60bdcad15e1e37371d8b5fbeb2125589d25f6894e337e8c60e5b0eda05 |
| docs/verification/ux/before/servicios-390.png | evidencia QA / asset binario | 9133a298be5ef9a9505bfbbf8cc5c9f9f3fd84d57c9dd9a7ba8e7a1f1ce3b482 |
| docs/verification/ux/before/servicios-768.png | evidencia QA / asset binario | 5309df7720d259c4160bee52c503148f5b18cd9663d03ce4eeaeddfd2de54eb1 |
| docs/verification/ux/final/accessibility.json | evidencia QA | 273f454bf9d39122ff6000636fbf11f897c3f074ec8e011da8387644240812ff |
| docs/verification/ux/final/after-agenda-390.png | evidencia QA / asset binario | 560ba54bf51c981e28be6d75e7e8674ab31c3c2b0f084fa117695df22e8554c5 |
| docs/verification/ux/final/after-checkout-390.png | evidencia QA / asset binario | 85328929be7ca1d6f0d1cdde684beeac0e31e8656373fde425128c40c7b27011 |
| docs/verification/ux/final/after-cliente-ficha-390.png | evidencia QA / asset binario | 2d8ee88da61ce784dc9154c74af74847a07933ff1e0f6a3e595990972c8d4635 |
| docs/verification/ux/final/after-inicio-1440.png | evidencia QA / asset binario | e9f52623de948851b46c22515eea290170c726e361ace69c528f2375cd010c11 |
| docs/verification/ux/final/after.json | evidencia QA | f28c7bb9f1ae5dca6b4738fcb199c37be9371dd80b66eab183e5d27d8bc1d2d5 |
| docs/verification/ux/final/before-agenda-390.png | evidencia QA / asset binario | 0cc6b11d9507c2ed9fcef2f81f39f6d2f28f28f98709b2019a7bcd5182e58fef |
| docs/verification/ux/final/before-checkout-390.png | evidencia QA / asset binario | e08ee425882444ca2559f1a60859f8fb57f536ffee2faac3b2019a6f063c7522 |
| docs/verification/ux/final/before-cliente-ficha-390.png | evidencia QA / asset binario | 3492f7d3bce2e5d6ab6ba656f2c22011eeaeecf919928f9ab2fa0a8529badb9f |
| docs/verification/ux/final/before-inicio-1440.png | evidencia QA / asset binario | 0453fa31fad2c34edd7554313d159dde5050936d24545deed51d0cc4986f5ff7 |
| docs/verification/ux/final/before.json | evidencia QA | 8b8a5453a4e5b76b2417012e72d0aacfebdbbbbe94b13b32872222289448ed0f |
| docs/verification/ux/final/cloud-rollout.json | evidencia QA | 6805b3658b48167752f136798ee7c2d855dfd5e4f67ffa478618636ecb6d2ba1 |
| docs/verification/ux/final/summary.json | evidencia QA | e2e36e802c04df32c4f29ab3841cab77a206f716c062cc40991868174b7f9f5d |
| docs/verification/ux/local-public-auth/login-1024.png | evidencia QA / asset binario | 6e02d4f8f21da9e8df8ba4b531205bbce02c1ad0dc2103433f297a8fff61f735 |
| docs/verification/ux/local-public-auth/login-1440.png | evidencia QA / asset binario | c932b563951c3c61542e68fc96a70990c26d80b1e94d5d2b3040fc5ba1265144 |
| docs/verification/ux/local-public-auth/login-360.png | evidencia QA / asset binario | fef1096d80ba5cc1be175da6bdbf202ae5e6997e6f215c020e35b0a6fdb1d17c |
| docs/verification/ux/local-public-auth/login-390.png | evidencia QA / asset binario | f13f22acafb37428383b5358607b99c14f94a602f360cff9088e5a1a096542b9 |
| docs/verification/ux/local-public-auth/login-768.png | evidencia QA / asset binario | d1411b2066376738b51316059350f9545c07c3fdefc9080f24515e04a0711c50 |
| docs/verification/ux/local-public-auth/recover-1024.png | evidencia QA / asset binario | e944740664eece1aa0d611a6d847d31d6bcdf72a76ba9e2c2a31cd8f24eb4ad0 |
| docs/verification/ux/local-public-auth/recover-1440.png | evidencia QA / asset binario | 0e462b8cafc5c6657475273199277a2519c81d2917a2d1c999be66a6f1221f75 |
| docs/verification/ux/local-public-auth/recover-360.png | evidencia QA / asset binario | a6036ea9c4bfefb68e2589b00df833728e3f23393b3e4047ea3d35d848b58d63 |
| docs/verification/ux/local-public-auth/recover-390.png | evidencia QA / asset binario | 5f75758bd26e69b6f6e92210cca98185c9e66ff604d0be82eb61f806c510109f |
| docs/verification/ux/local-public-auth/recover-768.png | evidencia QA / asset binario | afcb07db249638a86377882af5cd25135c9c85f94327801dfcf4c52885d98c72 |
| docs/verification/ux/local-public-auth/results.json | evidencia QA | 910bae1394132599409227aaa37b366d1b4cde10fa0064bd3861f13a6802e3ee |
| docs/verification/ux/local-public-auth/signup-1024.png | evidencia QA / asset binario | 860b872b0328db030ae7ea601296e7b4de3bed29b2e140f99c86d16a5eed8624 |
| docs/verification/ux/local-public-auth/signup-1440.png | evidencia QA / asset binario | caa6f350bd728d9e854837fa6508487e42b813933dbdaee39448fce16f6a62ad |
| docs/verification/ux/local-public-auth/signup-360.png | evidencia QA / asset binario | 9e55aa9a91cd7d5b5570d6c22e2a9b0719210edeb08e8b8738d91c49bff528c0 |
| docs/verification/ux/local-public-auth/signup-390.png | evidencia QA / asset binario | 1d780b76b7b4eaf1410deb9595dccaa36ea82a573b99e8e1be9f4d18bb1e00e9 |
| docs/verification/ux/local-public-auth/signup-768.png | evidencia QA / asset binario | 67f19ece7970bdc6d759f9b4bb778ddb53a716ef46b68315abf7741c417e0928 |
