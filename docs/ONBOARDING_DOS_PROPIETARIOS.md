# Primer acceso de Esteban y Jonatan

URL del CRM: https://barberia-crm-kappa.vercel.app. Funciona por HTTPS en computadora y teléfono; no se instala un ejecutable. El deployment observado es `99a4532`; el release nuevo debe verificarse por SHA. Tener código desplegado no demuestra que estas dos cuentas existan o tengan MFA.

## Paso de cada propietario

1. Abrir `/login` → Crear cuenta (`/signup`). Esteban usa **estebanras15@gmail.com**; Jonatan usa **jonatanramos2005oviedo@gmail.com**. Cada uno elige su propia contraseña y controla su correo.
2. Confirmar el enlace recibido y volver a iniciar sesión. No crear una cuenta duplicada si ya existe: usar recuperación. La entrega de correo depende del SMTP cloud, aún no verificado.
3. El instalador autorizado verifica `email_confirmed_at`, perfil activo y UUID en el **proyecto tbcfhagteyqufjkmbxzz**; no otorga acceso por parecido de nombre.
4. Un owner autorizado con sesión AAL2 abre Configuración → Accesos, asigna `organization_owner` en **17:17 Barbería** a cada correo confirmado. Ambos owners tienen alcance organizacional; no agregar platform_admin. Si todavía no hay un owner operativo, usar únicamente el bootstrap administrativo autorizado existente, con evidencia y actor identificado; no degradar Auth/MFA.
5. En Equipo, editar Esteban y vincular su cuenta; repetir con Jonatan. La migración `20261023193417_staff_owner_profile_link.sql` debe estar aplicada antes de este vínculo. El selector admite owner/barber; PostgreSQL comprueba membresía de la misma organización, rol y perfil activos. **No cambiar owner por barber**.
6. Cada propietario sigue `/mfa`, enrola su autenticador y completa el challenge. Preparar un segundo autenticador independiente y el procedimiento de recuperación asistida existente. No compartir TOTP, códigos, contraseñas ni sesiones.
7. Verificar acceso al dashboard y sucursal **Luque**, agenda, clientes, caja y finanzas desde computadora y teléfono. Probar avisos internos con ambos usuarios durante el piloto; los avisos externos siguen pendientes de proveedor y destinatarios verificados.

La membresía no omite MFA: AAL1 puede necesitar completar `/mfa` antes de ver datos. Si el enlace de correo no llega, resolver SMTP/remitente/redirects/entrega; no marcar el correo confirmado por SQL para adelantar el piloto. Recuperar contraseña no elimina MFA. Revocar sesiones ante incidentes según el runbook existente.

## Estado de esta entrega

| Control | Esteban | Jonatan |
|---|---|---|
| Correo confirmado por instalador | Sí | Sí |
| Existencia / email verificado en Auth cloud | No reconsultado | No reconsultado |
| Membresía owner real | No reconsultada | No reconsultada |
| Vínculo staff.profile_id real | No reconsultado | No reconsultado |
| MFA enrolado/challenge real | No verificado | No verificado |
| Piloto personal | No ejecutado | No ejecutado |

No se enviaron invitaciones ni se crearon usuarios. `scripts/inspect-1717.sql` consulta solo ambos correos conocidos, membresías, vínculos y cantidad de factores verificados; nunca secretos. No extraer JWT ni autenticadores para completar un informe. El correo de Jonatan dejó de ser un pendiente.
