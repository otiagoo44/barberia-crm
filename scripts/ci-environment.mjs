import { execFileSync } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
if (process.env.CI !== "true")
  throw new Error("CI-only configuration generator");
const binary = path.resolve("node_modules/supabase/dist/supabase.js");
const status = JSON.parse(
  execFileSync(process.execPath, [binary, "status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
for (const key of [
  "ANON_KEY",
  "PUBLISHABLE_KEY",
  "SERVICE_ROLE_KEY",
  "SECRET_KEY",
])
  if (status[key]) console.log(`::add-mask::${status[key]}`);
if (!["127.0.0.1", "localhost"].includes(new URL(status.API_URL).hostname))
  throw new Error("Expected isolated local Supabase");
const env = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  LOCAL_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY ?? status.SECRET_KEY,
  LOCAL_DB_URL: status.DB_URL,
  APP_URL: "http://localhost:3000",
  BOOKING_GATEWAY_SECRET: "test-booking-secret-".repeat(4),
  WORKER_SECRET: "test-worker-secret-".repeat(4),
  CRON_SECRET: "test-cron-secret-".repeat(4),
  E2E_REAL_SUPABASE: "1",
  COOKIE_SECURE: "false",
};
for (const [key, value] of Object.entries(env)) {
  if (value === undefined) throw new Error("Missing local configuration");
  if (/SECRET|KEY|DB_URL/.test(key)) console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
}
writeFileSync(
  ".env.local",
  Object.entries(env)
    .filter(([key]) => !key.startsWith("LOCAL_"))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Configured isolated Supabase and HTTP test environment; credentials suppressed.",
);
