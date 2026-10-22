# Inventario de componentes

Nombres de producto mapeados a implementaciones existentes. No se incorporó un framework UI completo.

| Patrón | Implementación | Comportamiento |
|---|---|---|
| AppShell, Sidebar, Topbar | `components/shell.tsx`, `workspace.css` | Organización/local, grupos por rol, cuenta y navegación móvil con Modal. |
| Breadcrumb | `workspace-context` en Shell | Organización y módulo actual. |
| WorkspaceSwitcher | Link de Shell a `/` | Directorio real de organizaciones de la sesión. |
| BranchSwitcher | `branch-switch` en Shell | Sólo sucursales autorizadas; cambio desmonta formularios del local. |
| CommandSearch | `GlobalSearch` en Shell | Debounce, API real, Ctrl/Cmd+K respeta inputs/diálogos; Escape limpia. |
| DataTable | `components/workspace-ui.tsx` | Clientes/catálogos; tabla semántica en región con foco/scroll y paginación del servidor. |
| FilterBar | `workspace-ui.tsx` | Buscar/exportar clientes, grupo con nombre accesible. |
| ViewSwitcher | `workspace-ui.tsx` | Áreas de reportes, botones aria-pressed. |
| SavedViews | `components/saved-views.tsx` | Preferencias personales acotadas por tenant/usuario sin datos de registros. |
| Tabs | `workspace-ui.tsx` | Drawer; tablist, tabIndex, flechas, Home/End y panel asociado. |
| RecordDrawer | `workspace-ui.tsx` + Modal | Lateral, móvil completo; inert, trap, Escape y restitución. |
| Modal | `components/ui.tsx` | Diálogo nativo recuperado, contempla hijos ocultos en details. |
| ConfirmDialog | `workspace-ui.tsx` | Primitiva disponible pending/error; formularios críticos mantienen confirmaciones de negocio específicas. |
| Toast | `workspace-ui.tsx` | Éxito real al guardar cliente, status y cierre manual. |
| StatusBadge | `Badge` en `ui.tsx` | Estado escrito y color común. |
| EmptyState / Skeleton | `Empty` / `Loading` en `ui.tsx` | Vacío/carga anunciada, distintos de cero/desconocido. |
| ErrorState | `Notice` / `ErrorState` | Error anunciado y reintento según contexto. |
| MetricCard | `workspace-ui.tsx` / `.kpi` | Inicio de recepción, estilo común a métricas. |
| ChartCard | `DataChart`, `components/data-chart.tsx` | Recharts diferido, ejes/tooltips, tabla, vacío y desconocido. |
| DateRangePicker | `workspace-ui.tsx` | Dashboard/Finanzas, límites nativos visibles. |
| ActivityTimeline | `workspace-ui.tsx` | Historial paginado y autorizado. |
| PaymentMethodSelector | `finance/payment-method-selector.tsx` | Catálogo real, pending y etiqueta preservada. |
| TimeCalendar | `appointments/time-calendar.tsx`, `lib/calendar.ts` | Intervalos/timezone, bloques, descansos y hora actual. |
| StaffFinancialCharts | `finance/staff-charts.tsx` | Producción, ticket y comisiones seleccionables; suma exacta con BigInt sobre el read-model financiero autorizado. |

La iteración final amplía FinancialCharts con ventas/POS/gastos/comisiones/resultado y traza discontinua para deducciones. DataChart adapta la altura de barras horizontales a la cantidad de filas. Categorías, minutos atendidos y seguimiento actual se agregan al dashboard sin cambiar guards/RLS ni reglas financieras. La recaptura final de 180 imágenes fue inspeccionada y los 25 E2E aprobaron en CI 39817313839; ver UX_TEST_RESULTS.md.

La UI no otorga permisos. Campos financieros, notas, directorio y operaciones conservan autoridad del backend.
