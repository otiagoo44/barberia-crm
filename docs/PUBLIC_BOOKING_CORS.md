# Landing integrada sobre el motor público existente

La única extensión de origen está en `/api/public/{catalog,availability,booking}`. `PUBLIC_BOOKING_ORIGINS` contiene orígenes HTTPS exactos separados por coma; producción usa `https://1717barber.vercel.app`. No acepta `*`, paths, credenciales, `null` ni subdominios parecidos. Rutas de sesión, configuración, finanzas y Calendar conservan su validación same-origin.

La landing usa fetch con `credentials:omit`. No tiene llaves del gateway o Supabase ni un proxy que comparta la IP de todos los clientes. El CRM mantiene su HMAC de IP tomada del proxy confiable de Vercel, rate check, límite de payload, honeypot, validación estricta y RPC existente. CORS no es autenticación: las lecturas públicas desde servidor siguen permitidas, pero POST exige Origin autorizado. El preflight sólo permite el método del recurso y Content-Type; no habilita cookies.

La migración `20261102180000` agrega nombres del profesional asignado y snapshots de servicios a la respuesta pública. Mantiene el motor, locks, exclusiones y claves de idempotencia; no devuelve IDs internos ni contactos. Es compatible con el formulario nativo, que sigue siendo la alternativa si falla la landing.

Despliegue: aplicar primero la migración validada en staging y producción; configurar el origen exacto; desplegar CRM; comprobar preflight permitido/rechazado y confirmación. Luego publicar la landing. Rollback de interfaz: revertir la landing; la ampliación de respuesta y el CORS no cambian el comportamiento del formulario nativo.

Pruebas de staging usan un servidor Next optimizado que apunta únicamente a `zdogqqmitpbwjgohwcww` y un origen local explícito del runner. No habilitar previews contra la base productiva ni agregar comodines de Vercel para hacer pasar una prueba.
