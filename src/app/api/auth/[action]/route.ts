import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { fail, response, readJson, HttpError, correlationId } from "@/lib/http";
import { requireIdentity, requireUser } from "@/lib/auth";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const id = correlationId(request);
  try {
    const { action } = await params;
    const raw = await readJson(request, 4096);
    const db = await supabaseServer();
    if (action === "signout") {
      const { error } = await db.auth.signOut({ scope: "local" });
      if (error) throw new HttpError(400, "signout_failed");
      return response({ ok: true }, id);
    }
    if (action === "revoke_sessions") {
      await requireUser();
      const { error } = await db.auth.signOut({ scope: "global" });
      if (error) throw new HttpError(400, "signout_failed");
      return response({ ok: true }, id);
    }
    if (action === "signin") {
      const p = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(128),
        })
        .strict()
        .parse(raw);
      const { data: signedIn, error } = await db.auth.signInWithPassword(p);
      if (error)
        throw new HttpError(
          400,
          error.code === "email_not_confirmed"
            ? "email_confirmation_required"
            : "invalid_credentials",
        );
      const { data: profile } = await db
        .from("profiles")
        .select("active")
        .eq("id", signedIn.user!.id)
        .maybeSingle();
      if (!profile?.active) {
        await db.auth.signOut();
        throw new HttpError(403, "profile_inactive");
      }
      return response({ ok: true }, id);
    }
    if (action === "signup") {
      const p = z
        .object({
          email: z.email(),
          password: z.string().min(12).max(128),
          name: z.string().trim().min(1).max(120),
        })
        .strict()
        .parse(raw);
      const { error } = await db.auth.signUp({
        email: p.email,
        password: p.password,
        options: {
          data: { full_name: p.name },
          emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
        },
      });
      if (error) throw new HttpError(400, "signup_failed");
      return response(
        {
          ok: true,
          message:
            "Revisá tu correo para confirmar la cuenta. Luego el propietario podrá darte acceso.",
        },
        id,
      );
    }
    if (action === "confirm") {
      const p = z.object({ email: z.email() }).strict().parse(raw);
      await db.auth.resend({
        type: "signup",
        email: p.email,
        options: {
          emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
        },
      });
      return response(
        {
          ok: true,
          message:
            "Si falta confirmar esa cuenta, recibirás un nuevo mensaje. Abrí el enlace de tu correo para continuar.",
        },
        id,
      );
    }
    if (action === "recover") {
      const p = z.object({ email: z.email() }).strict().parse(raw);
      await db.auth.resetPasswordForEmail(p.email, {
        redirectTo: `${process.env.APP_URL}/auth/callback?next=reset-password`,
      });
      return response(
        {
          ok: true,
          message: "Si la cuenta existe, recibirás instrucciones por correo.",
        },
        id,
      );
    }
    if (action === "password") {
      const p = z
        .object({ password: z.string().min(12).max(128) })
        .strict()
        .parse(raw);
      const identity = await requireIdentity();
      const factors = await db.auth.mfa.listFactors();
      if (factors.error) throw new HttpError(400, "password_update_failed");
      // Recovery email never removes or bypasses an existing second factor.
      if (
        factors.data.all.some((f) => f.status === "verified") &&
        identity.security.level !== "aal2"
      )
        throw new HttpError(403, "mfa_required");
      const { error } = await db.auth.updateUser({ password: p.password });
      if (error) throw new HttpError(400, "password_update_failed");
      return response({ ok: true }, id);
    }
    throw new HttpError(404, "not_found");
  } catch (error) {
    return fail(error, id);
  }
}
