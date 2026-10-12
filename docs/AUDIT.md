# Auditoría inicial

Fecha: 2026-10-12. Inspección realizada antes de escribir código de aplicación o modificar la infraestructura.

## Repositorio

- El directorio contiene `.agents/skills/`, `skills-lock.json` y `DESIGN (1).md`.
- No hay aplicación, manifiesto de dependencias, lockfile de aplicación, pruebas, migraciones, configuración de despliegue ni variables de entorno dentro del repositorio.
- Git está inicializado en `main`, sin commits. Los archivos existentes están sin seguimiento; la referencia remota `origin/main` no existe localmente.
- No se encontraron archivos `AGENTS.md` aplicables en el directorio ni en sus directorios superiores.
- `DESIGN (1).md` contiene una referencia visual de Nile Postgres. Se conserva como referencia; no representa componentes funcionales ni requisitos de negocio.
- Se conservan todas las skills existentes y su archivo de versiones.

## Supabase conectado

Proyecto identificado mediante el MCP conectado: `tbcfhagteyqufjkmbxzz`.

- PostgreSQL 17.11.
- No hay tablas, vistas, funciones ni políticas de aplicación en `public` o `app_private`. La inspección de los catálogos tampoco encontró relaciones de aplicación en otros esquemas.
- El esquema `app_private` todavía no existe.
- No hay migraciones registradas, Edge Functions ni ramas de desarrollo.
- Auth: cero usuarios existentes. Storage: cero buckets existentes.
- Existe la publicación estándar `supabase_realtime`, sin publicación automática de todas las tablas.
- Extensiones instaladas: `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements` y `supabase_vault`. `btree_gist` y `pgtap` están disponibles pero no instaladas.
- Los advisors de seguridad y rendimiento no reportaron hallazgos. Esto corresponde a una base sin entidades de aplicación y no constituye validación de una futura implementación.
- El parámetro `pgrst.db_schemas` no resultó visible mediante `current_setting`; los esquemas expuestos por la Data API deberán verificarse específicamente.

## Entorno local

- PowerShell, Node.js 24.15.0 y npm 11.14.1 disponibles.
- No se encontraron ejecutables `supabase`, `docker` o `psql` mediante `Get-Command` en el PATH durante la auditoría.
- El MCP de Supabase permite las inspecciones de tablas, SQL, migraciones, extensiones, funciones y advisors realizadas.

## Alcance y límites de la evidencia

La revisión de infraestructura se efectuó mediante consultas de lectura y herramientas de inspección. No se modificaron tablas, permisos, usuarios, buckets ni configuraciones remotas.

No se verificaron todavía los proveedores de autenticación, límites de envío de correo, URLs de redirección, SMTP, configuración de recuperación, backups/PITR, plan del proyecto, límites de infraestructura o dominio de producción. Ninguno de estos puntos debe darse por configurado únicamente por la existencia del proyecto conectado.

## Condiciones recibidas para la implementación

- Una instalación y un proyecto Supabase para múltiples organizaciones independientes, cada una con una o varias sucursales.
- UUID, entidades comerciales con `organization_id`, ubicación con `branch_id`, claves foráneas compuestas e inmutabilidad del tenant.
- Usuarios autenticados separados de personas de staff. Autorización por rol y sucursal en PostgreSQL, con denegación por defecto y RLS en todas las tablas expuestas.
- Helpers privilegiados en `app_private`, `search_path` vacío, referencias calificadas y permisos de ejecución explícitos.
- Auditoría append-only de acciones sensibles, sin secretos.
- Reservas y disponibilidad basadas en intervalos; duración calculada en el servidor según composición configurable de servicios.
- No implementar contabilidad completa, caja ni reglas de comisiones. Esos módulos se definirán posteriormente utilizando el Google Sheet real del primer cliente.
- Los requisitos detallados siguen llegando durante esta auditoría; se consolidarán antes de implementar.

## Conclusión

No existe código funcional de producto ni datos de negocio que migrar o reemplazar. La aplicación debe construirse sobre el proyecto conectado, conservando los archivos existentes. La primera migración deberá establecer el aislamiento multi-tenant y las invariantes de seguridad antes de habilitar operaciones de negocio.
