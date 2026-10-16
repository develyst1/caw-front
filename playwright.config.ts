import { defineConfig } from "@playwright/test";

// Runs against the production build: `NEXT_DIST_DIR=.next-b bun run build` first, then the server below.
// The port and the output folder come from the env, and a server already on the port is never reused — it could be another person's.
const port = Number(process.env.PLAYWRIGHT_PORT || 3510);

export default defineConfig({
  testDir: "tests",
  // the AC-5 check (tests/ac5.spec.ts) is red until the screen TASKs make it green: it runs only with AC5=1 (TASK-B-084; B-088 puts it in the default run)
  grepInvert: process.env.AC5 ? undefined : /@ac5/,
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
    // lets /test-reset put the in-memory mock back to its seed before each test (the route answers 404 without this)
    env: { CAW_TEST_RESET: "1" },
  },
});
