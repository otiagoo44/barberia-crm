# Segunda revisión de la configuración

Alcance: cambios de esta entrega sobre `204b914`, preservando los dos commits del rediseño pendientes de publicar. No se reconstruye la interfaz. Las 36 migraciones anteriores permanecen idénticas; solo se agrega la 37.

| Archivo / grupo | Responsabilidad y comprobación |
|---|---|
| config/onboarding/1717.json | Valores confirmados, ambos correos, 200/500 bps, mensual, turnos y pausa explícita; cargos/vigencia desconocidos null y flags cerrados. Comparado con prompt/conversación. |
| 1717-*-options.example.json | Entradas de operador deliberadamente incompletas: los generadores rechazan null y otro proyecto; no contienen UUID o fechas supuestos. |
| migración 37 | Cambia exclusivamente el predicado de vinculación en manage_record_core. Mantiene wrapper, roles/grants/RLS, lock y MFA/sesión. Guard sobre definición exacta aborta ante drift. Instalación y upgrade probados aisladamente. |
| record-manager.tsx | Selector ofrece propietarios además de barberos; la autorización continúa en PostgreSQL. El esquema anterior puede rechazar owner hasta el rollout, sin ampliar privilegios. |
| inspect-1717.sql | BEGIN READ ONLY; organización/proyecto esperados; solo correos conocidos y estado/factores contados, sin tokens ni secretos. Su output cloud no se guarda públicamente. |
| configure-confirmed-1717.mjs | No red; SQL escapado; UUID/fecha/proyecto explícitos, identidad/assignments/settings verificadas, owner real/AAL2/sesión viva antes y después del lock. No impersonación ni onboarding. Conserva marcas, horarios del local, datos históricos, appointments, excepciones y restricciones previas. Audita antes/después de precios. No fees/distribuciones/usuarios/envíos/booking activo. |
| prepare-1717-pos.mjs | No red; exige cargos enteros, vigencia con zona y evidencia. Versiona vía finance_command, no modifica payments. Retry idéntico no duplica reglas. Diferencias en vigencia ya usada abortan. |
| tipos .d.mts | Firma para los generadores Node existentes; no dependencias nuevas. |
| confirmed-1717.ts | SQL local: ambos owners vinculados conservando rol, actores ajenos/inactivos/reception rechazados; catálogo/precio/duración/combo, historia semanal, 18 intervalos actuales, pausa/domingo, excepción de Jonatan sin bloquear Esteban, idempotencia, fees futuros, gates y AAL1 rechazado. Claims de fixture explícitos; finally hace rollback y siempre libera la conexión. |
| finance.ts y run.ts | Se conservan 19 contratos financieros; el runner usa débito 200 bps. Split, reversión, caja, concurrencia, snapshots y tenant siguen ejercitados. Nuevos contratos en otra base aislada. |
| operator-1717.test.ts | Rechaza proyecto/IDs/fecha inválidos y cargos desconocidos/fraccionarios; no permite transformar desconocido en cero. |
| diez documentos de entrega | Distinguen manifiesto/fixture/cloud/piloto/activación; ambos correos ya confirmados; pendientes solo comerciales/operativos reales. Los antecedentes se rotulan históricos. |

Las pruebas UI de este directorio renderizan componentes reales con respuestas interceptadas y fixtures sintéticos: no prueban Auth ni producción. `load-results.json` pertenece a PostgreSQL local bajo carga, sin promesa de rendimiento cloud. `migration-upgrade.json` verifica datos/ledger existentes desde 27. Los artifacts históricos del rediseño se restauraron intactos después de copiar la evidencia nueva a este directorio.

Fallos de desarrollo registrados: target inicial del guard incorrecto; una referencia SQL sin alias confundía la columna staff_id con una variable. Se corrigieron target/aliases, se renombraron variables para eliminar esa ambigüedad y se repitieron pruebas. Un error inicial del harness dejó una conexión sin liberar al fallar el rollback; se corrigió con finally anidado. No se debilitó una aserción ni se ejecutó SQL en cloud para resolverlos.

Límites abiertos: no acceso efectivo al inventario privado cloud; no Auth/MFA/SMTP ni backup/restore/alertas reales; no acuerdos pendientes de POS/distribución ni piloto. Ningún resultado local cierra esos gates. El merge técnico requiere CI del SHA final y ruleset main activo, sin bypass.
