/* global window, PerformanceObserver, performance */
// Measures only a real, isolated Supabase fixture. No response bodies/secrets saved.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
const base = process.env.QA_BASE_URL ?? "http://localhost:3000";
if (
  process.env.E2E_REAL_SUPABASE !== "1" ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw Error("HTTP benchmark requires isolated localhost Auth");
const phase = ["before", "profiling"].includes(process.env.QA_PHASE)
  ? process.env.QA_PHASE
  : "after";
const fixture = JSON.parse(
  await readFile(".test-data/e2e/ux-fixtures.json", "utf8"),
);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
function totp(secret) {
  const bits = [...secret.replace(/=+$/, "")]
    .map((c) =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        .indexOf(c)
        .toString(2)
        .padStart(5, "0"),
    )
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return ((h.readUInt32BE(h.at(-1) & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const percentile = (items, p) => {
  const sorted = [...items].sort((a, b) => a - b);
  return sorted.length
    ? Number(
        sorted[
          Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)
        ].toFixed(2),
      )
    : null;
};
try {
  const signIn = await context.request.post(base + "/api/auth/signin", {
    headers: { Origin: base },
    data: { email: "ownerA@fixture.invalid", password: fixture.password },
  });
  expect(signIn.ok()).toBeTruthy();
  const factor = fixture.mfa?.ownerA;
  if (factor) {
    const verify = await context.request.post(base + "/api/auth/mfa/verify", {
      headers: { Origin: base },
      data: { factor: factor.factor, code: totp(factor.secret) },
    });
    expect(verify.ok()).toBeTruthy();
  }
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__qa = { longTasks: [], events: [], lcp: [], profiles: [] };
    for (const type of ["longtask", "event", "largest-contentful-paint"]) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.__qa[
            type === "longtask"
              ? "longTasks"
              : type === "event"
                ? "events"
                : "lcp"
          ].push({ duration: e.duration, start: e.startTime });
      }).observe({ type, buffered: true, durationThreshold: 16 });
    }
    window.addEventListener("barberia:profile", (e) =>
      window.__qa.profiles.push(e.detail),
    );
  });
  const samples = [];
  for (const module of [
    "inicio",
    "agenda",
    "clientes",
    "caja",
    "finanzas",
    "equipo",
    "reportes",
  ]) {
    for (let repeat = 0; repeat < 5; repeat++) {
      const requests = [];
      let pending = 0;
      const eligible = (r) => /\/api\/(workspace|finance)\//.test(r.url());
      const onRequest = (r) => {
        if (eligible(r)) {
          pending++;
          requests.push({
            url: new URL(r.url()).pathname + new URL(r.url()).search,
            request: r,
          });
        }
      };
      const onDone = (r) => {
        if (eligible(r)) pending--;
      };
      page.on("request", onRequest);
      page.on("requestfinished", onDone);
      page.on("requestfailed", onDone);
      const begin = performance.now();
      await page.goto(`${base}/ux-a/${module}`);
      await expect(page.locator(".page-heading h1").first()).toBeVisible();
      await expect(page.locator(".loading:visible")).toHaveCount(0);
      await expect.poll(() => pending, { timeout: 20000 }).toBe(0);
      const readyMs = performance.now() - begin;
      const initial = requests.length;
      const refresh = page
        .getByRole("button", { name: "Actualizar", exact: true })
        .first();
      let interactionMs = null;
      if (await refresh.isVisible()) {
        const start = performance.now();
        await refresh.click();
        await expect.poll(() => pending).toBe(0);
        await expect(page.locator(".loading:visible")).toHaveCount(0);
        interactionMs = performance.now() - start;
      }
      const browserMetrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const assets = performance.getEntriesByType("resource");
        return {
          ttfb_ms: nav.responseStart,
          domContentLoaded_ms: nav.domContentLoadedEventEnd,
          transfer_bytes: assets.reduce((sum, r) => sum + r.transferSize, 0),
          js_transfer_bytes: assets
            .filter((r) => r.name.includes(".js"))
            .reduce((sum, r) => sum + r.transferSize, 0),
          ...window.__qa,
        };
      });
      const timings = await Promise.all(
        requests.map(async ({ url, request }) => {
          const response = await request.response();
          const t = request.timing();
          return {
            endpoint: url.split("?")[0],
            key: url,
            status: response?.status() ?? 0,
            ttfb_ms: t.responseStart >= 0 ? t.responseStart : null,
            duration_ms: t.responseEnd >= 0 ? t.responseEnd : null,
          };
        }),
      );
      const counts = new Map();
      for (const r of requests.slice(0, initial))
        counts.set(r.url, (counts.get(r.url) ?? 0) + 1);
      samples.push({
        module,
        repeat,
        ready_ms: readyMs,
        refresh_ms: interactionMs,
        initial_requests: initial,
        duplicate_requests: [...counts.values()].reduce(
          (s, n) => s + Math.max(0, n - 1),
          0,
        ),
        requests: timings.map((r) => ({
          endpoint: r.endpoint,
          status: r.status,
          ttfb_ms: r.ttfb_ms,
          duration_ms: r.duration_ms,
        })),
        browser: browserMetrics,
      });
      page.off("request", onRequest);
      page.off("requestfinished", onDone);
      page.off("requestfailed", onDone);
    }
  }
  const modules = [...new Set(samples.map((s) => s.module))].map((module) => {
    const rows = samples.filter((s) => s.module === module);
    return {
      module,
      samples: rows.length,
      ready_p50_ms: percentile(
        rows.map((s) => s.ready_ms),
        0.5,
      ),
      ready_p95_ms: percentile(
        rows.map((s) => s.ready_ms),
        0.95,
      ),
      ready_p99_ms: percentile(
        rows.map((s) => s.ready_ms),
        0.99,
      ),
      requests: rows.map((s) => s.initial_requests),
      duplicates: rows.map((s) => s.duplicate_requests),
      api_p50_ms: percentile(
        rows.flatMap((s) =>
          s.requests.map((r) => r.duration_ms).filter((x) => x !== null),
        ),
        0.5,
      ),
      api_p95_ms: percentile(
        rows.flatMap((s) =>
          s.requests.map((r) => r.duration_ms).filter((x) => x !== null),
        ),
        0.95,
      ),
      api_p99_ms: percentile(
        rows.flatMap((s) =>
          s.requests.map((r) => r.duration_ms).filter((x) => x !== null),
        ),
        0.99,
      ),
    };
  });
  async function size(dir) {
    let bytes = 0;
    for (const f of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${f.name}`;
      bytes += f.isDirectory() ? await size(path) : (await stat(path)).size;
    }
    return bytes;
  }
  const result = {
    phase,
    sha: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      cwd: process.env.QA_SOURCE_DIR,
    }).trim(),
    fixture: "real Supabase Auth localhost, synthetic QA tenant",
    environment: {
      platform: process.platform,
      node: process.version,
      cpu: os.cpus()[0].model,
      logical_cpus: os.cpus().length,
    },
    chunk_build_bytes: await size(
      `${process.env.QA_BUILD_DIR ?? ".next"}/static/chunks`,
    ),
    modules,
    samples,
    limits:
      "Five samples per module: p95/p99 are maxima, exploratory not capacity/SLA. Browser event timings are synthetic, not field INP. No customer response bodies stored. Ordinary production builds do not provide React profile durations.",
  };
  await mkdir("docs/verification/definitive", { recursive: true });
  await writeFile(
    `docs/verification/definitive/performance-${phase}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify({ phase, modules }));
} finally {
  await context.close();
  await browser.close();
}
