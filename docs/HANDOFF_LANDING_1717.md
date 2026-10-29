# Actualización 29/10/2026

La integración pública está activa y existe una reserva real del usuario verificada en base y observada en Agenda. Se agregó el aviso manual por WhatsApp después de confirmar, usando el teléfono público de la sucursal. Estado vigente, pruebas, carpetas locales y acciones personales: [cierre del 29/10](ESTADO_LANDING_1717_20261029.md). Los encabezados siguientes conservan estados históricos y no instruyen a repetir onboarding ni cerrar flags activos.

# Histórico: actualización 26/10/2026

El CRM productivo ya tiene catálogo y horarios confirmados cargados; ambos flags de booking siguen false y lead es 0. Staging separado `zdogqqmitpbwjgohwcww` pasó un enlace de landing sintética → booking CRM → reserva ficticia real en staging; no certifica la landing productiva. No se modificó `otiagoo44/1717barber` ni se hicieron reservas ficticias productivas. [Estado y evidencia actuales](ACTIVACION_PRODUCTIVA_1717_20261026.md). Los endpoints públicos siguen cerrados hasta cuentas/MFA, piloto e integración real autorizados.

# Histórico: actualización 25/10/2026

Reconsulta productiva: `GET /api/public/catalog?organization=1717-barberia&branch=luque` devuelve 200 JSON, `website_booking_version: 1`, organización y PYG correctos, pero `branches: []`. Disponibilidad para el 26/10 devuelve 404 JSON y `/book/1717-barberia/luque` 200 HTML. Luque mantiene booking=false. No se hizo POST de reserva en producción y no se considera listo para una prueba pública autorizada hasta completar configuración y gates. [Evidencia HTTP](verification/activation-20261025/public-http.json), [activación y pendientes](ACTIVACION_PRODUCTIVA_1717_20261025.md). No se modificó `otiagoo44/1717barber`.

## Acuerdo confirmado el 24/10

Horario público confirmado lunes a sábado 09:00–21:00, domingo cerrado. Pausa obligatoria Esteban 12:00–12:30 y turnos individuales según `config/onboarding/1717.json`. Reservas del mismo día con capacidad, tolerancia 15 minutos evaluada por personal y consulta previa para rulos/tintes. **Todavía no aplicar a `1717barber`**: el catálogo/horario productivo sigue sin guardar y Luque permanece sin booking público. [Inventario cloud](ACTIVACION_CLOUD_1717.md) y [piloto](PILOTO_FINAL_1717.md). Este encabezado sustituye los pendientes antiguos sobre horarios/pausa/domingo; conserva el contrato existente.

---

# Handoff para 1717barber

La landing no se modifica en esta entrega. El contrato existente se conserva.

Origen público del CRM: `https://barberia-crm-kappa.vercel.app`.
Organización esperada: `1717-barberia`. Sucursal esperada: `luque`.
Proyecto Supabase autorizado: `tbcfhagteyqufjkmbxzz`; la landing consume el gateway del CRM, no SQL ni RPC privados.

## Variables públicas existentes del contrato

```env
BARBERIA_OS_PUBLIC_URL=https://barberia-crm-kappa.vercel.app
BARBERIA_OS_ORGANIZATION_SLUG=1717-barberia
BARBERIA_OS_BRANCH_SLUG=luque
```

Se conservan los nombres documentados en WEBSITE_INTEGRATION.md; no se afirma que ya estén guardados en la landing. SITE_URL, si existe, corresponde únicamente a su SEO. No compartir BOOKING_GATEWAY_SECRET, WORKER_SECRET, CRON_SECRET, service_role, credenciales DB ni sesiones de propietarios. Si la landing enlaza el booking alojado no necesita claves Supabase.

## Endpoints

- `GET /api/public/catalog?organization=1717-barberia&branch=luque`
- `GET /api/public/availability?organization=1717-barberia&branch=luque&service=corte-de-pelo&date=AAAA-MM-DD` (repetir `service`, `staff` opcional por slug).
- `POST /api/public/booking`: `{organization,branch,services:[slug],staff:slug|null,starts_at:ISO8601,customer:{name,normalized_phone,email?},key:UUID,website:"",source:"website"}`. Validar el esquema vigente en WEBSITE_INTEGRATION.md; no enviar precios/minutos/IDs internos. Conservar la key en reintentos del mismo payload.
- `GET /book/1717-barberia/luque?service=corte-de-pelo&source=website` para el flujo alojado.

El POST mantiene la validación **same-origin del CRM**. La integración vigente dirige al booking alojado para que el navegador reserve desde ese origen; no promete POST cross-origin ni requiere abrir CORS, cambiar la validación Origin o entregar secretos a la landing. Cualquier consumo de catálogo desde el servidor de la landing debe conservar el contrato público existente.

No ofrecer éxito hasta recibir respuesta real. Tratar 404/indisponibilidad como cerrado; no fabricar slots a partir de los horarios del prompt. Catálogo/flags y precios/duración son autoridad del servidor. Rulos/Combo requieren consulta; conservar protección de tintes. Un combo no suma otro Corte.

## Evidencia HTTP del 23/10

En el deployment de `main` `99a4532`, el catálogo devolvió 200 JSON con `name=17:17 Barbería`, `slug=1717-barberia`, PYG y `branches:[]`; disponibilidad para Luque devolvió 404 JSON sin datos personales; la ruta book devolvió 200 HTML. Health/ready 200 y worker sin secreto 403. No se realizó POST de booking en producción. El catálogo vacío no certifica los IDs/flags privados de Luque ni un catálogo productivo listo.

El conector Vercel puede leer metadatos de despliegue pero su helper de acceso protegido devuelve 403; las comprobaciones HTTP públicas anteriores sí fueron posibles directamente. No se cambió Deployment Protection.

## Gate de activación

Mantener el CTA público de reserva cerrado hasta cuentas owner confirmadas, MFA/SMTP probados, tarifas/catálogo/turnos cloud revisados, horario comercial/excepciones, backup/restore, alertas, configuración cloud y piloto real. Separar este gate del merge/despliegue técnico. Usar WhatsApp confirmado como contacto existente solo en el futuro prompt autorizado; no configurar envíos automáticos.
