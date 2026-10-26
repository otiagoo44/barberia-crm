import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { operationError } from "./operation-errors";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(code);
  }
}
export function correlationId(request: Request): string {
  const id = request.headers.get("x-request-id");
  return id && z.uuid().safeParse(id).success ? id : randomUUID();
}
export async function readJson(
  request: Request,
  maxBytes = 16384,
): Promise<unknown> {
  const origin = request.headers.get("origin");
  const allowed = new URL(process.env.APP_URL ?? "http://localhost:3000")
    .origin;
  if (origin !== allowed) throw new HttpError(403, "origin_rejected");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "invalid_content_type");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_payload");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
export function response(
  data: unknown,
  requestId: string = randomUUID(),
  status = 200,
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Request-Id": requestId,
    },
  });
}
export function fail(error: unknown, requestId: string) {
  const raw =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "internal_error";
  const code = /^[A-Za-z0-9_]{1,50}$/.test(raw) ? raw : "internal_error";
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : code === "42501"
          ? 403
          : code === "23P01"
            ? 409
            : code === "40001"
              ? 409
              : code.startsWith("22") || code.startsWith("23")
                ? 400
                : code === "P0002"
                  ? 404
                  : code === "P0001"
                    ? 429
                    : 500;
  console.error(
    JSON.stringify({ level: "error", request_id: requestId, code, status }),
  );
  const authMessages: Record<string, string> = {
    invalid_record_fields: "Corregí los campos indicados para guardar.",
    cash_distribution_upgrade_required:
      "Las distribuciones están bloqueadas hasta completar la actualización verificada de la base.",
    mfa_required:
      "Verificá tu segundo factor en Seguridad de la cuenta para continuar.",
    password_change_required:
      "Cambiá tu contraseña temporal antes de ingresar a la barbería.",
    email_confirmation_required:
      "Confirmá tu correo antes de entrar. Podés solicitar otro mensaje de confirmación.",
    session_revoked: "La sesión terminó. Volvé a entrar.",
    mfa_failed:
      "No se pudo verificar el código. Revisá tu autenticador e intentá nuevamente.",
    mfa_last_factor:
      "Agregá y verificá otro autenticador antes de retirar este dispositivo.",
    invalid_credentials:
      "Correo o contraseña incorrectos. Si recién creaste tu cuenta, confirmá tu correo.",
    profile_inactive:
      "Tu acceso está desactivado. Contactá al propietario de la barbería.",
    signup_failed:
      "No se pudo crear la cuenta. Revisá los datos o contactá al administrador.",
    password_update_failed:
      "No se pudo guardar la contraseña. Solicitá un nuevo enlace de recuperación.",
  };
  const domain = operationError(error);
  const message =
    domain?.message ??
    authMessages[code] ??
    (
      {
        schedule_conflicts_with_bookings:
          "Este horario afecta citas existentes. Reasignalas en Agenda antes de reducir los bloques.",
        distribution_policy_not_confirmed:
          "El propietario debe confirmar y habilitar las reglas de distribución antes de operar.",
        partner_overpayment:
          "El pago supera el saldo disponible de esta asignación.",
        insufficient_cash:
          "La caja no tiene efectivo suficiente para este pago.",
        stale_distribution_snapshot:
          "El resultado cambió desde la propuesta. Prepará un nuevo período y revisá sus importes.",
        stale_distribution_snapshot_prepare_again:
          "Los datos cambiaron. Prepará otra propuesta; las aprobaciones anteriores no autorizan pagar.",
        distribution_activation_gates_open:
          "Las distribuciones siguen deshabilitadas. Faltan los controles externos y la activación de ambos propietarios.",
        incomplete_distribution_result:
          "Hay cobros sin conciliar. Completá importes y evidencia antes de preparar el reparto.",
        dual_approval_required:
          "Se requieren las aprobaciones de ambos propietarios sobre este cálculo antes de pagar.",
        cash_policy_required:
          "17:17 requiere una política explícita por cobros conciliados.",
        settlement_difference_requires_reconciliation:
          "El bruto menos comisión, impuestos, retenciones y otros cargos no coincide con el neto. Revisá la liquidación.",
        completed_period_required:
          "Elegí un período finalizado, con fechas válidas y hasta un año.",
        unreconciled_distribution_balance:
          "Hay saldos pendientes. Conciliá las asignaciones antes de cerrar.",
        open_cash_session_required:
          "Abrí la caja de esta sucursal antes de registrar efectivo.",
      } as Record<string, string>
    )[
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : ""
    ] ??
    (status === 409
      ? "Ese horario dejó de estar disponible. Elegí otro."
      : status === 403
        ? "No tenés permiso para realizar esta acción."
        : status === 429
          ? "Demasiados intentos. Probá nuevamente en un minuto."
          : status === 400
            ? "Revisá los datos y el estado de la operación."
            : status === 404
              ? "No encontramos este recurso."
              : `No pudimos completar la operación. Referencia: ${requestId}`);
  const fields =
    error instanceof HttpError
      ? error.fields
      : domain?.field
        ? { [domain.field]: message }
        : undefined;
  return response(
    { error: message, fields, request_id: requestId },
    requestId,
    status,
  );
}
