// The board comp (TASK-B-039 DoD 3, REQ-011 AC-3 on the mock): every card in its place, the question card first, the filter
// narrows; plus the 390 sideways columns and the keyboard path.
import { expect, test } from "./fixtures";
import { MOCK_NEW_PROJECT_ID, MOCK_PROJECT_ID } from "../src/api/mock";
import { acceptAnswer, agreeStart, cardMark, column, distill, oneAnswer, section, teamDown, uncovered, reviewHold } from "../src/words";

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
  // D-105 P1 (TASK-B-119): ตอบเอง… opens the chat with an EMPTY box, focused — no longer the question as his draft
  test("ตอบเอง… on the chat question opens the chat with the box empty and focused", async ({ page }) => {
    await page.goto(BOARD);
    await page.locator('[data-ask="chat"] [data-answer-own]').click();
    const box = page.getByLabel(distill.placeholder("Paul")); // C-1 (TASK-B-100): the box names operator-like's entry person
    await expect(box).toHaveValue("");
    await expect(box).toBeFocused();
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

// REQ-015 R1 (TASK-B-104): the team is not running → one line with the start command the back end gives; it leaves by itself when the team checks in
test.describe("the team is not running", () => {
  test.use({ seedState: "team-down" });
  test("the board says so with the start command, and the line leaves within 4 s of the team coming up — no reload", async ({ page, request }) => {
    await page.goto(BOARD);
    const line = page.locator("[data-team-down]");
    await expect(line).toContainText(teamDown.line);
    await expect(line.locator("[data-start-command]")).toHaveText("cd caw-back && bun run runner"); // the mock's TeamStatus.startCommand
    await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
    expect((await request.post("/test-reset?team=up")).status()).toBe(204);
    await expect(line).toHaveCount(0, { timeout: 4_000 });
    expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
  });
});

// TASK-B-109 (REQ-015 AC-1): the team stopping while the board is open writes no event — LiveRefresh watches the team too, so the line appears by itself
test("the team stops while the board is open → the line appears within 4 s, no reload", async ({ page, request }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-team-down]")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  expect((await request.post("/test-reset?team=down")).status()).toBe(204);
  await expect(page.locator("[data-team-down]")).toContainText(teamDown.line, { timeout: 4_000 });
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
});

// D-105 P1 (TASK-B-119): one question, one way to answer — the board's ตามนั้น lands in the chat on his own message
test.describe("one answer pair · entry-asked", () => {
  test.use({ seedState: "entry-asked" });
  test("the board's ตามนั้น on Paul's question → the chat, at his message ข้อ 1: …, in view; the box empty", async ({ page }) => {
    await page.goto(BOARD);
    const sheet = page.locator('[data-ask="chat"]');
    const proposed = (await sheet.locator("b").first().textContent())!.trim();
    await sheet.locator("[data-accept]").click();
    await expect(page).toHaveURL(/\/chat#m-/);
    const id = new URL(page.url()).hash.slice(1);
    const mine = page.locator(`#${id}`);
    await expect(mine).toHaveAttribute("data-message", "operator");
    await expect(mine).toContainText(oneAnswer.line(1, proposed)); // REQ-126: the line form, was `ตามนั้น — …`
    await expect(mine).toBeInViewport();
    await expect(page.locator("[data-box] textarea")).toHaveValue("");
  });
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`@${w}: one filled button on the board and one in the chat`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(BOARD);
      await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1);
      await page.goto(`${BOARD}/chat`);
      await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1);
    });
  }
});
test.describe("one answer pair · two open questions", () => {
  test.use({ seedState: "entry-asked-two" });
  test("the board reads {entry} ถาม 2 ข้อ; ตามนั้นทุกข้อ posts ONE message with both lines", async ({ page }) => {
    await page.goto(BOARD);
    const all = page.locator("[data-ask-all]");
    await expect(all).toContainText(oneAnswer.asks("ปลา", 2));
    const answers = await page.locator('[data-ask="chat"] b').allTextContents();
    expect(answers).toHaveLength(2);
    await all.locator("[data-accept-all]").click();
    await expect(page).toHaveURL(/\/chat#m-/);
    const mine = page.locator(`#${new URL(page.url()).hash.slice(1)}`);
    await expect(mine.locator("p").last()).toHaveText(answers.map((a, i) => oneAnswer.line(i + 1, a.trim())).join("\n")); // REQ-126: `ข้อ n: …`, was `ตามนั้น — …`
  });
});

// D-105 P2 (TASK-B-120): while Paul's proposal waits for his agreement, the board says so — and each screen keeps one filled button
test("the board's line: {entry} เสนองานไว้ รอคุณตกลง → ไปที่แชต", async ({ page }) => {
  await page.goto(BOARD);
  const line = page.locator("[data-chat-waits]");
  await expect(line.locator("[data-chat-waits-line]")).toHaveText(agreeStart.waiting("ปลา"));
  await expect(line.getByRole("link")).toHaveAttribute("href", /\/chat$/);
});
for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  test(`@${w}: one filled button on the board and on the chat while the proposal waits`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BOARD);
    await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1);
    await page.goto(`${BOARD}/chat`);
    await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1);
  });
}

