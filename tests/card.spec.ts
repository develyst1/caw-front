// The card screen (TASK-B-041 DoD 1): a board card opens it, the spec section comes before the timeline, the Blueprint link
// carries the part key, the timeline reads comments and hand-offs; a comment appears, a status change moves the card on the
// board, re-assign shows the new worker, answering the question card takes it out of the strip. Each test starts from the mock's
// seed (tests/fixtures.ts), so none has to put anything back.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { acceptAnswer, assigneeLabel, card as cardWord, cardMark, column, commentPlaceholder, distill, linkedWith, section, send, statusLabel, timelineHeading, toSpec } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;

test("card: opens from the board; the spec section comes first, above the timeline", async ({ page }) => {
  await page.goto(BOARD);
  const first = page.locator('[data-column="review"] [data-card]').first(); // card 6: has notes, a hand-off and a spec part
  const title = (await first.locator("h3").textContent())!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/p/${MOCK_PROJECT_ID}/c/`));
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  const where = page.getByRole("heading", { level: 3, name: cardWord.whereInSpec });
  const timeline = page.getByRole("heading", { level: 3, name: timelineHeading });
  await expect(where).toBeVisible();
  await expect(timeline).toBeVisible();
  const order = await page.evaluate(([a, b]) => {
    const h = [...document.querySelectorAll("main h3, h3")];
    return h.findIndex((x) => x.textContent === a) < h.findIndex((x) => x.textContent === b);
  }, [cardWord.whereInSpec, timelineHeading]);
  expect(order, "อยู่ตรงไหนใน spec is read before the timeline").toBe(true);
  await expect(page.getByRole("heading", { name: linkedWith })).toBeVisible();
});

test("card: the Blueprint link carries the part's key; the timeline shows a comment and a hand-off", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('[data-column="review"] [data-card]').first().click();
  const link = page.getByRole("link", { name: toSpec });
  const href = (await link.getAttribute("href"))!;
  expect(new URL(href).searchParams.get("part")).toBe("API-003");
  await expect(page.locator('[data-note="comment"]')).toHaveCount(2);
  await expect(page.locator('[data-note="handoff"]')).toHaveCount(1);
  await expect(page.locator('[data-note="handoff"]')).toContainText("ส่งต่อ");
});

test("card: a depends-on card is a link to that card", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('[data-column="stuck"] [data-card]').first().click(); // card 12 waits on the question card
  const dep = page.locator(`a[href*="/c/"]`).filter({ hasText: "ผู้ดูแลไม่ตอบใน 24 ชม." });
  await expect(dep).toHaveCount(1);
  await dep.click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("ผู้ดูแลไม่ตอบใน 24 ชม.");
});

const openCard = async (page: import("@playwright/test").Page, col: string) => {
  await page.goto(BOARD);
  const card = page.locator(`[data-column="${col}"] [data-card]`).first();
  const id = (await card.getAttribute("data-card"))!;
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/c/${id}$`));
  return id;
};
const pick = async (page: import("@playwright/test").Page, label: string, option: string) => {
  await page.getByLabel(label).click();
  await page.getByRole("option") /* TASK-B-088: Radix Select */.filter({ hasText: option }).click();
};

test("card: a comment appears in the timeline", async ({ page }) => {
  await openCard(page, "todo");
  const text = `ความเห็นจากการทดสอบ ${Date.now()}`;
  await page.getByLabel(commentPlaceholder).fill(text);
  await page.getByRole("button", { name: send }).click();
  await expect(page.locator('[data-note="comment"]').filter({ hasText: text })).toHaveCount(1);
});

test("card: a status change moves the card on the board (then back)", async ({ page }) => {
  const id = await openCard(page, "review");
  await pick(page, statusLabel, column.done);
  await expect(page.locator('[data-control="status"]')).toContainText(column.done);
  await page.goto(BOARD);
  await expect(page.locator(`[data-column="done"] [data-card="${id}"]`)).toHaveCount(1);
  await page.goto(`${BOARD}/c/${id}`);
  await pick(page, statusLabel, column.review); // put back: the specs after this one count the board
  await page.goto(BOARD);
  await expect(page.locator(`[data-column="review"] [data-card="${id}"]`)).toHaveCount(1);
});

