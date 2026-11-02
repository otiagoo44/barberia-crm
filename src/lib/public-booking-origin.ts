// Only the public booking API accepts these browser origins. Session/auth routes
// retain their same-origin check. No wildcard, credentials or forwarded origin.
export function publicBookingOrigins(env: Record<string, string | undefined>) {
  const native = new URL(env.APP_URL || "http://localhost:3000").origin;
  const local = new URL(native).protocol === "http:" && ["localhost", "127.0.0.1"].includes(new URL(native).hostname);
  const origins = (env.PUBLIC_BOOKING_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password ||
        (url.protocol !== "https:" && !(local && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
      throw new Error("invalid_public_booking_origin");
  }
  return new Set([native, ...origins]);
}
export function publicBookingCors(request: Request, env: Record<string, string | undefined>) {
  const origin = request.headers.get("origin");
  if (origin && !publicBookingOrigins(env).has(origin)) return null;
  return origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { Vary: "Origin" };
}
