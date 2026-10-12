import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { secureCookies } from "@/lib/cookie-security";
export function publicEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  return { url, key };
}
export async function supabaseServer() {
  const store = await cookies();
  const requestHeaders = await headers();
  const { url, key } = publicEnvironment();
  return createServerClient(url, key, {
    global: {
      headers: {
        "x-request-id":
          requestHeaders.get("x-request-id") ?? crypto.randomUUID(),
      },
    },
    cookieOptions: {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, {
              ...options,
              httpOnly: true,
              secure: secureCookies(),
              sameSite: "lax",
            }),
          );
        } catch {
          /* Server Components refresh cookies in proxy. */
        }
      },
    },
  });
}
export function gatewayClient(requestId?: string) {
  const { url, key } = publicEnvironment();
  return createClient(url, key, {
    global: { headers: { "x-request-id": requestId ?? crypto.randomUUID() } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
