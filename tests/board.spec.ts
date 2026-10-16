// The board comp (TASK-B-039 DoD 3, REQ-011 AC-3 on the mock): every card in its place, the question card first, the filter
// narrows; plus the 390 sideways columns and the keyboard path.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { column } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;

test("board: 12 cards — 1 question in the strip on top, 11 work cards in their columns", async ({ page }) => {
  await page.goto(BOARD);
  const strip = page.locator("[data-question]");
  await expect(strip).toHaveCount(1);
  const per = await page.locator("[data-column]").evaluateAll((cols) => cols.map((c) => [c.getAttribute("data-column"), c.querySelectorAll("[data-card]").length]));
  expect(Object.fromEntries(per)).toEqual({ todo: 3, doing: 2, review: 2, done: 3, stuck: 1 });
  // the question card comes before every column in reading order, and stands out (blue 2 px border)
  const first = await page.locator("[data-card]").first().getAttribute("data-question");
  expect(first, "the first card on the page is the question card").not.toBeNull();
  expect(await strip.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("2px");
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
