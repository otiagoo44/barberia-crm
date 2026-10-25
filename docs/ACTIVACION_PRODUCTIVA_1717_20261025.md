# Activación de 17:17 — inspección del 25/10/2026

Bitácora de la inspección inicial y controles preparados; **no es un recibo de activación comercial**. Proyecto autorizado confirmado por MCP y dashboard: `tbcfhagteyqufjkmbxzz`. Organización `db03ca0c-48cc-46d2-bcbe-86c6ba8525d4`, sucursal Luque `1c10857c-c9da-442a-a1cb-46edd114832d`. PYG, America/Asuncion, identidad preservada.

## Hechos productivos reconsultados

- Pro activo y copias físicas disponibles, última 25/10 05:00:36 UTC. [Cobertura, retención y recuperación](RECUPERACION_PRIVADA_1717.md). No se asumió que el upgrade de plan ya hubiera creado una copia.
- Cloud conserva 34 migraciones a las 23:18:35 UTC; local incorpora las seis pendientes originales 35–40 y la corrección prospectiva 41 de textos del scheduler. Ninguna migración histórica se modifica. 33 coinciden por contenido normalizado; la diferencia de la 24 es exclusivamente de codificación y está reproducida en el ensayo. RLS activo en todas las tablas públicas.
- Catálogo general: seis servicios, cinco asociados/preciados en Luque. `tinte-global` existe con UUID `45c14d3a-7491-49a2-ad8d-1cd0f5b44be5`, consulta previa y 150 minutos, sin precio en Luque. No duplicarlo. Combo rulos/corte y tinte mechas todavía faltan.
- Ambos staff activos y asignados a Luque; diez capacidades actuales. Esteban `7b161038-cc4c-49ef-8505-6f63a1cb8998`; Jonatan `a66354c2-2bdf-46cb-98e4-fd6389d8fd7c`; ambos sin vínculo de perfil.
- Doce reglas semanales: seis correctas de Jonatan 13–21 y seis continuas de Esteban, sin descanso. No hay reglas dominicales ni excepciones. El horario comercial todavía es 08–21 lunes–sábado. Objetivo: 09–21, descanso 12–12:30, 18 segmentos individuales sin duplicar historia, conforme al manifiesto.
- Efectivo, transferencia, débito y crédito activos como métodos. Efectivo/transferencia tienen tasa cero; tarjetas no tienen reglas de tasa activadas. No se inventó evidencia de UPay ni cargo fijo cero.
- Tres checkouts `eba3c97f-7fb2-4621-a31a-4d4b8fffc89e`, `f9d591de-4a7d-423c-a517-c3ebd5afd479`, `4ad01a19-c82b-40fc-aaad-05c988e327ce` siguen reversed. Cada uno conserva dos pagos, uno inverso, y neto firmado cero. El gasto `88e3e117-9ca1-4844-8de9-76520bab18af` sigue revertido. No repetir reversiones.
- Cliente ficticio confirmado `cf6ee03b-fcc7-4074-a137-7eed25f14394` continúa activo: una atención, un checkout revertido y cero notas. Atención `e21518ed-3e2d-4862-95f9-20b0e2e2164b` continúa completed. El impacto propuesto es archivar solo ese cliente y agregar una nota auditada que identifique la atención como prueba; conservar todos los UUID/estados/movimientos y no inventar una cancelación retroactiva. [Revisión específica](LIMPIEZA_AUDITADA_1717.md); no se ejecutó esa corrección.
- Los correos de Esteban y Jonatan siguen ausentes en Auth a las 23:18:35 UTC. No hay membresías, vínculos ni MFA personales que certificar. El destinatario de prueba autorizado `ortegatiago733@gmail.com` sí existe y está confirmado; no se lo sustituye por los propietarios.
- Cron interno activo cada minuto; últimas ejecuciones observadas 23:16, 23:17 y 23:18 UTC succeeded. No existe política de distribución de 17:17 habilitada. El scheduler funcionando no acredita un canal de alertas recibido.
- Booking organización=true y Luque=false. Catálogo público JSON versión 1 con `branches: []`; disponibilidad 404; ruta book 200 HTML. Reservas públicas siguen cerradas, sin POST productivo de prueba.

## Trabajo técnico y límites

[Evidencia verificable](verification/activation-20261025/README.md): pruebas completas aisladas, upgrade, restauración cifrada local, comparación cloud y diagnóstico exacto de Vercel. El PR #8 se conserva como candidato, sin duplicar su editor/servicios/caja ni cambiar identidad visual. El merge requiere los controles del HEAD final, incluidos los de despliegue. No se cambiaron protecciones.

El backup lógico real y su restauración no deben declararse hechos por pasar el ensayo con fixtures. La nueva contraseña PostgreSQL la introduce el usuario en el comando oculto; no se solicita por chat. SMTP se prepara con Gmail y el usuario ingresa y guarda su contraseña de aplicación; la entrega/recuperación se verifican después. El navegador denegó acceso al origen del CRM y no se intentó eludirlo.

## Operación sin documentación adicional de UPay

El usuario confirma que no consiguieron contrato/liquidación y quiere poder usar agenda, clientes y caja. Su ausencia no debe presentarse como bloqueo de toda operación: efectivo/transferencia se verifican por separado y una tarjeta puede registrarse con costo pendiente. Los 220/520 bps permanecen propuestas totales, sin sumar IVA otra vez, sin recargo y sin imputar toda retención como comisión definitiva.

La primera acreditación bancaria real y el detalle de la operación permitirán comenzar la conciliación; no se fabrica ahora una referencia. Mientras falten componentes requeridos por el motor, el reparto definitivo conserva su bloqueo. Tampoco se registran transferencias bancarias reales automáticamente. El acuerdo 50/50 mensual, cobros elegibles, tarjetas acreditadas, gastos pagados, pérdidas, retiros y dos owners con MFA se conserva.

## Próximas intervenciones humanas

1. Guardar SMTP y comprobar correo recibido por `ortegatiago733@gmail.com`; después probar confirmación y recuperación independientes.
2. Ejecutar `scripts/backup-1717.ps1` ingresando PostgreSQL y frase de cifrado en prompts ocultos. Conservar copia cifrada fuera del equipo y frase en gestor separado; no versionar ninguna.
3. Cada propietario se registra desde `/login` → Crear una cuenta, confirma su propio email y verifica sus autenticadores reales. Después el actor autorizado asigna `organization_owner`, habilita Luque y vincula el staff correcto sin degradar a barber.
4. Validar una acreditación real de UPay cuando exista y definir destinatario/proveedor de alertas. Destinatario autorizado: `ortegatiago733@gmail.com`; entrega todavía no probada.
5. Revisar por separado el archivo/nota del cliente ficticio antes de aplicarlos. Realizar el piloto con ambos, sin cobros ficticios productivos.
