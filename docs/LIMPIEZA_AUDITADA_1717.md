# Limpieza auditada de 17:17 — 24 de octubre de 2026

Proyecto exclusivo `tbcfhagteyqufjkmbxzz`. Organización `db03ca0c-48cc-46d2-bcbe-86c6ba8525d4`; Luque `1c10857c-c9da-442a-a1cb-46edd114832d`.

Inspección nueva mediante SQL Editor del dashboard, en transacciones `begin read only`, después de las operaciones manuales del instalador. El conector MCP falló al renovar OAuth. Se ejecutó primero `scripts/inspect-1717.sql`; consultas adicionales comprobaron relaciones y reversiones. No se ejecutó ninguna limpieza.

Las fechas de esta tabla son UTC. No se deduce que un registro sea ficticio por ser reciente.

| Tipo / UUID | Estado y fecha | Dependencias / impacto | Acción propuesta / resultado |
|---|---|---|---|
| Checkout `eba3c97f-7fb2-4621-a31a-4d4b8fffc89e` | Revertido; creado 24/10 19:57; revertido 20:24 | G. 30.000, concepto Curso; pago y contramovimiento existentes | Preservado. No repetir reversión |
| Checkout `f9d591de-4a7d-423c-a517-c3ebd5afd479` | Revertido; creado 24/10 19:56; revertido 20:24 | G. 30.000, concepto Curso; pago y contramovimiento existentes | Preservado. No repetir reversión |
| Checkout `4ad01a19-c82b-40fc-aaad-05c988e327ce` | Revertido; creado 24/10 20:25; revertido 20:27 | Corte, cliente y atención; G. 30.000 | Preservado. No repetir reversión |
| Pago `587a33e2-cd2f-4374-ab3a-043a9d6e18cd` → `62dc7b82-8f49-49d4-818d-9c2754d3a87c` | Original + reversión, transferencia | Checkout `eba3c97f…` | Ambos preservados; neto registrado cero |
| Pago `f86f69f7-2e4b-4e99-a7df-540aa3ca1988` → `2312a030-a3e2-4fa5-a91b-b6bcbb1abcef` | Original + reversión, transferencia | Checkout `f9d591de…` | Ambos preservados; neto registrado cero |
| Pago `687d3982-20ee-4e05-83f9-e19c148e0815` → `50b0f128-2aea-4d44-899e-9e8874cdba2c` | Original + reversión, transferencia | Checkout `4ad01a19…` | Ambos preservados; neto registrado cero |
| Gasto `88e3e117-9ca1-4844-8de9-76520bab18af` | Operativo G. 15.000; 24/10 19:57, revertido 20:24 | Historial de gasto | Preservado. No repetir reversión |
| Caja `d2eebc0c-a064-44ee-94bc-7a3f4a99ee0a` | Cerrada 24/10 20:00 | Apertura 19:59 e historial de caja | Preservada; no reabrir para limpiar |
| Cliente `cf6ee03b-fcc7-4074-a137-7eed25f14394` | Activo; creado 24/10 20:25 | Atención completada y checkout revertido | Pendiente de clasificación del instalador. Si confirma que es ficticio y aprueba el impacto, archivar por la operación autorizada; conservar relaciones |
| Atención `e21518ed-3e2d-4862-95f9-20b0e2e2164b` | Completada; 24/10 20:30–21:10 | Cliente anterior, Esteban y checkout revertido | Preservada. No inventar una cancelación retroactiva; definir tratamiento operativo después de confirmar que fue prueba |
| Concepto `46ccf9e9-a7b5-4b1f-9472-c7601ba5b553` | Curso activo, sin precio; creado 19/10 | Dos ventas revertidas | Es un concepto del onboarding inicial, no un duplicado nuevo demostrado. Preservado |
| Servicio `45c14d3a-7491-49a2-ad8d-1cd0f5b44be5` | Tinte Global, 150 min, consulta previa | Aún sin precio/asociación a Luque | Conservar y completar configuración; no crear otro slug `tinte-global` |

## Horarios manuales preservados

Jonatan: `94b7aca6-9c39-4a14-b758-10c4513d7318`, `94e29709-93c0-4f57-ab29-c28251718a29`, `6fd54174-443d-45e9-9ea4-f9aff273ba4d`, `23787a7e-8589-40ba-ac53-4fd16ba393ef`, `b03e2330-189c-4e21-bae8-128dee6e8f0e`, `0eee4286-b179-4445-ad86-eb5d386803ff`: lunes a sábado 13–21, coherentes con el acuerdo.

Esteban: `ddeb5177-b559-4e22-a6f2-a1e92bfb52cc`, `9adaa50d-e6a3-43d3-9c93-866e5feeab04`, `85c4e787-2145-47cb-961f-6caf16ce0f57`, `c6b2ed0b-7606-400a-997b-6a3c8db43070`, `a48ae44d-dba6-465d-8bd1-ed26f44fe397`, `a52ea7c0-b396-4a2c-b0b1-73ce9d495a57`: lunes a sábado, turnos correctos pero continuos. Incorporar pausa 12–12:30 mediante versión prospectiva, conservando estos registros históricos y las citas.

No había excepciones diarias, ausencias ni cierres extraordinarios en esta inspección. No había borradores ni ventas posteadas sin reversión. No había pagos con tarjeta ni distribuciones.

**Balance de esta intervención:** registros anulados por Codex: **0**. Registros financieros ya revertidos: preservados. Cliente y atención: pendientes de clasificación y aprobación explícita antes de corregir. Ninguna devolución bancaria fue ejecutada o afirmada.
