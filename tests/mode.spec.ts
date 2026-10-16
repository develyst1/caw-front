// The mode switch (TASK-B-047, DEF-2 · D-051 · Q1): the budget box starts at the project's budget; with a run still open, choosing
// อัตโนมัติ changes nothing and says so; switching back to แบบสั่งทีละขั้น ends the open run as the runner does (operator_stopped).
// Seed (fixtures.ts reset): mode แบบสั่งทีละขั้น, budget 40, two runs, both ended.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { mode, runRunning, runStillOpen, runStopped, stopReason } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;
type Page = import("@playwright/test").Page;
// TASK-B-085: the mode is a Radix ToggleGroup (one of two → role radio, aria-checked), no longer Ant's Segmented
const auto = (page: Page) => page.locator("[data-mode-control]").getByRole("radio", { name: mode.dispatcher });
const manual = (page: Page) => page.locator("[data-mode-control]").getByRole("radio", { name: mode.manual });
const budgetBox = (page: Page) => page.locator(".ant-popover:visible input");
const submitBudget = (page: Page) => page.getByRole("button", { name: mode.dispatcher, exact: true }).last().click();
const budgetLine = async (page: Page) => /งบ \d+ ก้าว · ใช้ไป \d+/.exec((await page.locator("header").first().textContent())!)![0];

test("mode: the budget box starts at the project's own budget (40), not 10", async ({ page }) => {
  await page.goto(BOARD);
  await auto(page).click();
  await expect(budgetBox(page)).toHaveValue("40");
});

test("mode: a run opened elsewhere while the budget box is up — อัตโนมัติ changes nothing and says why", async ({ page, context }) => {
  // tab A asks for the budget, still showing แบบสั่งทีละขั้น
  await page.goto(BOARD);
  await auto(page).click();
  await budgetBox(page).fill("30");
  // tab B opens a run first (budget 12)
  const other = await context.newPage();
  await other.goto(BOARD);
  await auto(other).click();
  await budgetBox(other).fill("12");
  await submitBudget(other);
  await expect(other.locator('[data-run-state="open"]')).toHaveText(runRunning);
  const line = await budgetLine(other);
  await other.goto(`${BOARD}/runs`);
  const runs = await other.locator("[data-run]").count();
  // tab A sends its 30: refused in words; the run, the mode and the budget are tab B's, untouched
  await submitBudget(page);
  await expect(page.getByRole("alert").filter({ hasText: runStillOpen })).toBeVisible(); // (Next's route announcer is a 2nd alert)
  await expect(page.locator("header").first()).toContainText(line);
  await expect(auto(page)).toHaveAttribute("aria-checked", "true");
  await other.goto(`${BOARD}/runs`);
  await expect(other.locator("[data-run]")).toHaveCount(runs);
});

test("mode: back to แบบสั่งทีละขั้น ends the open run — it reads คุณสั่งหยุด, nothing reads กำลังรัน", async ({ page }) => {
  await page.goto(BOARD);
  await auto(page).click();
  await submitBudget(page);
  await expect(page.locator('[data-run-state="open"]')).toBeVisible();
  await manual(page).click();
  await expect(manual(page)).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-run-state="open"]')).toHaveCount(0);
  await page.goto(`${BOARD}/runs`);
  await expect(page.locator("[data-run]").first().locator("[data-stop]")).toHaveText(stopReason.operator_stopped);
});

