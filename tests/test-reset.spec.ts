// The reset door itself (TASK-B-045, -049): no state = the plain seed, a known state = that variant, an unknown one is refused and changes nothing.
import { expect, test } from "./fixtures";
import { MOCK_NEW_PROJECT_ID, MOCK_PROJECT_ID } from "../src/api/mock";
import { runRunning } from "../src/words";

const modeOf = async (page: import("@playwright/test").Page) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  return page.locator('[data-mode-control] [aria-checked="true"]').first().textContent(); // TASK-B-085: ToggleGroup
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

test("POST /test-reset?state=new-project → 204 and a second project with nothing in it exists; working-now → 204 and the one running card hop moves from ฝน's card to แบงค์'s; a plain POST undoes both", async ({ page, request }) => {
  const projects = async () => { await page.goto("/"); return page.locator('a[href^="/p/"]').count(); };
  // the one running hop (a project has one at a time): the title of the card it is on — the plain seed runs ฝน on card 3, `working-now` runs แบงค์ on card 4
  const running = async () => { await page.goto(`/p/${MOCK_PROJECT_ID}/runs`); const hops = page.locator("[data-hop]").filter({ hasText: runRunning }); return [await hops.count(), (await hops.first().innerText()).includes("ทำ API สร้างการจอง") ? "card 4" : "card 3"]; };
  expect([await projects(), ...(await running())]).toEqual([1, 1, "card 3"]);

  expect((await request.post("/test-reset?state=new-project")).status()).toBe(204);
  expect(await projects()).toBe(2);
  expect((await page.goto(`/p/${MOCK_NEW_PROJECT_ID}`))!.status()).toBe(200);
  await expect(page.locator("[data-card]")).toHaveCount(0);

  expect((await request.post("/test-reset?state=working-now")).status()).toBe(204);
  expect([await projects(), ...(await running())]).toEqual([1, 1, "card 4"]);

  expect((await request.post("/test-reset")).status()).toBe(204);
  expect([await projects(), ...(await running())]).toEqual([1, 1, "card 3"]);
});

test("POST /test-reset?state=entry-asked → 204 and the thread ends on the entry worker's questions; a plain POST puts the thread back", async ({ page, request }) => {
  const asked = "นับการจองที่ยกเลิกในสรุปรายวันด้วยไหม"; // the question the state adds to the newest reply
  const chat = async () => { await page.goto(`/p/${MOCK_PROJECT_ID}/chat`); return page.locator("main").innerText(); };
  expect(await chat()).not.toContain(asked);
  expect((await request.post("/test-reset?state=entry-asked")).status()).toBe(204);
  expect(await chat()).toContain(asked);
  expect((await request.post("/test-reset")).status()).toBe(204);
  expect(await chat()).not.toContain(asked);
});

