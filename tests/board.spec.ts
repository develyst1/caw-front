// The board comp (TASK-B-039 DoD 3, REQ-011 AC-3 on the mock): every card in its place, the question card first, the filter
// narrows; plus the 390 sideways columns and the keyboard path.
import { expect, test } from "./fixtures";
import { MOCK_NEW_PROJECT_ID, MOCK_PROJECT_ID } from "../src/api/mock";
import { acceptAnswer, column, distill, section } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;

test("board: 12 cards — 1 question in the strip on top, 11 work cards in their columns", async ({ page }) => {
  await page.goto(BOARD);
  const strip = page.locator("[data-question]");
  await expect(strip).toHaveCount(1);
  const per = await page.locator("[data-column]").evaluateAll((cols) => cols.map((c) => [c.getAttribute("data-column"), c.querySelectorAll("[data-card]").length]));
  expect(Object.fromEntries(per)).toEqual({ todo: 3, doing: 2, review: 2, done: 3, stuck: 1 });
  // the question comes before every column in reading order, in its own sheet with the one-press answer (TASK-B-087 § 2)
  const first = await page.locator("[data-card]").first().getAttribute("data-question");
  expect(first, "the first card on the page is the question card").not.toBeNull();
  await expect(page.locator('[data-ask="card"]').getByRole("button", { name: acceptAnswer })).toBeVisible();
  for (const st of ["todo", "doing", "review", "done", "stuck"] as const) await expect(page.getByRole("heading", { level: 2, name: new RegExp(column[st]) })).toBeVisible();
});

test("board: choosing a worker narrows the board to their cards; choosing again shows everyone", async ({ page }) => {
  await page.goto(BOARD);
  const all = await page.locator("[data-column] [data-card]").count();
  const chip = page.locator("[data-seat]").first(); // the crew strip's seats are the filter (TASK-B-074 C6)
  const name = (await chip.getAttribute("data-seat"))!;
  await chip.click();
  const mine = await page.locator("[data-column] [data-card]").count();
  expect(mine).toBeGreaterThan(0);
  expect(mine).toBeLessThan(all);
  const shown = await page.locator("[data-column] [data-card]").evaluateAll((cs) => cs.map((c) => c.textContent ?? ""));
  for (const t of shown) expect(t).toContain(name);
  await chip.click();
  await expect(page.locator("[data-column] [data-card]")).toHaveCount(all);
});

test("board: Tab reaches the mode control, the filter and every card", async ({ page }) => {
  await page.goto(BOARD);
  const reached = new Set<string>();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    reached.add(await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a) return "";
      if (a.closest("[data-mode-control]")) return "mode"; // TASK-B-085: ToggleGroup
      if (a.hasAttribute("data-seat")) return "filter";
      return a.getAttribute("data-card") ?? "";
    }));
  }
  expect(reached.has("mode"), "the mode control").toBe(true);
  expect(reached.has("filter"), "the worker filter").toBe(true);
  const cards = await page.locator("[data-card]").evaluateAll((cs) => cs.map((c) => c.getAttribute("data-card")!));
  for (const c of cards) expect(reached.has(c), `card ${c}`).toBe(true);
});

test("board @390: the columns scroll sideways inside the board, never the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BOARD);
  const r = await page.evaluate(() => {
    const row = document.querySelector("[data-column]")!.parentElement!;
    return { page: document.documentElement.scrollWidth, row: row.scrollWidth, rowBox: row.clientWidth };
  });
  expect(r.page, "no sideways page scroll").toBeLessThanOrEqual(390);
  expect(r.row, "the columns row scrolls").toBeGreaterThan(r.rowBox);
});

// TASK-B-074 C6: the crew strip's seats are the filter — a pressed seat says so (aria-pressed), the chip row is gone
test("board: a seat press filters and says so; a second press clears; no chip row", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator(".ant-tag-checkable")).toHaveCount(0);
  const seat = page.locator("[data-seat]").first();
  await seat.click();
  await expect(seat).toHaveAttribute("aria-pressed", "true");
  await seat.click();
  await expect(seat).toHaveAttribute("aria-pressed", "false");
});

