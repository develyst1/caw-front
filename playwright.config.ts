import { defineConfig } from "@playwright/test";

// Runs against the production build: `NEXT_DIST_DIR=.next-b bun run build` first, then the server below.
// The port and the output folder come from the env, and a server already on the port is never reused — it could be another person's.
const port = Number(process.env.PLAYWRIGHT_PORT || 3510);

export default defineConfig({
  testDir: "tests",
  outputDir: process.env.PLAYWRIGHT_OUTPUT || "test-results",
  reporter: [["list"]],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    // The locally installed Google Chrome (Chromium) — no browser download needed.
    channel: "chrome",
  },
  webServer: {
    command: `bunx next start -p ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
