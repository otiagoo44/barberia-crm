# Pendientes para el piloto del lunes 26/10/2026

Objetivo: completar la preparación el sábado 24 y ensayar con ambos propietarios el lunes 26. No se declara el negocio listo por publicar código. Estado productivo nuevo en [ESTADO_REAL_1717.md](ESTADO_REAL_1717.md); limpieza separada en [LIMPIEZA_AUDITADA_1717.md](LIMPIEZA_AUDITADA_1717.md).

## Ya no hace falta volver a confirmar

- Se cobra al cliente **después de atender**; no se utilizan señas ni anticipos de clientes. Esto no cambia el tratamiento individual de retiros de propietarios.
- Local lunes–sábado 09–21; domingo cerrado. Horarios individuales confirmados y descanso de Esteban 12–12:30.
- Ocho servicios, precios, duración total de combo 120 minutos y consulta previa para rulos/tintes.
- Cobro con tarjeta reconocido al acreditarse; reparto mensual 50/50, gastos pagados, arrastre de pérdidas, retiros personales y aprobación independiente de ambos propietarios con MFA.
- UPay comunicó totales propuestos de débito 2,2% (IVA incluido), crédito 5,2% (IVA/retención incluidos); no son todavía tarifas verificadas y activadas. No volver a sumar el IVA incluido ni clasificar toda retención como comisión.
- Remitente solicitado: `dentalcrmauth@gmail.com`. Staging cloud quedó pendiente por decisión del usuario; se usan pruebas locales aisladas sin crear recursos de pago.
- Site URL y los dos callbacks productivos ya están correctamente guardados, comprobados en el dashboard. No hace falta volver a cargarlos. SMTP personalizado está deshabilitado: falta configurarlo y probar entrega.
- El usuario confirmó que el cliente y la atención indicados en el informe fueron pruebas ficticias. Su clasificación está resuelta; queda aprobar y ejecutar el tratamiento auditado, conservando los movimientos ya revertidos.
- El usuario confirmó que **no existe aún respaldo recuperable externo y solicitó dejarlo pendiente**. No se ejecutan las migraciones productivas mientras falte este requisito.

## Acciones exactas