// D-052 (TASK-B-047 Q4, built in TASK-B-049): อัตโนมัติ whose run ended by itself — the project is still on อัตโนมัติ, nothing is running.
// Only the runner ends a run this way, so the mock's seed has a variant for it (POST /test-reset?state=dispatcher-stopped).
test.describe("D-052: a run that ended by itself", () => {
  test.use({ seedState: "dispatcher-stopped" });

  test("the header says why it stopped and offers อัตโนมัติ again; nothing reads กำลังรัน; the button opens the budget box at the project's budget", async ({ page }) => {
    await page.goto(BOARD);
    const header = page.locator("header").first();
    await expect(page.locator('[data-run-state="stopped"]')).toHaveText(new RegExp(runStopped(stopReason.budget_spent).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(header).toContainText(runStopped(stopReason.budget_spent));
    await expect(header).not.toContainText(runRunning);
    await expect(page.locator('[data-run-state="open"]')).toHaveCount(0);
    await expect(auto(page)).toHaveAttribute("aria-checked", "true"); // the mode is still อัตโนมัติ
    await page.locator('[data-run-state="stopped"]').getByRole("button", { name: mode.dispatcher }).click();
    await expect(budgetBox(page)).toHaveValue("40");
  });
});

// D-056 (TASK-B-055, TEST-B-003 DEF-3): an open run can be stopped from the header — หยุดการรันนี้. It closes the run (คุณสั่งหยุด), leaves
// the mode on อัตโนมัติ (so D-052's stopped line takes over), and อัตโนมัติ then opens the budget box — no DEF-2 refusal.
// The run is opened through the screen (อัตโนมัติ + budget), not a seed state.
test("mode: หยุดการรันนี้ stops the open run — the stopped line with คุณสั่งหยุด, no กำลังรัน, mode still อัตโนมัติ, and อัตโนมัติ works again", async ({ page }) => {
  const { stopThisRun } = await import("../src/words");
  await page.goto(BOARD);
  await auto(page).click();
  await submitBudget(page);
  await expect(page.locator('[data-run-state="open"]')).toHaveText(runRunning);
  const stop = page.getByRole("button", { name: stopThisRun });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.locator('[data-run-state="stopped"]')).toContainText(runStopped(stopReason.operator_stopped));
  await expect(page.locator('[data-run-state="open"]')).toHaveCount(0);
  await expect(page.locator("header").first()).not.toContainText(runRunning);
  await expect(auto(page)).toHaveAttribute("aria-checked", "true"); // the mode is not changed by stopping
  await page.locator('[data-run-state="stopped"]').getByRole("button", { name: mode.dispatcher }).click();
  await expect(budgetBox(page)).toBeVisible();
  await page.locator(".ant-popover:visible").getByRole("button", { name: mode.dispatcher }).click(); // the box's own button, not the stopped line's
  await expect(page.getByRole("alert").filter({ hasText: runStillOpen })).toHaveCount(0); // no DEF-2 refusal: the run was closed
  await expect(page.locator('[data-run-state="open"]')).toHaveText(runRunning);
});

// D-056 re-check (TASK-B-056, TEST-C-003 § REQ-011 DEF-3): a run can be open while the project is on แบบสั่งทีละขั้น (the runner opened it;
// the screen cannot), so the mock's seed has a variant for it. กำลังรัน + หยุดการรันนี้ show whatever the mode; stopping never changes the mode.
test.describe("D-056: an open run in แบบสั่งทีละขั้น", () => {
  test.use({ seedState: "manual-open-run" });

  test("กำลังรัน + หยุดการรันนี้ show; pressing stops the run and the mode stays แบบสั่งทีละขั้น; อัตโนมัติ then opens the budget box with no refusal", async ({ page }) => {
    const { stopThisRun } = await import("../src/words");
    const manual = page.locator("[data-mode-control]").getByRole("radio", { name: mode.manual }); // TASK-B-085
    await page.goto(BOARD);
    await expect(manual).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-run-state="open"]')).toHaveText(runRunning);
    await page.getByRole("button", { name: stopThisRun }).click();
    await expect(page.locator('[data-run-state="open"]')).toHaveCount(0);
    await expect(page.locator("header").first()).not.toContainText(runRunning);
    await expect(manual).toHaveAttribute("aria-checked", "true"); // the mode is not changed by stopping
    await auto(page).click();
    await expect(budgetBox(page)).toBeVisible();
    await page.locator(".ant-popover:visible").getByRole("button", { name: mode.dispatcher }).click();
    await expect(page.getByRole("alert").filter({ hasText: runStillOpen })).toHaveCount(0); // the run was closed: no DEF-2 refusal
    await expect(page.locator('[data-run-state="open"]')).toHaveText(runRunning);
  });
});
