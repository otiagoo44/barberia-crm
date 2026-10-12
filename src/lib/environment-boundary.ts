export function assertEnvironmentBoundary(
  env: Record<string, string | undefined>,
) {
  if (env.VERCEL_ENV !== "preview") return;
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (env.SUPABASE_ENVIRONMENT !== "staging" || !productionRef || !url)
    throw new Error("preview_database_boundary_not_configured");
  const projectRef = new URL(url).hostname.split(".")[0];
  if (projectRef === productionRef)
    throw new Error("preview_cannot_use_production_database");
  if (!env.APP_URL || new URL(env.APP_URL).protocol !== "https:")
    throw new Error("preview_origin_not_configured");
}
