// The reset door itself (TASK-B-045, -049): no state = the plain seed, a known state = that variant, an unknown one is refused and changes nothing.
import { expect, test } from "./fixtures";
import { MOCK_NEW_PROJECT_ID, MOCK_PROJECT_ID } from "../src/api/mock";
import { runRunning } from "../src/words";

const modeOf = async (page: import("@playwright/test").Page) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  return page.locator(".ant-segmented-item-selected").first().textContent();
};

test("POST /test-reset?state=dispatcher-stopped → 204 and the project is on อัตโนมัติ; plain POST → back to manual", async ({ page, request }) => {
  expect((await request.post("/test-reset?state=dispatcher-stopped")).status()).toBe(204);
  expect(await modeOf(page)).toContain("อัตโนมัติ");
  expect((await request.post("/test-reset")).status()).toBe(204);
  expect(await modeOf(page)).toContain("แบบสั่งทีละขั้น");
});

test("an unknown state → 400 with the known ones named, and the seed is left as it was", async ({ page, request }) => {
  const res = await request.post("/test-reset?state=nonsense");
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain("dispatcher-stopped");
  expect(await modeOf(page)).toContain("แบบสั่งทีละขั้น");
});

test("POST /test-reset?state=chat-failed → 204 and the thread's second ask has no reply any more; chat-running → 204; a plain POST brings the reply back", async ({ page, request }) => {
  const reply = "เสนอหน้าสรุปรายงานหนึ่งงาน";
  const chat = async () => { await page.goto(`/p/${MOCK_PROJECT_ID}/chat`); return page.locator("main").innerText(); };
  expect(await chat()).toContain(reply);
  for (const state of ["chat-failed", "chat-running"]) {
    expect((await request.post(`/test-reset?state=${state}`)).status()).toBe(204);
    const text = await chat();
    expect(text).toContain("ขอเพิ่มหน้าสรุปรายงานรายวันด้วย");
    expect(text).not.toContain(reply);
  }
  expect((await request.post("/test-reset")).status()).toBe(204);
  expect(await chat()).toContain(reply);
});

test("POST /test-reset?state=new-project → 204 and a second project with nothing in it exists; working-now → 204 and one card hop is running; a plain POST undoes both", async ({ page, request }) => {
  const projects = async () => { await page.goto("/"); return page.locator('a[href^="/p/"]').count(); };
  const running = async () => { await page.goto(`/p/${MOCK_PROJECT_ID}/runs`); return page.locator("[data-hop]").filter({ hasText: runRunning }).count(); };
  expect([await projects(), await running()]).toEqual([1, 0]);

  expect((await request.post("/test-reset?state=new-project")).status()).toBe(204);
  expect(await projects()).toBe(2);
  expect((await page.goto(`/p/${MOCK_NEW_PROJECT_ID}`))!.status()).toBe(200);
  await expect(page.locator("[data-card]")).toHaveCount(0);

  expect((await request.post("/test-reset?state=working-now")).status()).toBe(204);
  expect([await projects(), await running()]).toEqual([1, 1]);

  expect((await request.post("/test-reset")).status()).toBe(204);
  expect([await projects(), await running()]).toEqual([1, 0]);
});
