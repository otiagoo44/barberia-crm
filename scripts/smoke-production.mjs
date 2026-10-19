// Read-only checks. Never logs response bodies, credentials or customer data.
// For protected deployments run with the authorized Vercel CLI instead; no bypass here.
import assert from "node:assert/strict";
const origin = new URL(
  process.env.SMOKE_ORIGIN ?? "https://barberia-crm-kappa.vercel.app",
);
assert.equal(origin.protocol, "https:");
assert.equal(origin.pathname, "/");
assert.equal(origin.search, "");
assert.equal(origin.hash, "");
assert.equal(origin.username + origin.password, "");
const checks = [
  ["/api/health", 200, "health"],
  ["/api/health/ready", 200, "ready"],
  ["/api/jobs", 403, "worker-denies-missing-secret"],
];
for (const [pathname, expected, name] of checks) {
  const result = await fetch(new URL(pathname, origin), {
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(15000),
    headers: { "Cache-Control": "no-cache" },
  });
  assert.equal(
    result.status,
    expected,
    `${name}: unexpected HTTP status (deployment protection may require authorized CLI)`,
  );
  const contentType = result.headers.get("content-type") ?? "";
  assert.ok(
    contentType.includes("application/json"),
    `${name}: expected JSON, not a protection page`,
  );
  const body = await result.json();
  if (name === "ready") assert.equal(body.ready, true);
  assert.ok(result.headers.get("cache-control")?.includes("no-store"));
  console.log(
    JSON.stringify({ check: name, status: result.status, passed: true }),
  );
}
