import "server-only";
import { supabaseServer } from "./supabase/server";
import { HttpError } from "./http";
import { cache } from "react";
export const requireIdentity = cache(async function requireIdentity() {
  const db = await supabaseServer();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "unauthenticated");
  const { data: profile } = await db
    .from("profiles")
    .select("id,full_name,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.active) throw new HttpError(403, "profile_inactive");
  const { data: security, error: gateError } = await db.rpc("security_context");
  if (gateError || !security) throw new HttpError(401, "session_revoked");
  return {
    db,
    user: data.user,
    profile: profile as { id: string; full_name: string; active: boolean },
    security: security as {
      required: boolean;
      level: string;
      allowed: boolean;
      password_change_required?: boolean;
    },
  };
});
export const requireUser = cache(async function requireUser() {
  const context = await requireIdentity();
  if (context.security.password_change_required)
    throw new HttpError(403, "password_change_required");
  if (!context.security.allowed) throw new HttpError(403, "mfa_required");
  return context;
});
