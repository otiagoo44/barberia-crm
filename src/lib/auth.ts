import "server-only";
import { supabaseServer } from "./supabase/server";
import { HttpError } from "./http";
import { cache } from "react";
export const requireUser = cache(async function requireUser() {
  const db = await supabaseServer();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "unauthenticated");
  const { data: profile } = await db
    .from("profiles")
    .select("id,full_name,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.active) throw new HttpError(403, "profile_inactive");
  return {
    db,
    user: data.user,
    profile: profile as { id: string; full_name: string; active: boolean },
  };
});
