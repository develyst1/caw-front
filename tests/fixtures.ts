// Every spec imports `test` from here: before each test the server's in-memory mock is put back to its seed (POST /test-reset,
// which exists only when the server was started with CAW_TEST_RESET=1 — see playwright.config.ts). So a spec may change anything it
// likes and none depends on another having run first (TASK-B-045).
import { expect, test as base } from "@playwright/test";

// `test.use({ seedState: "dispatcher-stopped" })` (in a file or a describe) starts that test from a named variant of the seed instead
// (POST /test-reset?state=…, TASK-B-049): the states the screens can reach only by the real runner stopping a run by itself.
export const test = base.extend<{ seed: void; seedState: string | undefined }>({
  seedState: [undefined, { option: true }],
  seed: [async ({ request, seedState }, use) => {
    const res = await request.post(seedState ? `/test-reset?state=${encodeURIComponent(seedState)}` : "/test-reset");
    expect(res.status(), "POST /test-reset (the server must run with CAW_TEST_RESET=1 on the mock)").toBe(204);
    await use();
  }, { auto: true }],
});

export { expect };