// D-105 (TASK-B-121, SPEC-B-005 Q-1): in แบบสั่งทีละขั้น each workable card gets ทำต่อ — it starts that card's step
test.describe("ทำต่อ · manual-idle", () => {
  test.use({ seedState: "manual-idle" });
  // the seed keeps the plain seed's open card question: while it is open its ตามนั้น holds the board's one filled button, and every ทำต่อ is outline
  const answerTheQuestion = async (page: import("@playwright/test").Page) => {
    await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-carry-on][data-variant="default"]')).toHaveCount(0);
    await page.locator('[data-ask="card"] [data-accept]').click();
    await expect(page.locator("[data-ask]")).toHaveCount(0);
  };
  test("each workable card shows ทำต่อ; with no question open exactly one is filled; pressing it starts the step: within 4 s, no reload, no ทำต่อ left and the worker's seat is working", async ({ page }) => {
    await page.goto(BOARD);
    const buttons = page.locator("[data-carry-on]");
    expect(await buttons.count()).toBeGreaterThan(0);
    await answerTheQuestion(page);
    await expect(page.locator('[data-carry-on][data-variant="default"]')).toHaveCount(1);
    const first = page.locator('[data-carry-on][data-variant="default"]');
    const who = (await first.locator("xpath=preceding-sibling::a[1]").locator("[data-name]").textContent())!.trim();
    await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
    await first.click();
    await expect(buttons).toHaveCount(0, { timeout: 4_000 });
    await expect(page.locator(`[data-seat="${who}"]`)).toHaveAttribute("data-state", "working");
    expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
  });
  test("keyboard: Tab from a card's link reaches its ทำต่อ, and Enter presses it", async ({ page }) => {
    await page.goto(BOARD);
    await answerTheQuestion(page);
    const first = page.locator('[data-carry-on][data-variant="default"]');
    await first.locator("xpath=preceding-sibling::a[1]").focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-carry-on]")).toHaveCount(0, { timeout: 4_000 });
  });
  test("อัตโนมัติ: no ทำต่อ (the team starts the cards itself)", async ({ page }) => {
    await page.goto(BOARD);
    await expect(page.locator("[data-carry-on]").first()).toBeVisible();
    await page.locator("[data-mode-control]").getByRole("radio", { name: "อัตโนมัติ" }).click();
    await page.locator("[data-budget-ask] form button[type=submit]").click();
    await expect(page.locator("[data-carry-on]")).toHaveCount(0);
  });
});
test("ทำต่อ · plain seed (a hop is running): no ทำต่อ", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-column] [data-card]").first()).toBeVisible();
  await expect(page.locator("[data-carry-on]")).toHaveCount(0);
});

// REQ-111 (TASK-120): the card whose last hop ended without finishing says so, on the board (one line, the whole sentence in its title) and on its card page (whole)
test("หยุดกลางทาง · the one seeded stopped card has the sentence on the board and on its page; no other card has it", async ({ page }) => {
  const sentence = cardMark.stoppedMidway("หมดเวลา — ก้าวนี้ใช้เวลานานเกินไป");
  expect(sentence).toBe("งานนี้หยุดกลางทาง: หมดเวลา — ก้าวนี้ใช้เวลานานเกินไป — รอทำต่อ");
  await page.goto(BOARD);
  await expect(page.locator("[data-column] [data-card]").first()).toBeVisible();
  await expect(page.locator("[data-stopped-midway]")).toHaveCount(1);
  const card = page.locator('[data-card="30000000-0000-4000-8000-000000000001"]');
  await expect(card.locator("[data-stopped-midway]")).toHaveText(sentence);
  await expect(card.locator("[data-stopped-midway]")).toHaveAttribute("title", sentence);
  await card.click();
  await expect(page.locator("[data-stopped-midway]")).toHaveText(sentence);
  await expect(page.locator("[data-stopped-midway]")).toHaveCount(1);
});

test("REQ-112: the board says which spec part no card has taken up, in the PM's sentence, with the key linked to Blueprint", async ({ page }) => {
  await page.goto(BOARD);
  const line = page.locator("[data-board] > [data-uncovered] [data-uncovered-part=SCR-003]");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(uncovered.part("SCR-003 หน้าอนุมัติคำขอ"));
  expect(await line.getByRole("link").getAttribute("href")).toContain("part=SCR-003");
  await expect(page.locator("[data-column] [data-card]")).toHaveCount(11); // advisory: the board itself is unchanged
});

test("REQ-117: no review holds work up on the default board → no รอคุณตรวจ line", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-review-hold]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("รอคุณตรวจ");
});

test.describe("a review holds work up (REQ-117 AC-2)", () => {
  test.use({ seedState: "review-holds" });
  test("the board says which review, and how many wait — the title as plain text", async ({ page }) => {
    await page.goto(BOARD);
    const title = "ออกแบบหน้าค้นหาห้อง"; // card 1, now in review
    const line = page.locator("[data-review-hold]");
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText(reviewHold.line(title, 2));
    await expect(line).toHaveAttribute("role", "status");
  });
});
