// Every spec imports `test` from here: before each test the server's in-memory mock is put back to its seed (POST /test-reset,
// which exists only when the server was started with CAW_TEST_RESET=1 — see playwright.config.ts). So a spec may change anything it
// likes and none depends on another having run first (TASK-B-045).
import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ seed: void }>({
  seed: [async ({ request }, use) => {
    const res = await request.post("/test-reset");
    expect(res.status(), "POST /test-reset (the server must run with CAW_TEST_RESET=1 on the mock)").toBe(204);
    await use();
  }, { auto: true }],
});

export { expect };
