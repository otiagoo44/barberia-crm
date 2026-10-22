/* global AbortSignal, setTimeout */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
const root = resolve(".");
const dir = resolve(process.env.QA_SERVER_DIR ?? ".");
if (dir !== root && !dir.startsWith(resolve(".test-data") + sep))
  throw Error("Unsafe QA server directory");
const port = Number(process.env.QA_SERVER_PORT ?? 3001);
if (![3001, 3002].includes(port) || process.env.E2E_REAL_SUPABASE !== "1")
  throw Error("Isolated QA server required");
const base = `http://localhost:${port}`;
await mkdir(".test-data", { recursive: true });
const log = createWriteStream(`.test-data/measure-${port}.log`, {
  mode: 0o600,
});
const server = spawn(
  process.execPath,
  [
    resolve(dir, "node_modules/next/dist/bin/next.js"),
    "start",
    "-p",
    String(port),
  ],
  {
    cwd: dir,
    env: { ...process.env, APP_URL: base },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.pipe(log);
server.stderr.pipe(log);
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      ready = (
        await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) })
      ).ok;
    } catch {
      /* Retry only isolated startup readiness. */
    }
    if (ready) break;
    if (server.exitCode !== null)
      throw Error("QA server exited; inspect private local log");
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error("QA server did not become ready");
  const child = spawn(
    process.execPath,
    [resolve("scripts/measure-product.mjs")],
    {
      env: {
        ...process.env,
        QA_BASE_URL: base,
        QA_SOURCE_DIR: dir,
        QA_BUILD_DIR: resolve(dir, ".next"),
      },
      stdio: "inherit",
    },
  );
  const code = await new Promise((r) => child.once("exit", r));
  if (code !== 0) throw Error("Browser measurement failed");
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => {
    if (server.exitCode !== null) return r();
    server.once("exit", r);
    setTimeout(() => {
      server.kill("SIGKILL");
      r();
    }, 5000).unref();
  });
  log.end();
}
