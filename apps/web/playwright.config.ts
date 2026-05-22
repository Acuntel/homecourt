// HOMECOURT — Playwright config for the M12 E2E suite.
//
// Runs the 10 smoke flows from BUILD.md §28 against a local `pnpm dev`
// server on http://localhost:3000. Some flows additionally require:
//   - docker compose up postgres nats engine     (orderbook + fills)
//   - docker compose up oracle                   (settlement flow #9)
//
// Use `reuseExistingServer: true` so we don't bounce dev when iterating.

import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Lightweight .env.local loader so the test runner sees the same vars Next does.
function loadDotEnvLocal(): void {
  const envPath = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnvLocal();

// Use 3010 by default — Brady often has port 3000 occupied by other Next apps.
// Override with PORT=... env var or E2E_BASE_URL=... for CI or staging runs.
const PORT = Number(process.env.PORT ?? 3010);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/fixtures.ts", "**/helpers/**"],
  fullyParallel: false,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: 1,
  reporter: IS_CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `pnpm dev --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      // pino-pretty's worker thread crashes inside the Next dev runtime —
      // disabling the pretty transport keeps the server alive for the suite.
      HOMECOURT_DISABLE_PINO_PRETTY: "1",
    },
  },
});
