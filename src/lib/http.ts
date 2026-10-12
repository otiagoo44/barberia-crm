import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
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
  const message =
    status === 409
      ? "Ese horario dejó de estar disponible. Elegí otro."
      : status === 403
        ? "No tenés permiso para realizar esta acción."
        : status === 429
          ? "Demasiados intentos. Probá nuevamente en un minuto."
          : status === 400
            ? "Revisá los datos y el estado de la operación."
            : status === 404
              ? "No encontramos este recurso."
              : "No pudimos completar la operación. Intentá nuevamente.";
  return response({ error: message, request_id: requestId }, requestId, status);
}
