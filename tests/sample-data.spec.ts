// D-058 (TASK-B-059): on sample data (CAW_API=mock — what every e2e runs on) every page says so, once: ข้อมูลตัวอย่าง — ไม่ได้ต่อกับ CAW จริง.
// /start with a Blueprint project the mock cannot know says that sentence instead of ไม่พบโปรเจกต์นี้ใน Blueprint. (On http there is no mark —
// shown by the desk's http probe, tests/harness/caw/out/<date>-b059/, since this suite runs on the mock.)
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { sampleData, sampleDataHint, startRefused } from "../src/words";

const P = `/p/${MOCK_PROJECT_ID}`;

test("the mark is on every page, exactly once", async ({ page }) => {
  await page.goto(P);
  const card = await page.locator('a[href*="/c/"]').first().getAttribute("href");
  for (const url of ["/", "/start?project=nope&version=1", P, card!, `${P}/team`, `${P}/runs`, `${P}/chat`]) {
    await page.goto(url);
    await expect(page.locator("[data-sample-data]"), url).toHaveCount(1);
    await expect(page.locator("[data-sample-data]"), url).toContainText(sampleData);
    // B-060: the hint follows the mark, its command set as code — something to type
    await expect(page.locator("[data-sample-data]"), url).toContainText(sampleDataHint);
    await expect(page.locator("[data-sample-data] code"), url).toHaveText("bun run dev"); // TASK-B-095: D-089
  }
});

test("the mark stays in view when the page scrolls", async ({ page }) => {
  await page.goto(P);
  await page.mouse.wheel(0, 2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("[data-sample-data]")).toBeInViewport();
});

test("/start with a Blueprint project the mock cannot know says the mark sentence, not ไม่พบโปรเจกต์นี้ใน Blueprint", async ({ page }) => {
  await page.goto("/start?project=nope&version=1");
  await expect(page.getByRole("alert").filter({ hasText: sampleData })).toHaveCount(1); // (Next's route announcer is a 2nd alert)
  await expect(page.getByText(startRefused.blueprint_project_not_found)).toHaveCount(0);
});

test("/start's other refusals are unchanged", async ({ page }) => {
  await page.goto("/start?version=3"); // REQ-105: no project = incomplete (a missing version no longer is)
  await expect(page.getByRole("alert").filter({ hasText: startRefused.incomplete })).toHaveCount(1);
});
