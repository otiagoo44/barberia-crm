# Configuración confirmada — vigente al 24/10/2026

La aclaración final del 24/10 confirma cobro solo después de atender (sin anticipos de clientes), local lunes–sábado 09–21, domingo cerrado, pausa Esteban 12–12:30, tolerancia manual 15 minutos y consulta previa para rulos/tintes. Reparto por cobros elegibles (tarjetas al acreditarse), gastos pagados, pérdidas trasladables, retiros personales y dos aprobaciones independientes. UPay propone 220 bps débito IVA incluido y 520 bps crédito IVA/retención incluidos: vigencia, fijo, otros cargos y desglose real pendientes; no activado. Los valores y pendientes antiguos que siguen son antecedentes y no reemplazan esta política. [Política vigente](POLITICA_FINANCIERA_CONFIRMADA_1717.md), [POS vigente](CONCILIACION_UPAY_1717.md), [estado recién inspeccionado](ESTADO_REAL_1717.md), [pendientes para el lunes](PENDIENTES_MANUALES_1717.md).

## Antecedente del 23/10 (no usar sus preguntas como pendientes actuales)

Fuente comercial: instrucciones del instalador y conversación de Esteban del 22/10, 20:58. Esta página sustituye los pendientes antiguos sobre duraciones, reparto semanal/mensual y disponibilidad exclusivamente diaria.

## Identidad y acceso

17:17 Barbería, `1717-barberia`, PYG, `America/Asuncion`. Sucursal Luque, `luque`, Cap. Dado esq. Gobernador Irala, Luque; WhatsApp +595983402497. Proyecto autorizado: **tbcfhagteyqufjkmbxzz**. Ningún proyecto dental es sustituto válido.

| Profesional / propietario | Correo confirmado                | Rol requerido      |
| ------------------------- | -------------------------------- | ------------------ |
| Esteban                   | estebanras15@gmail.com           | organization_owner |
| Jonatan                   | jonatanramos2005oviedo@gmail.com | organization_owner |

Cada uno conserva su membresía owner y se vincula a su recurso mediante `staff.profile_id`. Esteban es responsable operativo habitual de caja y cierres, sin privilegios exclusivos inventados. Ambos pueden recibir avisos internos según membresía/sucursal. No se crean contraseñas, cuentas ni invitaciones automáticas ni envíos externos.

## Horarios y pausa

| Día       | Esteban                     | Jonatan                     |
| --------- | --------------------------- | --------------------------- |
| Lunes     | 09:00–19:00                 | 13:00–21:00                 |
| Martes    | 09:00–19:00                 | 13:00–21:00                 |
| Miércoles | 09:00–13:00                 | 13:00–21:00                 |
| Jueves    | 09:00–13:00                 | 13:00–21:00                 |
| Viernes   | 09:00–13:00                 | 13:00–21:00                 |
| Sábado    | 09:00–19:00                 | 13:00–21:00                 |
| Domingo   | Sin habilitación confirmada | Sin habilitación confirmada |

Pausa habitual de Esteban 12:00–12:30: obligatoriedad pendiente. El plan conservador divide sus reglas semanales en 09:00–12:00 y 12:30–fin del turno. Son 12 intervalos de Esteban y 6 de Jonatan, sin excepciones diarias artificiales. No se resta esa pausa a Jonatan. Los horarios comerciales del local siguen pendientes y **no se cambian** para igualarlos al equipo.

Las excepciones disponibles existentes sustituyen el turno semanal del día: revisar especialmente domingos, ampliaciones y la pausa antes de habilitar booking. Las excepciones no disponibles restan descansos; cierres/ausencias y citas siguen restando capacidad. El plan no borra excepciones ni historia y revierte si invalida citas. Ante reglas futuras incompatibles exige revisión. Las excepciones intencionales se gestionan en la UI existente, preservando la pausa provisional.

## Catálogo

| Servicio / slug existente esperado        |    PYG |            Minutos totales | Consulta previa                                      |
| ----------------------------------------- | -----: | -------------------------: | ---------------------------------------------------- |
| Corte de pelo / corte-de-pelo             |  30000 |                         40 | No nueva restricción; conservar una previa           |
| Barba / barba                             |  30000 |                         40 | No nueva restricción; conservar una previa           |
| Perfilado de cejas / perfilado-de-cejas   |  10000 |                         40 | Independiente; conservar restricciones previas       |
| Lavado / lavado                           |  10000 |                         10 | Venta independiente; conservar restricciones previas |
| Rulos / rulos                             | 180000 |                 120 aprox. | Obligatoria                                          |
| Combo rulos y corte / combo-rulos-y-corte | 200000 | **120 con corte incluido** | Obligatoria                                          |
| Tinte global / tinte-global               | 250000 |                 150 aprox. | Protección previa conservada                         |
| Tinte mechas / tinte-mechas               | 180000 |                 150 aprox. | Protección previa conservada                         |

