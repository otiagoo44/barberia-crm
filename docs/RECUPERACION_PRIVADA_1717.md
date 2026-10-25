# Respaldo y recuperación de 17:17 — 25/10/2026

Proyecto exclusivo: `tbcfhagteyqufjkmbxzz`. No usar credenciales o datos de los proyectos dentales que lista otra sesión de la CLI.

## Copia administrada comprobada

El dashboard del proyecto muestra organización **Pro** y copias **PHYSICAL**. Última observada: **25/10/2026 05:00:36 UTC**, equivalente a **02:00:36 America/Asuncion**. También muestra copias del 24/10 04:56:10, 23/10 04:56:09, 22/10 05:04:43, 21/10 04:59:38, 20/10 04:57:48, 19/10 05:00:39 y 18/10 05:01:30 UTC. La retención contratada de Pro es **7 días**; una fila adicional visible no garantiza mayor retención.

Cobertura: base de datos, incluidos los datos Auth almacenados allí. **No incluye los archivos de Storage**, ni sustituye secretos/configuración externa de SMTP, Vercel o proveedores. No se activó PITR ni se aumentó compute.

No se pulsó Restore: ese flujo puede afectar producción. La restauración de una copia física administrada **no está probada**. El usuario dejó pendiente un segundo proyecto y no autorizó costos adicionales. Un simulacro lógico local no es una restauración física de Supabase.

Con respaldo diario puede perderse lo registrado desde la última copia recuperable: aproximadamente hasta 24 horas si cada ejecución funciona, y más si una copia falla o el incidente tarda en detectarse. Comprobar diariamente fecha y estado; no prometer pérdida cero ni un RTO cloud sin medirlo.

## Copia lógica privada adicional

Se prepararon `scripts/backup-1717.ps1` y `scripts/private-database-backup.ts`. El mecanismo usa **pg_dump/pg_restore PostgreSQL 17.11** oficiales. Mantiene un snapshot de lectura consistente, incluye `public`, `app_private`, `auth`, `extensions` y `supabase_migrations`, y solicita explícitamente las extensiones de esos esquemas. No ejecuta reset, fixtures ni writes comerciales en producción.

La copia se cifra con **AES-256-GCM y scrypt**; la frase de cifrado no se guarda. El archivo `.bkos` contiene el archivo pg_dump y la evidencia de conteos, hashes de contenido, RLS, ACL, restricciones y funciones. Las contraseñas se ingresan ocultas, se usan temporalmente en memoria y no se colocan en argumentos, Git, Vercel o logs. La conexión verifica certificado y hostname mediante el CA oficial de Supabase, además de TLS.

Destino Windows restringido al usuario y SYSTEM:

`%LOCALAPPDATA%\BarberiaOS\private-backups\tbcfhagteyqufjkmbxzz`

Desde la raíz del repositorio:

```powershell
powershell -NoProfile -File .\scripts\backup-1717.ps1
```

Pide la contraseña PostgreSQL actual y una frase de cifrado de al menos 20 caracteres, con confirmación. Guardar la frase en un gestor de contraseñas separado del archivo. **No mandarla por chat.** Supabase no permite consultar la contraseña original: si no está guardada, detener este paso y planificar una renovación autorizada; no restablecerla improvisadamente.

El script lee solamente la identidad verificada de 17:17/Luque, exporta, cifra, vuelve a descifrar el archivo y restaura automáticamente en un cluster temporal que escucha **solo en 127.0.0.1**, con contraseña aleatoria. No acepta una URL de destino remoto. No invoca notificaciones, cron o integraciones. Compara todas las filas por conteo/hash, políticas, permisos efectivos, propietarios, restricciones y seguridad/cuerpo de las funciones. También comprueba que sesiones anónimas o autenticadas sin identidad no puedan leer clientes. Detiene el cluster y elimina su directorio privado después del ensayo.

El recibo `.receipt.json` solo indica `PASSED` al terminar todas esas verificaciones. Una copia creada con restore `NOT_TESTED` no habilita migraciones. Una excepción no debe interpretarse como éxito. La prueba Auth se limita a datos/tablas recuperados; no certifica login GoTrue, entrega SMTP, Realtime ni recuperación de infraestructura administrada.

Para repetir el ensayo de un archivo ya creado:

```powershell
powershell -NoProfile -File .\scripts\backup-1717.ps1 -Action Verify -BackupFile 'RUTA_ABSOLUTA_DEL_ARCHIVO.bkos'
```

Herramientas preparadas en `%LOCALAPPDATA%\BarberiaOS\tools`: binarios del archivo oficial EDB `postgresql-17.11-5-windows-x64-binaries.zip`, SHA-256 `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`, CA Supabase `prod-ca-2021.crt` y bundle CA de Mozilla verificado contra su checksum publicado. No se instaló un servicio PostgreSQL ni Docker.

**Estado productivo:** la copia lógica real sigue pendiente de conexión autorizada. El ensayo automatizado registrado en `verification/activation-20261025/private-backup-local.json` usa exclusivamente fixtures locales; no debe llamarse restore de producción.

Una copia local no protege de la pérdida completa de la computadora. Después de un respaldo real aprobado, copiar **el ciphertext** a almacenamiento privado independiente y guardar la frase en un gestor distinto; definir acceso y retención con los propietarios. No subirlo al repositorio, Vercel ni una carpeta pública. No se configuró todavía esa segunda ubicación ni una tarea automática de copia lógica.

## Incidentes y responsabilidades

Tiago/operador técnico mantiene accesos, valida la copia y ejecuta la recuperación. Esteban y Jonatan autorizan la interrupción, verifican agenda/caja y confirman reapertura; la contadora valida conciliación y tratamiento de UPay. No compartir sus cuentas ni códigos MFA.

1. Cerrar temporalmente reservas/escrituras mediante un actor autorizado y conservar logs/evidencia. No borrar historial ni revertir importes otra vez.
2. Identificar alcance, última copia recuperable y operaciones posteriores. Conservar una copia adicional del estado afectado.
3. Restaurar en destino aislado autorizado, con integraciones salientes apagadas. Revisar Auth, memberships, staff, clientes, citas, pagos/reversiones, gastos, caja, finanzas, auditoría, RLS, ACL y constraints; comparar los recibos.
4. Recuperar por separado SMTP, secretos, callbacks y archivos Storage si existen. Revalidar MFA real y no fabricar sesiones. Medir duración y pérdida efectiva; no usar el tiempo del fixture como RTO productivo.
5. Solo después de revisión y autorización de la conmutación, cambiar el destino de la app y reabrir gradualmente. No restaurar primero encima de la única producción. Reprocesar jobs con sus claves de idempotencia y conciliar operaciones posteriores con ambos propietarios.

Fuentes oficiales: [Backups Supabase](https://supabase.com/docs/guides/platform/backups), [backup/restore lógico](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [TLS y certificados](https://supabase.com/docs/guides/platform/ssl-enforcement), [binarios Windows PostgreSQL](https://www.postgresql.org/download/windows/).
