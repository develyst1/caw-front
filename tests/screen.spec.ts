// A worker's read-only screen (TASK-106, REQ-104 AC-1, AC-2, AC-4, AC-5, AC-6 view side) on the mock: closed until ดูหน้าจอ is pressed, live lines arrive
// without a reload, nothing in it can be typed into, a finished hop shows its times and a gap marker, a worker who never worked says so.
// The plain seed: ฝน has the running hop (her output grows by a line every 2 s), ปลา's newest hop is the finished one with a 12 s gap, มิ้นท์ has no hop.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { screen } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;
const sheet = (page: import("@playwright/test").Page) => page.locator("[data-screen]");
const lines = (page: import("@playwright/test").Page) => sheet(page).locator('[data-kind="line"]');
const watch = (page: import("@playwright/test").Page, name: string) => page.locator(`[data-watch="${name}"]`);

test("closed until pressed: the loaded board has no [data-screen], and every seat has its own ดูหน้าจอ", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-seat]").first()).toBeVisible();
  await expect(page.locator("[data-screen]")).toHaveCount(0);
  const seats = await page.locator("[data-seat]").count();
  await expect(page.locator("[data-watch]")).toHaveCount(seats);
  await expect(watch(page, "ฝน")).toHaveText(screen.watch);
});

test("the running worker: the sheet opens with สด, a new line appears within 5 s with no reload, and the seat's filter is untouched", async ({ page }) => {
  await page.goto(BOARD);
  const cardsBefore = await page.locator("[data-column] [data-card]").count();
  await watch(page, "ฝน").click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("heading", { name: screen.title("ฝน") })).toBeVisible();
  await expect(sheet(page).locator("[data-live]")).toHaveText(screen.live);
  await expect(lines(page).first()).toBeVisible();
  const n0 = await lines(page).count();
  let reloaded = false;
  page.on("framenavigated", () => { reloaded = true; });
  await expect.poll(() => lines(page).count(), { timeout: 5000 }).toBeGreaterThan(n0);
  expect(reloaded, "the page was not navigated or reloaded").toBe(false);
  // pressing ดูหน้าจอ opened the view and did not change the filter
  await expect(page.locator('[data-seat="ฝน"]')).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator("[data-column] [data-card]").count()).toBe(cardsBefore);
});

test("nothing can be typed into the screen: no input, textarea or contenteditable inside it", async ({ page }) => {
  await page.goto(BOARD);
  await watch(page, "ฝน").click();
  await expect(sheet(page)).toBeVisible();
  await expect(lines(page).first()).toBeVisible();
  await expect(sheet(page).locator("input, textarea, [contenteditable]")).toHaveCount(0);
});

test("a worker whose newest hop has ended: it says when it started and when it finished, and the 12 s gap is in words", async ({ page }) => {
  await page.goto(BOARD);
  await watch(page, "ปลา").click();
  await expect(sheet(page).getByRole("heading", { name: screen.title("ปลา") })).toBeVisible();
  await expect(sheet(page).locator("[data-live]")).toHaveCount(0);
  await expect(sheet(page).locator("[data-started]")).toContainText("เริ่มเมื่อ");
  await expect(sheet(page).locator("[data-ended]")).toContainText("จบงานเมื่อ");
  await expect(sheet(page).locator('[data-kind="gap"]')).toHaveText(screen.gap(12));
  await expect(lines(page).first()).toBeVisible();
  // a finished hop is read once: its lines do not change while the sheet stays open
  const n = await lines(page).count();
  await page.waitForTimeout(2500);
  expect(await lines(page).count()).toBe(n);
});

test("a worker with no hop at all says so", async ({ page }) => {
  await page.goto(BOARD);
  await watch(page, "มิ้นท์").click();
  await expect(sheet(page).locator("[data-none]")).toHaveText(screen.empty);
  await expect(sheet(page).locator("[data-live], [data-started], [data-ended]")).toHaveCount(0);
});

test("closing the sheet takes it out of the page", async ({ page }) => {
  await page.goto(BOARD);
  await watch(page, "ฝน").click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole("button", { name: "ปิด" }).click();
  await expect(page.locator("[data-screen]")).toHaveCount(0);
});

test.describe("from the team screen", () => {
  test.use({ seedState: "operator-like" });
  test("the person's drawer has ดูหน้าจอ; pressing it opens that person's screen, and nothing is open before", async ({ page }) => {
    await page.goto(`${BOARD}/team`);
    await page.locator("[data-node]:visible").first().click();
    const drawer = page.locator("[data-side-panel]");
    await expect(drawer).toBeVisible();
    await expect(page.locator("[data-screen]")).toHaveCount(0);
    const name = (await drawer.locator("[data-watch]").getAttribute("data-watch"))!;
    await drawer.locator("[data-watch]").click();
    await expect(sheet(page).getByRole("heading", { name: screen.title(name) })).toBeVisible();
    await expect(sheet(page).locator("input, textarea, [contenteditable]")).toHaveCount(0);
  });
});
