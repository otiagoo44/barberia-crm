# Guardar el respaldo fuera del equipo

El respaldo aprobado es `1717-2026-10-25T23-39-39.524Z.bkos`, dentro de `%LOCALAPPDATA%\BarberiaOS\private-backups\tbcfhagteyqufjkmbxzz`. Su recibo del 26/10/2026 indica restauración **PASSED**. No elegir la copia anterior cuyo ensayo sigue sin comprobar.

1. Abrir esa carpeta en el Explorador. Copiar el `.bkos` y su `.bkos.receipt.json`.
2. Subir ambas copias a una carpeta privada de Google Drive con acceso restringido, o copiarlas a un disco externo y desconectarlo después. Conservar también la copia local.
3. Guardar la frase original por separado, preferentemente en un gestor de contraseñas. No escribirla en el nombre del archivo ni guardarla junto al respaldo. Para copiar el archivo cifrado no hace falta introducirla; para restaurar sí.
4. Descargar nuevamente la copia desde Drive y comparar su SHA256 con el original usando `Get-FileHash -Algorithm SHA256 -LiteralPath 'ruta del archivo.bkos'`.

SHA256 del archivo aprobado: `2f3a9970b698c9d7e6ccca5951e9a1459d310cb4fc3e82b25ad1ef60dea4b2c9`.

El snapshot es del 25/10/2026 23:36:57 UTC. No contiene movimientos posteriores ni archivos de Storage o variables de servicios externos. Mantener además los backups automáticos Pro y renovar la copia lógica después de cambios importantes. Staging con datos ficticios no sustituye el respaldo productivo.
