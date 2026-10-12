import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const db = await supabaseServer();
  const code = q.get("code");
  const hash = q.get("token_hash");
  const type = q.get("type");
  let ok = false;
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (
    hash &&
    (type === "signup" ||
      type === "recovery" ||
      type === "invite" ||
      type === "email")
  ) {
    const { error } = await db.auth.verifyOtp({ token_hash: hash, type });
    ok = !error;
  }
  const target = ok
    ? q.get("next") === "reset-password" || type === "recovery"
      ? "/reset-password"
      : "/"
    : "/login?link=expired";
  return NextResponse.redirect(
    new URL(target, process.env.APP_URL ?? "http://localhost:3000"),
  );
}
