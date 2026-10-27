# Importación histórica de 17:17

Actualización 26/10/2026: el usuario confirmó las cuatro correcciones del archivo exacto: fila 110 ingreso; filas 194 y 330 transferencia; fila 463 servicios. La revisión alcanza **539 filas listas, cero pendientes**, ingresos **Gs. 20.167.000**, egresos **Gs. 4.121.000**, saldo **Gs. 16.046.000 antes de comisiones**. Es una simulación local, sin importar el histórico a producción. El catálogo productivo fue consultado en lectura y contiene los servicios, conceptos, profesionales, categorías y medios necesarios.

El sistema aplica esas correcciones únicamente al SHA256 y organización indicados en `config/onboarding/1717-finance-import.json`. Conserva valores originales, corrección, motivo y hash de revisión. El archivo privado y sus clientes no se suben a Git ni a staging.

## Uso actual

1. Google Sheets → descargar como Microsoft Excel (.xlsx).
2. Finanzas → **Importar Excel / Sheets** → elegir archivo → **Analizar archivo**. No guarda movimientos.
3. Revisar totales y filas. Las correcciones adicionales se hacen dentro del importador, con motivo; actualizar la revisión antes de continuar.
4. **Confirmar importación** guarda la revisión y registra sus filas en una transacción. Si cambió el catálogo o el contenido revisado, exige revisar otra vez. El mismo archivo no se importa dos veces.

Finanzas abre en **Registro diario**: un ingreso cobrado se guarda con concepto, barbero, importe y medio de pago en una operación; un gasto usa categoría, descripción, importe y medio. Los cobros de agenda siguen registrándose desde la atención para evitar duplicarlos. El saldo por medio distingue ingresos, egresos, devoluciones y costos POS pendientes. Los filtros permiten día, semana, mes y rango. Liquidaciones y configuración quedan en un panel desplegable.

La conciliación y la doble aprobación siguen correspondiendo al reparto definitivo, no al registro diario. Tarjetas sin tarifa pueden cobrarse con costo NULL/pendiente; no se inventan comisiones, IVA, recargos ni liquidaciones bancarias. El saldo antes de POS sigue disponible aunque falte ese costo. Caja conserva apertura y control de efectivo.

Los apartados siguientes conservan la inspección histórica previa a la confirmación de las cuatro filas.

Archivo analizado: `C:/Users/User/Downloads/Barberia 17_17.xlsx`, SHA256 `cda0fd0f0b7d708a7cea2213f089af12f19bf86eec308ee751e155939312d991`. La copia nombrada `(1)` no estaba disponible en el workspace. Se utilizó esta copia, que contiene las cuatro áreas indicadas; confirmar que es la versión histórica definitiva antes de importar. El original y los nombres de clientes no se incorporan al repositorio.

## Mapping

Registro Diario A:H: fecha Excel/ISO; barbero; etiqueta cliente/proveedor; concepto; tipo ingreso/egreso; ingreso; egreso; medio de pago. I:K y demás fórmulas/resúmenes se ignoran. Las 978 ocurrencias de `__xludf.DUMMYFUNCTION` no son comisiones históricas fiables.

Casing, acentos y espacios se normalizan para búsqueda; relaciones se guardan con IDs. Coincidencia exacta normalizada se acepta solo si existe una entidad única. Variantes/ambigüedades requieren mapping explícito. No se crea customer_id por nombre. La etiqueta histórica se conserva en raw/normalized; proveedor y conceptos tienen campos propios. Fechas históricas se interpretan a las 12:00 de la timezone de branch porque el archivo no prueba la hora exacta.

Ingreso → checkout manual + línea + pago + post; egreso → expense según categoría, y registro de adelanto/salario si corresponde. Cada fila conserva archivo, hoja, fila, raw, normalizado, anomalías y batch. Nuevas reglas actuales no prueban vigencia pasada. Fee y comisión se recalculan solo con una regla histórica vigente demostrable; de lo contrario quedan unknown y no se publica resultado operativo completo.

## Evidencia y anomalías

Dry-run real: **539 movimientos, 535 estructuralmente listos, 4 NEEDS_REVIEW** usando identidades diagnósticas en memoria, sin writes.

| Fila | Problema | Tratamiento |
|---|---|---|
| 110 | Tipo egreso, 40000 en ingreso, egreso vacío; concepto corte de pelo | No corregir silenciosamente; requiere evidencia del movimiento correcto o exclusión explícita |
| 194 | Egreso servicios, medio vacío | Seleccionar medio confirmado o excluir |
| 330 | Egreso servicios, medio vacío | Seleccionar medio confirmado o excluir |
| 463 | Egreso, concepto vacío, efectivo | Categorizar con evidencia o excluir |

Comisión barbero por servicio en Configuración: Jonatan/Esteban, valores cero. Solo se prepara configuración prospectiva; no demuestra comisión cero de cada fecha pasada. Fees observados de configuración: efectivo/transferencia 0, débito 3%, crédito 5%, como datos del tenant. Alias `rulos y corte` frente a `combo rulos y corte` debe reconciliarse explícitamente. Tinte global 250000 y mechas 180000 permanecen conceptos separados; no se infiere que el editorial Tinte 200000 fuera correcto.

## Procedimiento seguro

Verificación del 19/10/2026 durante hardening: el archivo disponible conserva el SHA256 indicado arriba. No se importó a cloud. La interfaz y API aceptan hasta **2 MiB** por archivo y **3 MiB** de JSON (base64 incluido), dentro del límite de 4,5 MB de Vercel Functions. El analizador CLI XLSX mantiene su límite local de 8 MiB; no implica que la API admita 8 MiB. Una previsualización revisada excluye con trazabilidad las filas omitidas; confirmar exige su hash actual no nulo. El contenido no se guarda en Git.

La organización y el catálogo de 17:17 ya existen; no volver a crearlos. El flujo vigente está en **Uso actual**. Comparar las sumas por fecha y medio con los movimientos originales, no con resultados guardados de fórmulas rotas.

Dry-run CLI, sin conexión a DB: `npx tsx scripts/finance-dry-run.ts "C:/Users/User/Downloads/Barberia 17_17.xlsx" --confirmed-1717`. Sus IDs `diagnostic-only-*` nunca se usan como IDs reales ni se escriben en DB. La API usa catálogo autorizado de la branch, límites de tamaño/expansión ZIP y XML sin DTD/entidades; no ejecuta macros ni fórmulas. Tests emplean fixture sintético creado en memoria.
