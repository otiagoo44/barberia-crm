import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { secureCookies } from "@/lib/cookie-security";
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV !== "production";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'${development ? " ws: http://localhost:*" : ""}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'${development ? "" : "; upgrade-insecure-requests"}`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  headers.set("x-request-id", crypto.randomUUID());
  const result = NextResponse.next({ request: { headers } });
  result.headers.set("Content-Security-Policy", csp);
  result.headers.set("Cache-Control", "private, no-store");
  result.headers.set("X-Request-Id", headers.get("x-request-id")!);
  if (
    url &&
    key &&
    !request.nextUrl.pathname.startsWith("/api/public") &&
    !request.nextUrl.pathname.startsWith("/book/")
  ) {
    const db = createServerClient(url, key, {
      cookieOptions: {
        httpOnly: true,
        secure: secureCookies(),
        sameSite: "lax",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            result.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: secureCookies(),
              sameSite: "lax",
            });
          });
        },
      },
    });
    await db.auth.getUser();
  }
  return result;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
