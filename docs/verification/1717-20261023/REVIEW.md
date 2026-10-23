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

## Auditoría tras la primera CI

El run 40015699810 aprobó quality/baseline y falló 1/30 E2E; los otros 29 usan Auth real. Captura inspeccionada `ci-failed-financial-360.png`. El harness financiero se amplió con el componente real para reproducir Recharts/controles. `financial-after/financial-layout.json` demuestra el resize transitorio 598→360 y el layout estable a 360/390/768/1024/1440. El E2E espera la condición exacta en vez de medir antes del ResizeObserver, sin remover controles de cifras completas/28px. Mantiene diagnóstico adjunto ante overflow persistente.

Defecto P2 adicional comprobado: cabecera móvil fija a 70 px con hijos hasta 112 y main a 70. `workspace.css` impone height:auto; tras corregir, cabecera/main a 123 y contenido hasta 112. Se inspeccionó captura a 360 y se comprobaron cinco anchos. No cambia permisos, datos, tokens, fuentes ni marca. Nueva prueba UI previene la superposición; 11 UI pasan. Las tablas conservan scroll interno intencional. El checklist React se revisó para el selector y fixture: sin nuevos hooks, caché, fetch productivo, estado de negocio o dependencia de runtime; el dashboard financiero añadido solo entra al harness.