| Qué falta | Por qué | Responsable | Dónde | Cómo comprobar |
|---|---|---|---|---|
| Respaldo cloud recuperable y prueba de restauración aislada | El dashboard confirma Free Plan sin backups; no autoriza arriesgar el ledger | Instalador / titular de Supabase | Proyecto exacto → Database → Backups, o exportación privada cifrada a almacenamiento externo autorizado | Registrar fecha, alcance, destino protegido, checksum y restore exitoso fuera de producción. Nunca restaurar encima de producción |
| Recuperar OAuth del MCP | La renovación devuelve `Failed to parse server response`; la lectura se obtuvo por el dashboard | Instalador | Conexión Supabase en Codex | `get_project_url` devuelve el ref exacto y `list_migrations` funciona. No sustituir por otro proyecto |
| Aplicar migraciones 35–40 por el procedimiento de release, después del backup y upgrade aislado | Cloud continúa en 34; faltan vínculo owner, finanzas y diagnóstico/editor | Instalador autorizado + Codex cuando los requisitos estén satisfechos | Proyecto exacto → procedimiento [CONFIGURACION_CLOUD_1717.md](CONFIGURACION_CLOUD_1717.md) | Comparar versiones y revisar RLS/RPC; inspección posterior. Aplicadas en esta intervención: ninguna |
| Configurar SMTP y callbacks; probar entrega/recuperación | El remitente por sí solo no es una conexión SMTP ni prueba entrega | Instalador con acceso privado a Gmail/Supabase | Authentication → Emails → SMTP Settings; Authentication → URL Configuration | Registro y recuperación llegan a los correos reales y los enlaces vuelven al CRM. Ingresar secreto solo en dashboard, nunca en chat o Git |
| Registrar las dos cuentas, confirmar email y verificar identidad | Ambos correos siguen ausentes en Auth | Esteban y Jonatan, cada uno personalmente | [Login](https://barberia-crm-kappa.vercel.app/login) → Crear una cuenta | Dos UUID Auth distintos, correo confirmado; no generar contraseñas compartidas |
| Membresía owner, vínculo correcto y acceso a Luque | Profesional creado no equivale a cuenta autorizada | Propietario/administrador autorizado | Configuración → Usuarios y permisos; Equipo → Barberos | `organization_owner` activo y `staff.profile_id` correcto. Nunca `platform_admin` |
| MFA y respaldo independiente de cada propietario | Operaciones sensibles requieren sesión real verificada | Cada propietario | `/mfa` | Dos factores verificados por cuenta; probar acceso desde su equipo y recuperación independiente |
| Completar catálogo y horarios sin rehacer onboarding | Seis servicios creados, cinco con precio, diez capacidades y doce franjas sin descanso | Actor owner autorizado, con plan revisado | CRM o `configure-confirmed-1717.mjs` después de requisitos y nueva inspección | Ocho servicios en Luque, dieciséis capacidades; descanso obligatorio, domingo cerrado y disponibilidad lunes/miércoles/sábado/domingo |
| Mantener booking público cerrado; ajustar lead a 0 | Sucursal está cerrada al booking, organización aún tiene flag true y lead 60 | Owner autorizado | Configuración → preferencias y sucursal | Ambos flags false, lead 0. No abrir hasta completar piloto |
| Términos UPay, vigencia, cargo fijo, otros cargos y desglose real | Oferta/captura no prueba contrato actual ni todos los descuentos | Esteban + representante UPay + contadora | Liquidación real y oferta/condiciones actuales | Evidencia para débito y crédito, bruto/costos/impuestos/retenciones/neto/fecha. Preparador rechaza componentes o cargo fijo desconocidos |
| Confirmar primer mes y saldo inicial de pérdidas/retiros | No se puede inventar un saldo cero ni abrir repartos con historia incompleta | Ambos propietarios + contadora | Política financiera y comprobantes | Acuerdo registrado. Política actual solo admite apertura sin pérdidas históricas; si las hubiera, mantener bloqueado y preparar incorporación auditada |
| Aprobar y ejecutar archivo/nota del cliente de prueba confirmado | La clasificación no autoriza una cancelación retroactiva ni borrar historial | Usuario aprueba impacto; actor owner autorizado ejecuta | Informe de limpieza, UUID concretos | Cliente archivado y nota auditada solo después de aprobación y acceso autorizado. Atención e historia preservadas; ventas y gasto ya revertidos no se revierten otra vez |
| Receptor real de alertas y prueba de entrega | Respuesta HTTP no acredita que alguien recibió una alerta | Instalador / responsable operativo | Monitoreo y canal autorizado | Alerta de prueba técnica recibida, responsable y horario de respuesta documentados |
| Piloto con ambos propietarios | Ninguna prueba automática sustituye el uso real | Esteban, Jonatan e instalador | CRM desde sus dos equipos | Cliente → atención → cobro real → caja/reportes; comprobar errores y roles sin crear dinero ficticio |

## Qué puede quedar preparado automáticamente

No hay que cargar todo a mano. El manifiesto y los generadores permiten preparar catálogo, precios, capacidades, horario comercial y reglas semanales usando los UUID reales. Se inspeccionan antes de aplicar, conservan historia y requieren actor autorizado. La publicación tampoco asigna cuentas ni activa dinero automáticamente.

Las contraseñas, confirmación del correo, autenticadores, credenciales SMTP, condiciones del proveedor y aceptación del resultado del piloto son personales o externas. Codex puede verificar su resultado, pero no inventarlo.

## Orden para hoy y decisión del lunes

1. Respaldo recuperable y SMTP. En paralelo, terminar pruebas y PR del código.
2. Upgrade aislado desde 34; aplicar migraciones solo al superar el requisito de backup.
3. Alta de ambos, identidad, memberships, vínculo y MFA.
4. Aplicar plan de configuración revisado; comprobar catálogo/horarios efectivos; mantener reservas y reparto cerrados.
5. Conciliar UPay antes de permitir sus cobros. Si la tarifa no está verificada, no inventar una regla cero para hacer funcionar tarjeta.
6. Lunes: piloto supervisado con ambos. Si no hay respaldo, accesos seguros, caja y catálogo/agenda verificados, hacer solo ensayo aislado y posponer uso productivo. Publicar código no elimina esos requisitos.
