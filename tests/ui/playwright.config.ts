import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  outputDir: path.join(root, "test-results/ui"),
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(root, ".test-data/ui-results.json") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3007",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --import tsx tests/ui/server.ts",
    cwd: root,
    url: "http://127.0.0.1:3007",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
