// The runs screen (TASK-B-043, REQ-011 R6, AC-7) on the mock: two finished runs with hops and their cost, the manual hops as a group,
// the stop reasons in words, and a run that is still going. The last test switches the mode (which opens a run) and switches back.
import { expect, test } from "./fixtures";
import { createMockApi, MOCK_PROJECT_ID } from "../src/api/mock";
import { budget, mode, runRunning, section, stopReason } from "../src/words";

const RUNS = `/p/${MOCK_PROJECT_ID}/runs`;
const RUN_1 = "50000000-0000-4000-8000-000000000001", RUN_2 = "50000000-0000-4000-8000-000000000002";

test("runs: newest first, the first one open; each run's stop reason, budget and cost in words", async ({ page }) => {
  await page.goto(RUNS);
  await expect(page.getByRole("heading", { level: 2, name: section.runs })).toBeVisible();
  const runs = page.locator("[data-run]");
  expect(await runs.evaluateAll((rs) => rs.map((r) => r.getAttribute("data-run")))).toEqual([RUN_1, RUN_2]);
  expect(await runs.evaluateAll((rs) => rs.map((r) => (r as HTMLDetailsElement).open))).toEqual([true, false]);

  const one = page.locator(`[data-run="${RUN_1}"]`), two = page.locator(`[data-run="${RUN_2}"]`);
  await expect(one.locator("[data-stop]")).toHaveText(stopReason.budget_spent);
  await expect(two.locator("[data-stop]")).toHaveText(stopReason.nothing_workable);
  await expect(one).toContainText(budget(3, 3));
  await expect(one).toContainText("3 ก้าว");
  await expect(one).toContainText("1 นาที 59 วินาที");      // 38 s + 52 s + 29 s
  await expect(one).toContainText("13,600 โทเค็น");          // (3100+1100) + (4500+1600) + (2400+900)
  await expect(one.locator("[data-hop]")).toHaveCount(3);
  await expect(one).toContainText("ทำครบ 3 ก้าว: ปิดขั้นแรก");   // the run's report
  await expect(one).toContainText("ตัดการ์ดจาก spec และปิดขั้นแรก"); // a hop's note
});

test("runs: another run opens on its summary and shows its hops and cost", async ({ page }) => {
  await page.goto(RUNS);
  const two = page.locator(`[data-run="${RUN_2}"]`);
  await two.locator("summary").click();
  await expect(two.locator("[data-hop]")).toHaveCount(2);
  await expect(two).toContainText("2 ก้าว");
  await expect(two).toContainText("1 นาที 31 วินาที");      // 50 s + 41 s
  await expect(two).toContainText("8,600 โทเค็น");           // (2600+800) + (3900+1300)
  await two.locator("summary").press("Enter");               // the keyboard closes it again
  expect(await two.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(false);
});

test("runs: the manual hops are their own group, and a hop links to its card", async ({ page }) => {
  await page.goto(RUNS);
  const manual = page.locator("[data-manual]");
  await expect(manual.getByRole("heading", { level: 3, name: mode.manual })).toBeVisible();
  await expect(manual.locator("[data-hop]")).toHaveCount(2); // the old finished one and the one running now (ฝน, TASK-B-073 C5)
  await manual.locator("a").first().click();
  await expect(page).toHaveURL(new RegExp(`/p/${MOCK_PROJECT_ID}/c/[0-9a-f-]{36}$`));
});

test("the project header links the board and the runs; the current one is marked", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  const nav = page.locator("header nav");
  await expect(nav.getByRole("link", { name: section.board })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: section.runs })).not.toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: section.runs }).click();
  await expect(page).toHaveURL(RUNS);
  await expect(nav.getByRole("link", { name: section.runs })).toHaveAttribute("aria-current", "page");
});

for (const [vw, vh] of [[1440, 900], [390, 844]] as const) {
  test(`@${vw}: the runs page does not scroll sideways, with every run open`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto(RUNS);
    await page.locator(`[data-run="${RUN_2}"] summary`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("a run that is still going reads กำลังรัน — switching to อัตโนมัติ opens one; switching back keeps it on screen", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByText(mode.dispatcher, { exact: true }).first().click();
  await page.locator(".ant-popover form button[type=submit]").click(); // the budget question's submit (scoped: the board also has the chat box's submit, TASK-B-064) — it starts at the project's budget (D-051)
  const seeded = (await createMockApi().project(MOCK_PROJECT_ID))!.hopBudget; // read from the seed, not a number (TASK-B-047 Q2)
  await expect(page.locator("header")).toContainText(budget(seeded, 0)); // A4 (TASK-B-074): the open run's own budget, not the project's total
  await page.goto(RUNS);
  const runs = page.locator("[data-run]");
  await expect(runs).toHaveCount(3);
  const newest = runs.first();
  await expect(newest.locator("summary")).toContainText(runRunning);
  await expect(newest.locator("[data-stop]")).toHaveCount(0);
  await expect(newest).toContainText(budget(seeded, 0));
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByText(mode.manual, { exact: true }).first().click();
  await expect(page.locator("header")).not.toContainText("ใช้ไป"); // A4: no run open → no budget line
});

// The desk's floors (REQ-011 AC-8, TASK-B-046): no text under 14 px, no target under 44 px tall — on the whole runs page, every run open.
for (const [vw, vh] of [[1440, 900], [390, 844]] as const) {
  test(`@${vw}: the runs page has no text under 14 px and no target under 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto(RUNS);
    await page.locator(`[data-run="${RUN_2}"] summary`).click();
    const found = await page.evaluate(() => {
      const small: string[] = [], short: string[] = [];
      const visible = (e: Element) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
      for (const e of document.body.querySelectorAll("*")) {
        if (!visible(e)) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (own && parseFloat(getComputedStyle(e).fontSize) < 14) small.push(`${e.tagName.toLowerCase()} "${(e.textContent ?? "").trim().slice(0, 20)}" ${getComputedStyle(e).fontSize}`);
      }
      // a target = a link, button or summary a person can press; Ant's hidden radio inside its segmented control is not one (its 44 px label is)
      for (const e of document.body.querySelectorAll("a[href], button, summary")) {
        if (!visible(e)) continue;
        const h = e.getBoundingClientRect().height;
        if (h < 44) short.push(`${e.tagName.toLowerCase()} "${(e.textContent ?? "").trim().slice(0, 20)}" ${Math.round(h)} px`);
      }
      return { small, short };
    });
    expect.soft(found.small, "text under 14 px").toEqual([]);
    expect(found.short, "targets under 44 px tall").toEqual([]);
  });
}
