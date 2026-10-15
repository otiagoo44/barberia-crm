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

export function assertDeploymentEnvironment(
  env: Record<string, string | undefined>,
) {
  if (env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview") return;
  assertEnvironmentBoundary(env);
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "APP_URL",
    "BOOKING_GATEWAY_SECRET",
    "WORKER_SECRET",
    "CRON_SECRET",
    "PRODUCTION_SUPABASE_PROJECT_REF",
  ]) {
    if (!env[name]?.trim()) throw new Error(`deployment_missing_${name}`);
  }
  const app = new URL(env.APP_URL!);
  const database = new URL(env.NEXT_PUBLIC_SUPABASE_URL!);
  if (
    app.protocol !== "https:" ||
    app.username ||
    app.password ||
    app.pathname !== "/" ||
    app.search ||
    app.hash
  )
    throw new Error("deployment_invalid_app_origin");
  if (
    database.protocol !== "https:" ||
    !/^[a-z0-9]+\.supabase\.co$/.test(database.hostname)
  )
    throw new Error("deployment_requires_supabase_project_url");
  if (
    env.VERCEL_ENV === "production" &&
    (env.SUPABASE_ENVIRONMENT !== "production" ||
      database.hostname.split(".")[0] !== env.PRODUCTION_SUPABASE_PROJECT_REF)
  )
    throw new Error("production_database_boundary_not_configured");
  const secrets = [
    env.BOOKING_GATEWAY_SECRET!,
    env.WORKER_SECRET!,
    env.CRON_SECRET!,
  ];
  if (
    secrets.some((value) => value.trim().length < 32) ||
    new Set(secrets).size !== secrets.length
  )
    throw new Error("deployment_requires_independent_secrets");
}
