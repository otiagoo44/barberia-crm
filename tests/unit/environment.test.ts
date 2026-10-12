import { test } from "node:test";
import assert from "node:assert/strict";
import { assertEnvironmentBoundary } from "../../src/lib/environment-boundary";
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
