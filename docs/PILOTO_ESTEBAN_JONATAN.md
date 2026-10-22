# Preparar la prueba de 17:17 con Esteban y Jonatan

Guía de entrega del rediseño, 22/10/2026. Acceso previsto: https://barberia-crm-kappa.vercel.app/login. El estado de publicación y su SHA se registran en UX_TEST_RESULTS.md; este documento no certifica por sí solo un despliegue.

## Lo que necesitás pedirles

| Información / decisión | Para qué se usa |
|---|---|
| Un correo personal accesible para cada uno | Crear dos cuentas individuales, confirmar correo y recuperar acceso. No compartir una contraseña. |
| Quién administrará el negocio: uno o ambos; quién cobrará | Asignar roles reales y sucursal. Ambos profesionales deben vincularse a su propia cuenta; ser barbero y ser propietario son funciones distintas. No necesitan ser administradores de plataforma. |
| Teléfono con aplicación autenticadora para quienes administren/finanzas | Enrolar MFA desde `/mfa`; confirmar el código. Preparar un autenticador de respaldo independiente antes de depender del sistema. No enviar QR, claves TOTP ni contraseñas por chat. |
| Precios, duración, categoría y retorno sugerido de cada servicio | Revisar los cinco servicios actuales. Confirmar combos, tintes y consulta previa de rulos; no publicar tiempos o precios supuestos. |
| Franjas de cada día y descansos de Esteban y Jonatan | Cargar **Equipo → Turnos del día**. Sus horarios son variables: no imponer disponibilidad semanal ficticia. |
| Medios de pago aceptados y tarifas POS vigentes con evidencia | Revisar efectivo, transferencia, débito y crédito, incluidos porcentajes y cargos fijos. Un porcentaje del Excel histórico no prueba la tarifa actual. |
| Efectivo inicial y persona responsable del cierre | Abrir caja con saldo contado y practicar cierre/diferencia. El sistema registra cobros; no procesa transferencias ni tarjetas por sí mismo. |
| Gastos del período y acuerdo de reparto | Ya está documentado reparto 50/50 después de gastos. Confirmar periodicidad, retiros/adelantos, pérdidas previas, quién aprueba y cuándo se cierra antes de habilitar distribuciones registradas. |
| Si migrarán el Excel anterior | Resolver con evidencia las filas 110, 194, 330 y 463 y los conceptos ambiguos; revisar en simulación antes de confirmar. Es opcional para empezar con operaciones nuevas. |
| Logo, color, teléfono y dirección definitivos, si quieren cambiarlos | Personalización del tenant y contacto. No hacen falta tarjetas, claves bancarias ni credenciales del POS. |

## Lo que tenés que hacer manualmente como instalador

1. **Correo de Auth:** configurar en Supabase un SMTP propio con remitente/dominio verificados, Site URL y redirects hacia el dominio publicado. Probar confirmación y recuperación en un correo autorizado. El formulario renderizado y la suite local no demuestran entrega real de email. Introducir credenciales directamente en el proveedor; nunca en Git ni por chat.
2. **Cuentas y permisos:** hacer que cada uno cree/confirme su cuenta; desde el propietario, asignar membresía y sucursal. Vincular el `profile` de cada cuenta al registro de Esteban/Jonatan en **Equipo**. Verificar con cada sesión lo que puede leer y operar. La cuenta que configura usuarios necesita rol propietario y MFA.
3. **MFA:** cada cuenta privilegiada completa su enrolamiento, verifica un inicio nuevo y registra un respaldo independiente. El instalador no debe guardar sus secretos. Si se pierde todo factor, usar el procedimiento supervisado de STAGING_ROLLOUT_PR3.md; no desactivar guards/RLS para desbloquear una cuenta.
4. **Catálogo y horarios:** revisar precios/duraciones y servicios habilitados en el local. Ambos tienen capacidades del catálogo, pero todavía hace falta cargar franjas reales por fecha. Revisar descansos y ausencias. Sin horarios no hay una capacidad válida para ofrecer reservas.
5. **Finanzas:** validar medios y reglas POS, modelo de remuneración y gastos. Abrir caja con dinero contado. Habilitar la política de distribuciones sólo después del acuerdo explícito; aprobación no equivale a pago y el sistema no ordena transferencias bancarias.
6. **Respaldo y recuperación cloud:** elegir responsable, frecuencia, retención y almacenamiento privado; probar restauración aislada de una copia real y registrar RPO/RTO. El restore de CI verifica el código contra fixtures, no sustituye un backup del proyecto de la barbería.
7. **Alertas y soporte:** definir quién recibe incidencias y un canal de monitoreo. Conectar el monitor privado sin publicar su secreto, comprobar una alerta y acordar cómo avisar errores durante el piloto. El motor usa el scheduler existente de Postgres.
8. **Reservas online, si las quieren:** habilitarlas en preferencias del negocio y del local únicamente después de catálogo/horarios, probar el enlace público con una reserva autorizada y confirmar su aparición en Agenda. No habilitarlas para rellenar la agenda ni confundir pruebas con clientes reales.

## Estado comprobado antes del rollout

El proyecto cloud tiene una organización activa, una sucursal, dos profesionales, cinco servicios y diez capacidades. Hay cuatro medios de pago. No tiene franjas semanales ni excepciones diarias cargadas. Reservas públicas deshabilitadas; sin citas, ventas, pagos, gastos, liquidaciones ni cajas abiertas. Existe una cuenta Auth y ningún factor verificado. Esto no representa dos accesos ya preparados para Esteban y Jonatan. No se agregan fixtures al proyecto cloud.

## Prueba de aceptación en la barbería

Hacerla con ambos presentes, una cuenta por persona y operaciones acordadas. Usar un cliente de prueba claramente identificado y registrar el período de prueba para no mezclarlo con ingresos reales; no inventar una transferencia o un pago de tarjeta.

1. Entrar, confirmar MFA y cambiar sucursal cuando corresponda; comprobar que el profesional ve su propio alcance.
2. Cargar dos franjas y un descanso para cada profesional; revisar disponibilidad y ocupación desconocida/conocida.
3. Crear una reserva de duración conocida; revisar día/semana y que otro profesional pueda atender en paralelo. Intentar solapar el mismo profesional: debe rechazarse.
4. Registrar un cliente sin cita, asignar profesional, check-in, iniciar y completar. Abrir su ficha, revisar historial/notas y agendar retorno.
5. Abrir caja. Revisar checkout, aplicar sólo descuentos autorizados, elegir método o dividir pago. Confirmar después de respuesta del servidor; repetir un clic/reintento no debe duplicar el cobro.
6. Registrar un gasto de prueba autorizado. Cerrar caja con efectivo contado; revisar esperado/diferencia y movimiento desde propietario/finanzas. Conciliar ventas, cobros, POS, gasto y resultado: son conceptos distintos.
7. Revisar reportes y tablas de datos del período, sin estimar capacidad faltante como 0%. Comprobar el retorno pendiente y la próxima reserva.
8. Salir y entrar de nuevo, también en teléfono. Probar recuperación por correo y acceso con el autenticador de respaldo. Si habilitan reservas públicas o distribuciones, ensayarlas por separado con su configuración confirmada.

Anotar fecha, responsables y resultado de cada paso. Aprobar el piloto cuando las diferencias estén conciliadas y no haya bloqueos críticos. La publicación técnica, por sí sola, no confirma correo, soporte, datos comerciales ni entrenamiento de los usuarios.