// TASK-B-087: the board in direction B
test("@1280 all five columns fit beside each other, and the chat is behind its tab (no panel, no box on the board)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BOARD);
  const boxes = await page.locator("[data-column]").evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect()).map((r) => [r.left, r.right]));
  expect(boxes).toHaveLength(5);
  for (const [l, r] of boxes) { expect(l).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1280); }
  await expect(page.locator("[data-chat-panel]")).toBeHidden();
  await expect(page.locator("[data-composer]:visible")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: section.board }).getByRole("link", { name: new RegExp(section.chat) })).toBeVisible(); // the tab (TASK-B-098 adds ไปที่แชต)
});

test("ตามนั้น answers the question in one press — the sheet leaves and รอคำตอบ clears", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('[data-ask="card"]').getByRole("button", { name: acceptAnswer }).click();
  await expect(page.locator('[data-ask="card"]')).toHaveCount(0);
  await expect(page.locator("[data-column] [data-card]").filter({ hasText: "รอคำตอบ" })).toHaveCount(0);
});

test.describe("on operator-like", () => {
  test.use({ seedState: "operator-like" });
  test("the running card is in กำลังทำ (the core moved it), and the entry worker's chat question waits on the board", async ({ page }) => {
    await page.goto(BOARD);
    await expect(page.locator('[data-column="doing"] [data-card]').filter({ hasText: "ทำ API ขออนุมัติการจองห้องประชุมขนาดใหญ่" })).toHaveCount(1);
    await expect(page.locator('[data-ask="chat"]')).toContainText("ห้องใหญ่คือห้องที่จุกี่คนขึ้นไป");
  });
  test("ตอบเอง… on the chat question opens the chat with the question in the box", async ({ page }) => {
    await page.goto(BOARD);
    await page.locator('[data-ask="chat"] [data-answer-own]').click();
    await expect(page.getByLabel(distill.placeholder("Paul"))).toHaveValue( // C-1 (TASK-B-100): the box names operator-like's entry person
      /ห้องใหญ่คือห้องที่จุกี่คนขึ้นไป/);
  });
});

test("@390 no request box on the board", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BOARD);
  await expect(page.locator("[data-composer]:visible")).toHaveCount(0);
});

// TASK-B-092 DEF-4 (D-088): the board follows a change made elsewhere within 4 s — the 3 s poll, always. (No test door can start a hop on the mock —
// see the TASK's ## Questions — so the change is a card moved to กำลังทำ from another tab, which the board must show without a reload.)
test("a card moved from another tab shows in its new column within 4 s, with no reload", async ({ page, context }) => {
  await page.goto(BOARD);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  const card = page.locator('[data-column="todo"] [data-card]').first();
  const id = (await card.getAttribute("data-card"))!;
  const other = await context.newPage();
  await other.goto(`${BOARD}/c/${id}`);
  await other.getByLabel("สถานะ").click();
  await other.getByRole("option", { name: column.review }).click();
  await expect(other.locator('[data-control="status"]')).toContainText(column.review);
  await page.bringToFront(); // the poll runs only while its tab is visible
  const t0 = Date.now();
  await expect(page.locator(`[data-column="review"] [data-card="${id}"]`)).toHaveCount(1, { timeout: 4000 });
  console.log(`DEF-4: the board followed in ${Date.now() - t0} ms`);
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
});

// TASK-B-100 B-2 / B-7 / B-4 (D-094): no cards → one sentence and one button in place of five empty columns; no folded 3/3 strip; the crew has no frame
test.describe("a project with no cards", () => {
  test.use({ seedState: "new-project" });
  test("the empty board is one sentence; once there is a team its button is เล่างานให้ {entry} ในแชต → แชต", async ({ page }) => {
    await page.goto(`/p/${MOCK_NEW_PROJECT_ID}`);
    await expect(page.locator("[data-board-empty]")).toBeVisible();
    await expect(page.locator("[data-columns]")).toHaveCount(0);
    await page.getByRole("button", { name: /ใช้ทีมเริ่มต้น/ }).click();
    const tell = page.locator("[data-tell-entry]");
    await expect(tell).toHaveText(distill.tellEntry("ปลา"));
    await expect(page.locator("[data-crew-wrap]")).toHaveCSS("border-top-width", "0px");
    await tell.click();
    await expect(page).toHaveURL(new RegExp(`/p/${MOCK_NEW_PROJECT_ID}/chat$`));
  });
});