Ambos profesionales realizan todo el catálogo. Rulos requiere evaluar largo e historia de procesos químicos. Tinte global y mechas siguen siendo variantes distintas. El combo es un principal de 120 minutos/200000; agregar otro principal Corte se rechaza por el motor. Lavado se vende como principal independiente: para cobrar Corte + Lavado se usan dos líneas del checkout; no se genera un segundo lavado implícito. El motor de reservas admite un principal por reserva; no se crea un servicio duplicado para sortear esa regla.

La tarifa efectiva de sucursal y los minutos los calcula PostgreSQL. Las citas/líneas ya creadas conservan sus snapshots. El plan de configuración registra antes/después y timestamp de aplicación en auditoría (`1717.tariff_version`, `1717.catalog_version`), sin revalorizar ventas o citas previas.

## Mismo día y finanzas

Anticipación comercial: se acepta el mismo día según capacidad. El motor permite `booking_lead_minutes=0`; no necesita imponer 24 horas ni un mínimo técnico adicional. Al confirmar, `starts_at >= now()` y la duración completa debe caber. Consultar disponibilidad no garantiza la reserva. Walk-in conserva su flujo independiente. Cancelación, retrasos y no-show: reglas definitivas pendientes, sin penalizaciones nuevas.

Débito **200 bps (2%)**, crédito **500 bps (5%)**. Efectivo/transferencia: sin tarifa POS informada. Cargos fijos, IVA, proveedor y vigencia contractual **no confirmados**: `null` no significa cero confirmado. No se activó ninguna regla productiva. `prepare-1717-pos.mjs` exige vigencia con timezone, evidencia y cargo fijo explícito; prepara versiones prospectivas, conserva snapshots y evita duplicados.

Investigación: [Bancard, soporte oficial](https://www.bancard.com.py/soporte) informa que comisión y costo del POS se comunican mediante el representante comercial; su Portal de Comercios permite consultar ventas/facturas. El [BCP publica información de comisiones por operadora](https://www.bcp.gov.py/en/comisiones-por-intermediacion-cobradas-a-los-comercios-por-las-operaciones-con-tarjetas). Estas fuentes no identifican el contrato particular de 17:17. Ejemplo puramente aritmético, sin suponer IVA/cargos: sobre 100000 PYG, 2% son 2000 y 5% son 5000. Una liquidación del proveedor permite comprobar si hay otros conceptos; un alquiler fijo del equipo no debe multiplicarse como cargo por cada cobro. No se reemplaza el 5% informado por una tasa genérica encontrada en internet.

Reparto confirmado: `equal_profit_share`, Esteban/Jonatan 50/50, **mensual por mes calendario**. Las distribuciones definitivas siguen deshabilitadas. El motor actual estima ventas posteadas netas de reversals menos POS/gastos/salarios/comisiones ajenas; el acuerdo comercial aún no confirma esa definición contable. No se presenta la estimación como deuda ni efectivo disponible. Un guaraní impar queda en el negocio; pérdidas no producen un pago negativo. No se inventó acuerdo de pérdidas ni se llamó `configure` con `confirmed=true` para aparentar su confirmación.

## Aplicación y evidencia

- Guardado en el repositorio: manifiesto, migración de vínculo owner/profesional, selector de UI, inspección read-only, generadores de plan/fees y pruebas aisladas.
- Base local de fixtures: se registra su resultado en TEST_END_TO_END_1717.md. No equivale a datos guardados en producción.
- Cloud: OAuth CLI terminó correctamente; el cliente MCP actual conserva error de refresh. CLI Supabase no tiene privilegios sobre este proyecto. **IDs, reglas y usuarios cloud no reconsultados ni modificados**.
- HTTP público observado: catálogo responde con organización y `branches: []`; disponibilidad 404 sin datos privados. No acredita el flag particular de Luque ni un inventario privado.
- Activación pública y piloto real: pendientes de controles de RELEASE_FINAL_1717.md.

## Preguntas que sí faltan para Esteban

1. ¿La pausa 12:00–12:30 de Esteban debe bloquearse siempre o puede modificarse cada día? ¿Qué horario comercial tiene el local y trabajan domingos?
2. ¿Qué proveedor POS usan? Obtener liquidación/factura/contrato que indique desde cuándo rigen 2%/5%, si incluyen IVA y si hay cargos fijos, alquiler u otros conceptos. No alcanza con una tarifa genérica publicada.
3. ¿“Total generado” son ventas completadas/posteadas o cobros recibidos? ¿Se resta POS antes del 50/50? ¿Qué tratamiento tienen gastos pendientes de pagar?
4. ¿Los retiros y adelantos de cada socio se descuentan de su participación? ¿Cómo tratan pérdidas anteriores y quién aprueba el reparto mensual?
5. ¿Cómo acuerdan cancelaciones, tolerancia de retraso y no-show? ¿Qué tintes requieren evaluación?

No volver a preguntar precios, duraciones, inclusión del corte, correos, porcentajes, turnos semanales ni periodicidad: ya están confirmados.
