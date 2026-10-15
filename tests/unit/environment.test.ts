import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertEnvironmentBoundary,
  assertDeploymentEnvironment,
} from "../../src/lib/environment-boundary";
test("preview refuses production and missing isolation configuration", () => {
  assert.throws(() => assertEnvironmentBoundary({ VERCEL_ENV: "preview" }));
  const env = {
    VERCEL_ENV: "preview",
    SUPABASE_ENVIRONMENT: "staging",
    PRODUCTION_SUPABASE_PROJECT_REF: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
    APP_URL: "https://preview.example.com",
  };
  assert.throws(() => assertEnvironmentBoundary(env));
  assert.doesNotThrow(() =>
    assertEnvironmentBoundary({
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co",
    }),
  );
  assert.doesNotThrow(() =>
    assertEnvironmentBoundary({ VERCEL_ENV: "production" }),
  );
});

test("Vercel build requires complete production configuration without exposing values", () => {
  const env = {
    VERCEL_ENV: "production",
    SUPABASE_ENVIRONMENT: "production",
    PRODUCTION_SUPABASE_PROJECT_REF: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-config",
    APP_URL: "https://crm.example.com",
    BOOKING_GATEWAY_SECRET: "a".repeat(64),
    WORKER_SECRET: "b".repeat(64),
    CRON_SECRET: "c".repeat(64),
  };
  assert.doesNotThrow(() => assertDeploymentEnvironment(env));
  for (const key of Object.keys(env)) {
    if (key === "VERCEL_ENV") continue;
    assert.throws(() => assertDeploymentEnvironment({ ...env, [key]: "" }));
  }
  for (const patch of [
    { APP_URL: "http://crm.example.com" },
    { APP_URL: "https://crm.example.com/login" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://production.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co" },
    { WORKER_SECRET: env.BOOKING_GATEWAY_SECRET },
    { CRON_SECRET: "too-short" },
  ])
    assert.throws(() => assertDeploymentEnvironment({ ...env, ...patch }));
  assert.doesNotThrow(() => assertDeploymentEnvironment({}));
  assert.doesNotThrow(() =>
    assertDeploymentEnvironment({
      ...env,
      VERCEL_ENV: "preview",
      SUPABASE_ENVIRONMENT: "staging",
      NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co",
    }),
  );
});
