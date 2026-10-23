# Evidencia visual antes y después

Producto: 8a59362db9c701e94cb17ae0240a1a9ab5e33190. Base: b7d5cfd42611d83347b4307e0c53db173d7b967f. [Ejecución completa](https://github.com/otiagoo44/barberia-crm/actions/runs/39874912332). Los SHA de árboles de src/esquema, manifests con hashes y métricas están en [release-evidence.json](../release-evidence.json), [antes](../visual-before-results.json) y [después](../visual-after-results.json).

Se generaron 110 PNG de base y 195 del candidato en 360/390/768/1024/1440. El candidato aprobó 74 auditorías axe, sin errores JS/consola/API. Son cuentas y datos sintéticos en Supabase local con Auth/MFA reales. La reserva pública pertenece a ux-b, sin habilitar reservas reales.

Las hojas contact de before/after cubren todos los tipos de pantalla y roles a 390/1440, con recorte de los primeros 1100px y reducción para comparación; no sustituyen la lectura a escala real. Se inspeccionaron además PNG completos representativos, formularios, contraste, tipografías y geometría a los cinco anchos. No se afirma revisión humana individual a escala real de los 305 PNG.

| Pantalla | Antes | Después |
|---|---|---|
| inicio-1440 | [PNG](before/inicio-1440.png) | [PNG](after/inicio-1440.png) |
| agenda-1440 | [PNG](before/agenda-1440.png) | [PNG](after/agenda-1440.png) |
| clientes-390 | [PNG](before/clientes-390.png) | [PNG](after/clientes-390.png) |
| caja-390 | [PNG](before/caja-390.png) | [PNG](after/caja-390.png) |
| configuracion-1440 | [PNG](before/configuracion-1440.png) | [PNG](after/configuracion-1440.png) |
| reserva-publica-390 | [PNG](before/reserva-publica-390.png) | [PNG](after/reserva-publica-390.png) |

Todos los PNG están en los artefactos visual-baseline (12468356865) y browser-verification (12467409176) de la ejecución, sujetos a retención de GitHub. Este directorio conserva una selección permanente y diez hojas de contacto. Los manifests completos quedan en Git.

QA complementario: [DM Sans](qa/tipografia-dm-sans-390.png) / [Inter](qa/tipografia-inter-390.png), también a 1440; [modal al 200% CSS](qa/clients-css-zoom-200.png); [cifras sintéticas extremas](qa/large-figures-360.png), modificadas solo en DOM sin writes; [tooltip real de DataChart](qa/chart-tooltip-390.png), componente renderizado localmente con datos sintéticos, sin sustituir Auth/API. El zoom CSS y el reflow 720x500 automatizados no equivalen a pruebas físicas en todos los navegadores.
