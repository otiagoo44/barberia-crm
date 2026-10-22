# Antes y después

Base: `da9eb8ccfab9526beee89d2a74fd9d82c6674ed4`, PR #3 recuperado. Las imágenes antiguas de main no constituyen el antes de esta iteración. Ambos lados usan el mismo script/fixtures QA.

| Área | Antes recuperado | Candidato |
|---|---|---|
| Navegación | Grupos amplios, marca en todas las acciones | Intenciones operativas, marca del tenant/acento del sistema y contexto común |
| Cabecera móvil | Altura fija podía tapar contenido | Altura fluida, recaptura a cinco anchos |
| Inicio | Dashboard general, finanzas al final | Recepción/Finanzas separados; métricas económicas compactas antes de analítica autorizada |
| Agenda | Lista por profesional | Escala real día/semana, franjas/descansos y Lista alternativa |
| Clientes | Contacto/retorno, modal largo | Historia reciente en tabla; drawer con secciones y vistas personales |
| Caja | Motor operativo existente | Jerarquía común, selector reutilizable, split/estados reales conservados |
| Reportes | Muchos gráficos juntos | Áreas de consulta, barras horizontales y tablas |
| Fuente | Segoe UI según plataforma | DM Sans autoalojada, cifras tabulares |

Imágenes: `verification/ux/before/<pantalla>-<ancho>.png` y `after/…`; results.json identifica checkout y accessibility.json conserva auditoría. El manifiesto y los enlaces finales se completan tras descargar e inspeccionar la ejecución íntegra. Las capturas parciales no se presentan como evidencia final.

Anchos 360/390/768/1024/1440. Login/MFA, Inicio, Agenda, Clientes/ficha, Sin cita, Caja/Checkout, Finanzas, Reportes, Equipo/Disponibilidad, Servicios, Sucursales, Metas, Configuración y navegación. En 768 o más el baseline usa sidebar; no se presenta como menú móvil. El candidato añade Inicio por rol y actividad/notas.

## Estado de la evidencia al 22/10/2026

El [baseline completo](https://github.com/otiagoo44/barberia-crm/actions/runs/39681824022/artifacts/12384347663) identifica `da9eb8c`; el [candidato anterior](https://github.com/otiagoo44/barberia-crm/actions/runs/39681824022/artifacts/12385435576) identifica el merge de prueba `a90f5eff` del head `4600048`. Esos artefactos contienen las pantallas privadas con Auth real; el segundo falla dos reglas de accesibilidad y no valida la corrección actual.

En sus 90 capturas comparables por fase, la mediana de DOMContentLoaded fue 138,1 ms antes y 130,8 ms en la iteración anterior; transferencia mediana 14.156 y 13.780 bytes. Son navegaciones con caché de CI y no LCP/INP, ni un benchmark del candidato actual. No se afirma una mejora de rendimiento definitiva.

La [captura local actual del Login](verification/ux/local-public-auth/login-390.png) y sus 14 variantes verifican los formularios públicos del build. El cierre privado, la comparación final y los enlaces del SHA final siguen pendientes por los bloqueos documentados en UX_TEST_RESULTS.md.
