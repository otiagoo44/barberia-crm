import { assertDeploymentEnvironment } from "../src/lib/environment-boundary.ts";

try {
  assertDeploymentEnvironment(process.env);
  console.log(
    process.env.VERCEL_ENV
      ? "Deployment environment verified."
      : "Local build: Vercel environment check skipped.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
