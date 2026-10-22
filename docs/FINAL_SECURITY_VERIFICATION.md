# Verificación de seguridad del candidato

Base: 34 migraciones intactas. La migración `20261022205615_default_product_gold_brand.sql` solo cambia el DEFAULT de brand_color para organizaciones nuevas. Sin UPDATE de filas existentes, grants, policies, funciones financieras ni cambios de historia. No se aplica a cloud desde esta tarea.

Se conservan requireUser, getUser verificado, security_context, AAL2, auth.sessions vivas, RLS/tenant/sucursal, reautorización después de lock, GiST, idempotencia durable, ledger, reversals, snapshots, export CSV y límites ZIP/XML. La UI sigue sin autoridad. No se cambian contratos de landing, endpoints públicos ni payload de reserva.

Nueva lectura `GET /api/workspace/setup`: requireUser más membresía owner activa; queries de sesión con RLS, organización/sucursal explícitas, listas acotadas a 501 y diagnóstico manual si exceden 500. Devuelve estados agregados, no factores, secretos, emails ni IDs personales. No tiene writes. Negativos: otro tenant, otra sucursal y recepción; los casos AAL1/revocación conservan el gate común.

Frontend: sin caché compartido de respuestas ni datos persistidos nuevos. Scope por perfil, tenant, rol y local; cambios de scope/URL/revisión ocultan datos previos. Abortar y limpiar en revocación/logout, invalidar después de respuesta exitosa. Ningún pago se confirma por un clic, timer o animación. Los errores no generan éxitos.

Las suites existentes se ejecutan completas en CI con GoTrue local y tokens firmados reales; PostgreSQL embedded local usa sesiones de fixture y no demuestra Supabase Auth. La matriz de permisos sigue en FINAL_PERMISSION_MATRIX.md. Los resultados exactos, SHA y skips/fallos se registran en RELEASE_ACCEPTANCE.md; mientras no estén cerrados, este documento no afirma aceptación final.

Producción: Supabase MCP pide autenticación. No se pudo reconsultar el inventario real de 17:17, MFA, SMTP, backups o alertas. No se generan operadores, horarios, pagos, reservas ni políticas para completar ese gate. El preview permanece fail-closed sin staging independiente. El monitor privado no se convierte en telemetría HTTP inexistente.
