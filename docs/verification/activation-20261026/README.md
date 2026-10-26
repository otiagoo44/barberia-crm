# Verificación de activación — 26/10/2026

Producción: `tbcfhagteyqufjkmbxzz`. Staging Free: `zdogqqmitpbwjgohwcww`. No hay dumps, ciphertext, contraseñas, tokens, códigos TOTP, claves privadas ni datos productivos de clientes en esta carpeta.

- `backup.json`: estado administrado y resumen del recibo lógico real, restaurado solo en localhost. La primera copia cifrada anterior sigue sin probar; el snapshot de la segunda pasó con el verificador UTF-8. El restore físico y la copia offsite siguen pendientes.
- `staging-upgrade.json`: instalación limpia 0→34 y upgrade 34→41 con contenido original de 95 tablas preservado, Auth/MFA y finanzas ficticios.
- `production-migrations.json`: siete migraciones 35–41 aplicadas secuencialmente, con consulta del historial tras cada una, RLS y contenido original conservados. Los fingerprints privados quedan fuera de Git.
- `operational-apply.json` y `production-configuration.json`: aplicación transaccional con el owner real y TOTP introducidos personalmente. Ocho servicios/precios, dieciséis capacidades, dieciocho intervalos efectivos y disponibilidad autoritativa de lunes/miércoles/sábado/domingo; historial comercial/financiero intacto.
- `preview-environment.json`: límites y tipos de variables del Preview, sin valores secretos.
- `initial-password-e2e.json` y `initial-password-production.json`: nueva migración 42 solicitada para cuentas con contraseña temporal; confirmación, MFA y cambio real probados en staging, y upgrade productivo 41→42 conservando las 95 tablas originales.
- `owner-provisioning.json`: dos cuentas reales creadas como propietarios y vinculadas; emails sin confirmar, MFA pendiente y cambio obligatorio activo. No contiene la contraseña temporal. `confirmation-templates.json` distingue la plantilla productiva preparada y la limitación del proveedor gratuito de staging; SMTP/recuperación no se sobrescribieron.
- `staging-browser/results.json`: 22 comprobaciones con aplicación compilada localmente conectada exclusivamente a staging cloud. No se usan mocks de respuestas. Incluye rechazo seguro de tarjetas sin tarifa y pago con reglas ficticias; no acredita tarifas UPay productivas ni correo a las identidades `.invalid`. La landing del test es sintética.
- `ui/`: quince pruebas aisladas de componentes, accesibilidad automatizada, navegación y viewports. Las fixtures de estas pruebas sí usan mocks y se distinguen del E2E cloud anterior.
- `local-load-results.json`, `local-upgrade.json`, `local-cash-explain.json`: pruebas aisladas actuales, sin datos de producción.

SMTP existente inspeccionado sin modificarlo. El usuario confirmó el 26/10 la recepción y recuperación de contraseña con MFA en su propio navegador. No se inspeccionó la bandeja ni se capturó el enlace.

CI del candidato `c14cdc6`: workflow [40393798491](https://github.com/otiagoo44/barberia-crm/actions/runs/40393798491), todos los jobs aprobados. Preview `dpl_FfpB6Gp5RgMSysu6Ss8wQsmDVfXV`, READY; readiness 200 mediante conector Vercel autenticado. La entrega final debe comprobar nuevamente el SHA/CI/alias después del último commit y del merge. No confundir ese preview con la URL productiva.

Las cuentas personales de Esteban y Jonatan ya existen como propietarios; su confirmación, autenticadores y reemplazo obligatorio de clave son personales. El piloto real, evidencia POS, copia privada externa y apertura pública siguen pendientes. La publicación técnica no acredita operación comercial lista.
