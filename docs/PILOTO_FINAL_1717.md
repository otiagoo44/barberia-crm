# Piloto final 17:17

Estado: **no ejecutado con los propietarios**. Datos de prueba únicamente en staging/entorno aislado. No crear clientes, ventas o pagos ficticios en producción.

1. SMTP configurado y entrega confirmada. Cada owner registra/recupera su cuenta, verifica correo, MFA y autenticador de respaldo; prueba recuperación independiente. Comprobar rol owner, staff correcto y Luque. No platform_admin.
2. Catálogo completo y precios/duraciones guardados. Tintes/rulos/combos requieren consulta previa. Horario público 09–21 de lunes a sábado; domingo cerrado. Turnos individuales y pausa Esteban 12–12:30. Probar ausencia, cierre, override y reserva solapada conservando historia.
3. Reserva del mismo día con capacidad. Llegada 15 minutos tarde: el personal evalúa, registra estado y auditoría. No multa ni cancelación automática; una atención en curso no se cancela por el reloj. Reprogramación humana.
4. Agenda → cliente existente → walk-in → atención → checkout → split efectivo/tarjeta → conciliación bancaria real → cierre de caja. Probar diferencia de caja justificada, lectura de reporte y reversión en staging. La fecha de banco puede diferir del cobro.
5. Gasto pagado, factura pendiente, retiro de cada owner y anticipo mayor que su parte. Confirmar que ninguna salida se descuenta dos veces y que anticipos reembolsables tienen su elegibilidad resuelta.
6. Mes con pérdida y meses de recuperación parcial/total; propuesta con fuentes incompletas bloqueada. Esteban aprueba y no puede pagar aún; Jonatan aprueba con su cuenta. Alterar un dato en staging invalida la propuesta antigua. Probar revocación/MFA, concurrencia, saldo y período cerrado.
7. Restaurar respaldo aislado y verificar saldos, pérdidas, aprobaciones y dedupe. Probar alertas al responsable, recibir y registrar evidencia. Acordar soporte y recuperación.
8. Ambos propietarios firman la evidencia del piloto y la política. Solo entonces considerar activación; booking y distribuciones tienen gates separados. No modificar todavía `1717barber`.

Registrar fecha, actor real, entorno, SHA, migraciones y referencias privadas de evidencia para cada paso. No publicar contraseñas, sesiones, TOTP, liquidaciones bancarias ni datos de clientes.
