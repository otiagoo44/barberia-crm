/* global AbortSignal, setTimeout */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
const root = resolve(".");
const dir = resolve(process.env.QA_SERVER_DIR ?? ".");
if (dir !== root && !dir.startsWith(resolve(".test-data") + sep))
  throw Error("Unsafe QA server directory");
const port = Number(process.env.QA_SERVER_PORT ?? 3001);
if (![3001, 3002].includes(port) || process.env.E2E_REAL_SUPABASE !== "1")
  throw Error("Isolated QA server required");
const base = `http://localhost:${port}`;
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw Error("QA server requires isolated Supabase, never a cloud project");
await mkdir(".test-data", { recursive: true });
const log = createWriteStream(`.test-data/measure-${port}.log`, {
  mode: 0o600,
});
const nextPackage = JSON.parse(
  await readFile(resolve(dir, "node_modules/next/package.json"), "utf8"),
);
const nextCli = resolve(dir, "node_modules/next", nextPackage.bin.next);
const server = spawn(process.execPath, [nextCli, "start", "-p", String(port)], {
  cwd: dir,
  env: { ...process.env, APP_URL: base },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(log);
server.stderr.pipe(log);
let startupOutput = "";
const collectStartup = (chunk) => {
  startupOutput = (startupOutput + chunk.toString()).slice(-12000);
};
server.stdout.on("data", collectStartup);
server.stderr.on("data", collectStartup);
function startupFailure(message) {
  let redacted = startupOutput;
  for (const [key, value] of Object.entries(process.env))
    if (/SECRET|TOKEN|KEY|PASSWORD|DB_URL/i.test(key) && value?.length >= 8)
      redacted = redacted.split(value).join("[redacted]");
  redacted = redacted.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[redacted]",
  );
  return Error(
    `${message} (exit ${server.exitCode}, signal ${server.signalCode})\n${redacted}`,
  );
}
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
    if (server.exitCode !== null) throw startupFailure("QA server exited");
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw startupFailure("QA server did not become ready");
  server.stdout.removeListener("data", collectStartup);
  server.stderr.removeListener("data", collectStartup);
  startupOutput = "";
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
