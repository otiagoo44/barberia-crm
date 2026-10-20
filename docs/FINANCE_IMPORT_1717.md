# Importación histórica de 17:17

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

1. Onboard organización/branch/catalog/staff/métodos/categorías; confirmar IDs y reglas históricas con evidencia.
2. Finanzas → Importar histórico → archivo XLSX/CSV; empezar con **Solo simulación**.
3. Revisar filas y mapping. Nunca mapear ambiguos por parecido. Corregir el archivo con evidencia o excluir anomalías explícitamente; revalidar.
4. Desactivar simulación y guardar preview. Aún no crea ventas ni egresos.
5. Confirmar solo cuando no queda NEEDS_REVIEW. RPC compara preview_hash, importa filas READY en una transacción, conserva exclusiones y audita. Misma fuente SHA no se importa dos veces.
6. Comparar sumas de fuentes por fecha/método; revisar unknown y trazabilidad. No comparar contra resúmenes hardcodeados o resultados de fórmulas rotas.

Dry-run CLI, sin conexión a DB: `npx tsx scripts/finance-dry-run.ts "C:/Users/User/Downloads/Barberia 17_17.xlsx"`. Sus IDs `diagnostic-only-*` nunca se usan como IDs reales ni se escriben en DB. La API usa catálogo autorizado de la branch, límites de tamaño/expansión ZIP y XML sin DTD/entidades; no ejecuta macros ni fórmulas. Tests emplean fixture anónimo creado en memoria.
