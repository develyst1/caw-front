import { defineConfig } from "@playwright/test";

// Runs against the production build: `NEXT_DIST_DIR=.next-b bun run build` first, then the server below.
// The port and the output folder come from the env, and a server already on the port is never reused — it could be another person's.
const port = Number(process.env.PLAYWRIGHT_PORT || 3510);
// TASK-B-101 (D-095 DEF-6): the `ac5-dev` project runs the AC-5 console pass (tests tagged `@ac5dev`) under `next dev`, where React's development warnings
// (a duplicate key among them) exist. It has its own port and dist folder, so it never touches another session's dev server, and it is only part of a run
// that asks for it by name (`--project ac5-dev`, which then starts no production server) or with `AC5_DEV=1` — the default run is the production build alone.
const devPort = Number(process.env.PLAYWRIGHT_DEV_PORT || 3511);
// the test workers load this file again with their own argv, so the choice made here travels to them in the env
const byName = process.env.AC5_DEV_ONLY === "1" || process.argv.some((a, i) => a === "--project=ac5-dev" || (a === "--project" && process.argv[i + 1] === "ac5-dev"));
if (byName) process.env.AC5_DEV_ONLY = "1";
const wantsDev = byName || process.env.AC5_DEV === "1";

export default defineConfig({
  testDir: "tests",
  // the AC-5 check (tests/ac5.spec.ts) is part of the default run since TASK-B-088 — every screen, every width, both themes
  outputDir: process.env.PLAYWRIGHT_OUTPUT || "test-results",
  reporter: [["list"]],
  fullyParallel: false,
  workers: 1,
  use: {
    // The locally installed Google Chrome (Chromium) — no browser download needed.
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "build", grepInvert: /@ac5dev/, use: { baseURL: `http://127.0.0.1:${port}` } },
    ...(wantsDev ? [{ name: "ac5-dev", grep: /@ac5dev/, timeout: 90_000, use: { baseURL: `http://127.0.0.1:${devPort}` } }] : []),
  ],
  // the e2e runs on the built-in sample data (D-089: the app's default is the real caw-back now), and /test-reset may put that mock back to
  // its seed before each test (the route answers 404 without both). A server already on a port is never reused — it could be another person's.
  webServer: [
    ...(byName ? [] : [{ command: `bunx next start -p ${port}`, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 60_000, env: { CAW_API: "mock", CAW_TEST_RESET: "1" } }]),
    ...(wantsDev ? [{ command: `bunx next dev -p ${devPort}`, url: `http://127.0.0.1:${devPort}/`, reuseExistingServer: false, timeout: 120_000, env: { CAW_API: "mock", CAW_TEST_RESET: "1", NEXT_DIST_DIR: process.env.NEXT_DIST_DIR_DEV || ".next-b-dev" } }] : []),
  ],
});