test("card: re-assign shows the new worker (then back)", async ({ page }) => {
  await openCard(page, "todo"); // card 1, ฝน
  // every test starts from the seed (fixtures.ts): card 1 is ฝน's; แบงค์ is another chain member. Named, not read from the open
  // dropdown — reading its options raced its rendering (red 1 run in 2)
  const before = "ฝน", other = "แบงค์";
  await expect(page.locator('[data-control="assignee"]')).toContainText(before);
  await pick(page, assigneeLabel, other);
  await expect(page.locator('[data-control="assignee"]')).toContainText(other);
  await expect(page.locator("main header")).toContainText(other);
  await pick(page, assigneeLabel, before); // put back
  await expect(page.locator('[data-control="assignee"]')).toContainText(before);
});

test("card: กำลังทำ is off while a card it depends on is open, and says why", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('[data-column="stuck"] [data-card]').first().click(); // card 12 waits on the open question
  await page.getByLabel(statusLabel).click();
  const doing = page.getByRole("option") /* TASK-B-088: Radix Select */.filter({ hasText: column.doing });
  await expect(doing).toHaveAttribute("data-disabled", "");
  await page.keyboard.press("Escape");
  expect(await page.getByLabel(statusLabel).getAttribute("aria-describedby")).toBe("deps");
});

test("card: answering the question card (ตามนั้น) takes it out of the strip and clears รอคำตอบ on the cards waiting for it", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-question]")).toHaveCount(1);
  expect(await page.locator("[data-column] [data-card]").filter({ hasText: cardMark.waitingAnswer }).count(), "a card waits for the answer").toBeGreaterThan(0);
  await page.locator("[data-question]").click();
  await page.getByRole("button", { name: acceptAnswer }).click();
  await expect(page.locator("[data-answer]")).not.toBeEmpty();
  await page.goto(BOARD);
  await expect(page.locator("[data-question]")).toHaveCount(0);
  await expect(page.locator("[data-column] [data-card]").filter({ hasText: cardMark.waitingAnswer })).toHaveCount(0);
});

// TASK-B-048 (v1.3, D-051): a hand-off the chain refused is in the timeline, in REQ-011's words and in time order — the seed has
// มิ้นท์ → ฝน refused on card 6 (09:20), between the bank → มิ้นท์ hand-off (09:12) and the operator's comment (09:30)
test("card: a refused hand-off reads ส่งต่อไม่ได้: {who} ไม่ได้อยู่ต่อจาก {from} ในสายงาน, in order with the rest", async ({ page }) => {
  const { refusedHandoff } = await import("../src/words");
  await page.goto(BOARD);
  await page.locator('[data-column="review"] [data-card]').first().click(); // card 6
  const refused = page.locator('[data-note="handoff_refused"]');
  await expect(refused).toHaveCount(1);
  await expect(refused).toContainText(refusedHandoff("ฝน", "มิ้นท์"));
  const order = await page.locator("[data-note]").evaluateAll((ns) => ns.map((n) => n.getAttribute("data-note")));
  expect(order).toEqual(["comment", "handoff", "handoff_refused", "comment"]);
});

// TASK-B-100 K-1 / K-2 / K-4 (D-094): no back link (the บอร์ด tab is current), direction B frames, ตอบ on the own answer
test("card on direction B: the บอร์ด tab is current, no back link; title 600; hairline frames, no shadow", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator("[data-column] [data-card]").first().click();
  await expect(page.locator("nav a[aria-current=page]")).toHaveText(section.board);
  await expect(page.locator(`main a[href="${BOARD}"]`)).toHaveCount(0);
  await expect(page.locator("main h2").first()).toHaveCSS("font-weight", "600");
  const spec = page.locator("section[aria-labelledby=where]");
  await expect(spec).toHaveCSS("border-top-width", "1px");
  await expect(spec).toHaveCSS("box-shadow", "none");
});
test("a question card's own answer is sent with ตอบ — not the comment box's ส่ง (K-4)", async ({ page }) => {
  await page.goto(BOARD);
  await page.locator('[data-ask="card"] [data-question]').first().click();
  await expect(page.getByRole("button", { name: distill.answer, exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: send, exact: true })).toHaveCount(1); // the comment box's
});
