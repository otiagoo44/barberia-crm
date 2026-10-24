# Estado real de 17:17 — inspección 24/10/2026

Base de código inicial: `65a84d329d1ae6ff1e9be3f2b710f6aac44088c2`. PR #7 integrado; no cambios locales al comenzar. Proyecto exclusivo `tbcfhagteyqufjkmbxzz`; ninguna escritura productiva efectuada en esta intervención.

Lectura nueva mediante dashboard Supabase, transacciones `begin read only`; primero `scripts/inspect-1717.sql`. El MCP no renovó OAuth. El navegador denegó acceso al origen del CRM; no se eludió esa decisión ni se reutilizaron credenciales de la sesión.

## A. Configurado y comprobado en producción

| Elemento | Evidencia actual |
|---|---|
| Organización / Luque | `db03ca0c-48cc-46d2-bcbe-86c6ba8525d4` / `1c10857c-c9da-442a-a1cb-46edd114832d`, activos, PYG, America/Asuncion, dirección y teléfono coincidentes |
| Profesionales | Esteban `7b161038-cc4c-49ef-8505-6f63a1cb8998`; Jonatan `a66354c2-2bdf-46cb-98e4-fd6389d8fd7c`, activos y asignados; `profile_id` null en ambos |
| Auth de propietarios | Ambos correos ausentes. Sin membresía personal ni factores MFA comprobados para ellos |
| URLs Auth | Site URL productiva correcta; exactamente los dos callbacks de confirmación y recuperación documentados, verificados en dashboard |
| Registro | Alta por email habilitada, confirmación de email obligatoria y sign-in anónimo deshabilitado, verificados en dashboard. No se cambió esta política |
| MFA del proyecto | TOTP habilitado, hasta diez factores por usuario, límite de sesión AAL1 de quince minutos habilitado. Esto no acredita MFA personal de cuentas que aún no existen |
| SMTP | SMTP personalizado **deshabilitado** en Authentication → Emails → SMTP Settings; no hay prueba de entrega desde el remitente solicitado |
| Catálogo | Seis servicios. Cinco originales con precio; Tinte Global ya creado, 150 min, consulta previa, sin precio en Luque. Diez capacidades originales |
| Horarios manuales | Doce reglas recurrentes cargadas 24/10: seis Jonatan 13–21; seis Esteban con turno correcto pero sin separar su pausa |
| Horario comercial | Lunes–sábado **08–21**; requiere corregir a 09–21. No fila domingo |
| Excepciones / ausencias / cierres | Sin registros en la consulta actual; conservar si se agregan después |
| Métodos | Efectivo, transferencia, débito y crédito activos; solo efectivo/transferencia con tarifa 0 del setup inicial. Tarjetas sin reglas |
| Reservas públicas | Organización true, Luque false: efectivamente cerradas para Luque. Lead actual 60; acuerdo confirmado 0 |
| Movimientos manuales | Tres checkouts ya revertidos; seis pagos (tres originales y tres contramovimientos); gasto G. 15.000 revertido; una caja cerrada; un cliente y una atención completada |
| Distribuciones | Sin políticas ni períodos de reparto |
| Migraciones | **34** remotas, última `20261022162330_ux_reporting_breakdown`; seis pendientes contando la nueva migración 40 |
| Backup cloud | Dashboard → Database → Backups confirma **Free Plan does not include project backups**. No se verificó exportación externa recuperable |

Los movimientos se detallan por UUID, fecha y dependencias en [LIMPIEZA_AUDITADA_1717.md](LIMPIEZA_AUDITADA_1717.md). No se clasificaron todos como ficticios ni se borró historial.

## B. Código preparado y verificación aislada

Se corrige `otro` → sin sección pública, validación por campo, errores de dependencia en cobros, venta manual de servicios reales, editor semanal transaccional/idempotente, diagnóstico por evidencia y preparación POS versionada. La migración 40 es incremental; las 39 anteriores permanecen intactas. Resultados y publicación se registran en [PRUEBAS_CONFIGURACION_1717.md](PRUEBAS_CONFIGURACION_1717.md).

El editor consulta compatibilidad antes de habilitar guardado: si falta su RPC, sigue cerrado y se conservan las pantallas anteriores. Las distribuciones mantienen el bloqueo existente mientras falte el esquema financiero. Un error de lectura del diagnóstico nunca se presenta como configuración verificada.

## C. Operaciones manuales externas

SMTP/entrega, registro individual, confirmación de email, identidad, MFA y respaldo de cada cuenta, backup recuperable/restore, evidencia UPay, responsable y entrega de alertas, y piloto con ambos. Ver [PENDIENTES_MANUALES_1717.md](PENDIENTES_MANUALES_1717.md).

## D. Bloqueos concretos

- Migraciones productivas: respaldo productivo recuperable aún no verificado. No se modifica el ledger ni se cambia de plan automáticamente.
- Aplicación del plan de negocio y vínculo de cuentas: requiere actor autorizado real, acceso operativo y las cuentas existentes; no se fabrican JWT ni claims en SQL.
- Tarifas definitivas: faltan condiciones actuales, vigencia, cargo fijo/otros cargos y desglose verificable. El porcentaje comunicado no prueba conciliación.
- Activación comercial: piloto real pendiente. Reservas públicas y reparto permanecen cerrados.
