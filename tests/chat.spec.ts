// แชต (TASK-B-050 DoD 1, REQ-013): post a message · the seeded proposal shows its estimate · สร้างการ์ด makes the cards (with their
// dependencies) on the board · a superseded proposal has no button · a proposal whose part has left Blueprint is refused in words.
// Seed (fixtures.ts reset): M1 → reply M2 (a question + proposal Q2 open, 3 items, 6 hops; Q1 superseded) · M3 → reply M4 (Q3, gone anchor).
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { agreeStart, chat as words, chatRefused, codeMapWords, dependsOnHeading, distill, oneAnswer, partKind, proposedAnswer, section, send, teamDown, uncovered } from "../src/words";

const CHAT = `/p/${MOCK_PROJECT_ID}/chat`;

test("chat: the header links to แชต; the thread shows the worker's question like Blueprint's question card", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByRole("navigation", { name: section.board }).getByRole("link", { name: section.chat }).click(); // the tab, not the board's ไปที่แชต (TASK-B-098)
  await expect(page).toHaveURL(CHAT);
  await expect(page.locator("[data-message]")).toHaveCount(4);
  const q = page.locator("[data-question]").first();
  await expect(q).toContainText("ผู้ขอจองต้องได้รับแจ้งผลทางไหน");
  await expect(q).toContainText(oneAnswer.answered(null).split(" ·")[0]!); // D-105 P1 (TASK-B-119): a question already answered reads ตอบแล้ว, not its proposed answer
});

test("chat: a message posted appears in the thread, as the operator's", async ({ page }) => {
  await page.goto(CHAT);
  const text = `ทดสอบส่งข้อความ ${Date.now()}`;
  await page.getByLabel(distill.placeholder("ปลา")) /* C-1 (TASK-B-100): the box names the plain seed's entry person */.fill(text);
  await page.getByRole("button", { name: send }).click();
  await expect(page.locator('[data-message="operator"]').filter({ hasText: text })).toHaveCount(1);
  await expect(page.getByLabel(distill.placeholder("ปลา")) /* C-1 (TASK-B-100): the box names the plain seed's entry person */).toHaveValue("");
});

test("chat: the open proposal shows its estimate; a superseded one reads as old and has no button", async ({ page }) => {
  await page.goto(CHAT);
  const open = page.locator('[data-proposal="open"]').first();
  await expect(open).toContainText(words.estimate(3, 6));
  await expect(open.locator("[data-create]")).toHaveText(agreeStart.agree); // D-105 P2 (TASK-B-120): สร้างการ์ด became ตกลง เริ่มงาน
  const old = page.locator('[data-proposal="superseded"]');
  await expect(old).toHaveCount(1);
  await expect(old).toContainText(words.superseded);
  await expect(old.locator("[data-create]")).toHaveCount(0);
});

test("chat: สร้างการ์ด makes the proposal's cards — on the board, with their dependencies", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  const before = await page.locator("[data-column] [data-card]").count();
  await page.goto(CHAT);
  await page.locator('[data-proposal="open"]').first().locator("[data-create]").click();
  await expect(page.locator('[data-proposal="accepted"]')).toContainText(words.accepted);
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await expect(page.locator("[data-column] [data-card]")).toHaveCount(before + 3);
  await page.locator("[data-card]").filter({ hasText: "ทำหน้าอนุมัติคำขอ (แจ้งผล)" }).click();
  await expect(page.getByRole("heading", { name: dependsOnHeading })).toBeVisible();
  await expect(page.locator(`a[href*="/c/"]`).filter({ hasText: "ทำ API แจ้งผลการจอง" })).toHaveCount(1);
});

test("chat: a proposal whose part has left Blueprint is refused in words, and nothing is made", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  const before = await page.locator("[data-column] [data-card]").count();
  await page.goto(CHAT);
  const gone = page.locator('[data-proposal="open"]').filter({ hasText: "ทำหน้าสรุปรายงานรายวัน" });
  await gone.locator("[data-create]").click();
  await expect(gone.getByRole("alert")).toHaveText(chatRefused.anchor_not_in_version!);
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await expect(page.locator("[data-column] [data-card]")).toHaveCount(before);
});

test("chat: the reply that sent a missing part to Blueprint says so, with a link to Blueprint's chat (the only one that did)", async ({ page }) => {
  await page.goto(CHAT);
  const amendment = page.locator("[data-amendment]");
  await expect(amendment).toHaveCount(1);
  await expect(amendment).toContainText(words.notInSpec);
  await expect(amendment.locator("a")).toHaveAttribute("href", "http://127.0.0.1:3100/p/11111111-2222-4333-8444-555555555555/chat");
  await expect(page.locator("[data-message]").filter({ has: amendment })).toHaveAttribute("data-message", /worker/); // on a worker's message
});

test("chat: a proposed item shows its spec part's kind word and name (read by key, v1.7); a part Blueprint no longer has shows its bare key", async ({ page }) => {
  await page.goto(CHAT);
  const open = page.locator('[data-proposal="open"]').filter({ hasText: words.estimate(3, 6) });
  await expect(open).toContainText(partKind.screen!); // SCR-003 — หน้าจอ · หน้าอนุมัติคำขอ
  await expect(open).toContainText("หน้าอนุมัติคำขอ");
  await expect(open).toContainText("อนุมัติการจอง"); // API-003's name
  await expect(open).not.toContainText("SCR-003");
  const gone = page.locator('[data-proposal="open"]').filter({ hasText: "ทำหน้าสรุปรายงานรายวัน" });
  await expect(gone).toContainText("STEP-099");
});

// TASK-B-054: the spec-part kind word never breaks inside the word — at 390 `การตัดสินใจ` (item 3 of the open proposal, ตรวจการแจ้งผล on
// DEC-001, whose long name forces the line to wrap) was drawn as การตัดสิน / ใจ (B-053's shot). The name may wrap; the kind word may not.
test("chat @390: a proposed item's kind word stays on one line (การตัดสินใจ, item 3) — the name is what wraps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CHAT);
  const open = page.locator('[data-proposal="open"]').filter({ hasText: words.estimate(3, 6) });
  const kind = open.locator("li").filter({ hasText: "ตรวจการแจ้งผล" }).getByText(partKind.decision!, { exact: true });
  await expect(kind).toBeVisible();
  expect(await kind.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; }), "lines the kind word is drawn on").toBe(1);
});

// D-057 (TASK-B-058, TEST-C-003 DEF-1): an operator message whose chat step ended `failed` (and no retry asked) shows ทีมยังตอบข้อความนี้ไม่ได้
// and ลองอีกครั้ง; pressing asks for a retry and both go. Seed `chat-failed` (TASK-B-057): M3's step failed, M4 is gone, so M3 is the last message.
test.describe("D-057: a chat step that failed", () => {
  test.use({ seedState: "chat-failed" });

  test("the line + ลองอีกครั้ง sit under M3 only; pressing removes both, with no alert", async ({ page }) => {
    await page.goto(CHAT);
    const failed = page.locator("[data-chat-failed]");
    await expect(failed).toHaveCount(1);
    await expect(failed).toContainText(words.failed);
    const m3 = page.locator('[data-message="operator"]').last();
    await expect(m3.locator("[data-chat-failed]")).toHaveCount(1);
    await expect(page.locator("[data-message]").last()).toHaveAttribute("data-message", "operator"); // M3 is the last message
    await m3.getByRole("button", { name: words.retry }).click();
    await expect(failed).toHaveCount(0);
    await expect(page.getByRole("button", { name: words.retry })).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: chatRefused.other! })).toHaveCount(0);
  });
});

test.describe("D-057: a chat step still running", () => {
  test.use({ seedState: "chat-running" });
  test("nothing extra while the step runs", async ({ page }) => {
    await page.goto(CHAT);
    await expect(page.locator("[data-message]").first()).toBeVisible();
    await expect(page.locator("[data-chat-failed]")).toHaveCount(0);
  });
});

test("D-057: the plain seed shows neither the line nor ลองอีกครั้ง", async ({ page }) => {
  await page.goto(CHAT);
  await expect(page.locator("[data-message]").first()).toBeVisible();
  await expect(page.locator("[data-chat-failed]")).toHaveCount(0);
  await expect(page.getByText(words.failed)).toHaveCount(0);
});

// TASK-B-100 C-1 / C-3 / C-4 (D-094): no sub-line and no Enter hint; questions without a frame; the box has only a top hairline, pinned to the bottom at 390
test("chat: one head line, no Enter hint; a question has no frame; the box has a top hairline only", async ({ page }) => {
  await page.goto(CHAT);
  await expect(page.locator("main")).not.toContainText("กด Enter เพื่อส่ง");
  await expect(page.locator("[data-chat-question]").first()).toHaveCSS("border-left-width", "0px");
  const form = page.locator("[data-composer]");
  await expect(form).toHaveCSS("border-left-width", "0px");
  await expect(form).toHaveCSS("border-top-width", "1px");
});
test("@390 chat: the box sits at the bottom of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CHAT);
  const box = (await page.locator("[data-composer]").boundingBox())!;
  expect(844 - (box.y + box.height)).toBeLessThanOrEqual(8);
  // (the page as a whole still scrolls by the sample-data bar's height: CawRoot's min-height is 100vh under that bar — on sample data only, outside TASK-B-100)
});

// D-095 (TASK-B-102, DEF-5): the แชต page follows the project without a reload — the reply shows within one poll, and a half-written draft stays
test("chat live: a reply arrives within 4 s without a reload; the box keeps its draft", async ({ page, request }) => {
  await page.goto(CHAT);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  const box = page.getByLabel(distill.placeholder("ปลา"));
  // the door answers the newest operator message only while it waits (409 otherwise): send one first, then start a draft
  const ask = `ถามสด ${Date.now()}`;
  await box.fill(ask);
  await page.getByRole("button", { name: send }).click();
  await expect(page.locator('[data-message="operator"]').filter({ hasText: ask })).toHaveCount(1);
  await box.fill("ร่างที่ยังไม่ส่ง");
  const reply = `คำตอบสด ${Date.now()}`;
  expect((await request.post(`/test-reset?reply=${encodeURIComponent(reply)}`)).status()).toBe(204); // B-101's door
  await expect(page.locator('[data-message="worker"]').filter({ hasText: reply })).toHaveCount(1, { timeout: 4_000 });
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1); // same document: no reload
  await expect(box).toHaveValue("ร่างที่ยังไม่ส่ง");
});

// REQ-015 R1 (TASK-B-104): with the team down the chat says so, the box still sends, and one line says the message waits
test.describe("the team is not running", () => {
  test.use({ seedState: "team-down" });
  test("chat: the line with the start command; the box still sends and says the message waits", async ({ page }) => {
    await page.goto(CHAT);
    await expect(page.locator("[data-team-down]")).toContainText(teamDown.line);
    await expect(page.locator("[data-team-down] [data-start-command]")).toHaveText("cd caw-back && bun run runner");
    await expect(page.locator("[data-team-waits]")).toHaveText(teamDown.waits);
    const text = `รอทีม ${Date.now()}`;
    await page.getByLabel(distill.placeholder("ปลา")).fill(text);
    await page.getByRole("button", { name: send }).click();
    await expect(page.locator('[data-message="operator"]').filter({ hasText: text })).toHaveCount(1);
  });
});

// REQ-015 R2 (TASK-B-106): the reply after the map was saved links to it while it is not confirmed
test.describe("the code map link", () => {
  test.use({ seedState: "code-map" });
  test("a reply after the map → ดูผังโค้ด under it, landing on ทีม #code-map", async ({ page, request }) => {
    await page.goto(CHAT);
    await expect(page.locator("[data-see-code-map]")).toHaveCount(0); // the seeded replies are older than the map
    const box = page.getByLabel(distill.placeholder("Paul"));
    await box.fill(`ผังโค้ด ${Date.now()}`);
    await page.getByRole("button", { name: send }).click();
    expect((await request.post(`/test-reset?reply=${encodeURIComponent("บันทึกผังโค้ดแล้ว")}`)).status()).toBe(204);
    const link = page.locator("[data-see-code-map]");
    await expect(link).toHaveText(codeMapWords.see, { timeout: 4_000 });
    await link.click();
    await expect(page).toHaveURL(/\/team#code-map$/);
    await expect(page.locator("#code-map")).toBeInViewport();
  });
});

// TASK-B-109 (REQ-015 AC-1): the same on the chat — the line and the waits line appear by themselves when the team stops
test("chat: the team stops while the chat is open → the line and the waits line appear within 4 s, no reload", async ({ page, request }) => {
  await page.goto(CHAT);
  await expect(page.locator("[data-team-down]")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  expect((await request.post("/test-reset?team=down")).status()).toBe(204);
  await expect(page.locator("[data-team-down]")).toContainText(teamDown.line, { timeout: 4_000 });
  await expect(page.locator("[data-team-waits]")).toHaveText(teamDown.waits);
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
});

// D-103 (TASK-B-114, REQ-015 AC-1): the แชต page shows กำลังตอบแชต while the entry worker answers — where the operator types
test("chat: no answering line when nobody is answering (plain seed)", async ({ page }) => {
  await page.goto(CHAT);
  await expect(page.locator("[data-answering]")).toHaveCount(0);
});
test.describe("the entry worker is answering", () => {
  test.use({ seedState: "chat-running" });
  test("chat: the line shows with the entry worker's face, name and กำลังตอบแชต, in a polite live region", async ({ page }) => {
    await page.goto(CHAT);
    const line = page.locator("[data-answering]");
    await expect(line).toContainText("กำลังตอบแชต");
    await expect(line.locator("svg[data-face]")).toHaveCount(1);
    await expect(page.locator("[aria-live=polite]").filter({ has: line })).toHaveCount(1);
  });
  // TASK-B-115: the reply door now ends the open chat hop it answers, so the line can be seen leaving — without a reload, within the 3-s poll
  test("chat: the line clears within 4 s of the reply, on the same page (no reload), and the reply is in the thread", async ({ page, request }) => {
    await page.goto(CHAT);
    await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
    await expect(page.locator("[data-answering]")).toHaveCount(1);
    const reply = `ตอบแล้ว ${Date.now()}`;
    expect((await request.post(`/test-reset?reply=${encodeURIComponent(reply)}`)).status()).toBe(204);
    await expect(page.locator("[data-answering]")).toHaveCount(0, { timeout: 4_000 });
    await expect(page.locator('[data-message="worker"]').filter({ hasText: reply })).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
  });
});

// D-105 P3 (TASK-B-118): the page scrolls (its bar at the window edge), the box is pinned at the bottom with send inside it, Enter / Shift+Enter / IME
test.describe("the chat page scrolls as a page; the box stays pinned", () => {
  test("the document scrolls, not the thread", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(CHAT);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight)).toBe(true);
    expect(await page.locator("[data-thread]").evaluate((e) => getComputedStyle(e).overflowY)).not.toMatch(/auto|scroll/);
  });
  test("scrolled to the top, the box is still inside the window", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(CHAT);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("[data-box]")).toBeInViewport({ ratio: 1 });
  });
  test("send sits inside the box", async ({ page }) => {
    await page.goto(CHAT);
    const box = (await page.locator("[data-box]").boundingBox())!, s = (await page.locator("[data-send]").boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(box.x); expect(s.y).toBeGreaterThanOrEqual(box.y);
    expect(s.x + s.width).toBeLessThanOrEqual(box.x + box.width); expect(s.y + s.height).toBeLessThanOrEqual(box.y + box.height);
  });
  test("Shift+Enter adds a line and sends nothing; Enter sends", async ({ page }) => {
    await page.goto(CHAT);
    const box = page.locator("[data-box] textarea"), before = await page.locator('[data-message="operator"]').count();
    await box.fill("บรรทัดแรก");
    await box.press("Shift+Enter");
    await box.pressSequentially("บรรทัดสอง");
    await expect(box).toHaveValue("บรรทัดแรก\nบรรทัดสอง");
    await expect(page.locator('[data-message="operator"]')).toHaveCount(before);
    await box.press("Enter");
    await expect(page.locator('[data-message="operator"]')).toHaveCount(before + 1);
    await expect(box).toHaveValue("");
  });
  test("Enter while an IME is composing (Thai input) sends nothing", async ({ page }) => {
    await page.goto(CHAT);
    const box = page.locator("[data-box] textarea"), before = await page.locator('[data-message="operator"]').count();
    await box.fill("กำลังพิมพ์");
    await box.evaluate((el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true })));
    await page.waitForTimeout(500);
    await expect(page.locator('[data-message="operator"]')).toHaveCount(before);
    await expect(box).toHaveValue("กำลังพิมพ์");
  });
  test("@390: no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CHAT);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});

// D-105 P1 (TASK-B-119): the chat's open question carries the board's pair
test.describe("one answer pair in the chat · entry-asked", () => {
  test.use({ seedState: "entry-asked" });
  test("the open question shows ตามนั้น (filled) and ตอบเอง…; ตอบเอง… focuses the empty box", async ({ page }) => {
    await page.goto(CHAT);
    const pair = page.locator("[data-chat-answer]").first();
    await expect(pair.locator("[data-accept]")).toHaveAttribute("data-variant", "default");
    await expect(pair.locator("[data-answer-own]")).toBeVisible();
    await pair.locator("[data-answer-own]").click();
    await expect(page.locator("[data-box] textarea")).toBeFocused();
  });
});

// D-105 P2 (TASK-B-120): สร้างการ์ด became ตกลง เริ่มงาน — off while a question is open (with its reason), and it says what happens in this mode
test.describe("agree and start · a question is open", () => {
  test.use({ seedState: "entry-asked" });
  test("ตกลง เริ่มงาน is off, and says why (read out through aria-describedby)", async ({ page }) => {
    await page.goto(CHAT);
    const agree = page.locator('[data-proposal="open"] [data-create]').last();
    await expect(agree).toHaveText(agreeStart.agree);
    await expect(agree).toBeDisabled();
    const why = page.locator('[data-proposal="open"] [data-agree-why]').last();
    await expect(why).toHaveText(agreeStart.answerFirst("ปลา"));
    expect(await agree.getAttribute("aria-describedby")).toBe(await why.getAttribute("id"));
  });
});
test.describe("agree and start · nothing open", () => {
  test("manual: the line says you press each step; ตกลง เริ่มงาน is on and puts the cards on the board", async ({ page }) => {
    await page.goto(CHAT);
    const open = page.locator('[data-proposal="open"]').last();
    const n = await open.locator("ol > li").count();
    await expect(open.locator("[data-agree-what]")).toHaveText(agreeStart.manual(n));
    const agree = open.locator("[data-create]");
    await expect(agree).toBeEnabled();
    await expect(agree).toHaveAttribute("data-variant", "default");
    const before = await (async () => { await page.goto(`/p/${MOCK_PROJECT_ID}`); return page.locator("[data-column] [data-card]").count(); })();
    await page.goto(CHAT);
    // press the seed's 3-item proposal: the newest one is refused by the mock on purpose (a part the spec no longer has)
    const three = page.locator('[data-proposal="open"]').filter({ hasText: words.estimate(3, 6) });
    await three.locator("[data-create]").click();
    await expect(page.locator('[data-proposal="accepted"]').filter({ hasText: words.estimate(3, 6) })).toBeVisible();
    await page.goto(`/p/${MOCK_PROJECT_ID}`);
    await expect(page.locator("[data-column] [data-card]")).toHaveCount(before + 3);
  });
  test("อัตโนมัติ: the line says the team starts the cards itself", async ({ page }) => {
    await page.goto(`/p/${MOCK_PROJECT_ID}`);
    await page.locator("[data-mode-control]").getByRole("radio", { name: "อัตโนมัติ" }).click();
    await page.locator("[data-budget-ask] form button[type=submit]").click();
    await expect(page.locator('[data-run-state="open"]')).toBeVisible();
    await page.goto(CHAT);
    const open = page.locator('[data-proposal="open"]').last();
    await expect(open.locator("[data-agree-what]")).toHaveText(agreeStart.dispatcher(await open.locator("ol > li").count()));
  });
});

test("REQ-112: an open proposal that leaves a spec part without a card says so before สร้างการ์ด; one that covers it does not; advisory only", async ({ page }) => {
  await page.goto(CHAT);
  const left = page.locator('[data-proposal="open"]').filter({ hasText: "ทำหน้าสรุปรายงานรายวัน" }); // no item on SCR-003
  await expect(left.locator("[data-uncovered-part=SCR-003]")).toHaveText(uncovered.part("SCR-003 หน้าอนุมัติคำขอ"));
  await expect(left.locator("[data-create]")).toBeEnabled();
  const covered = page.locator('[data-proposal="open"]').filter({ hasText: "ทำ API แจ้งผลการจอง" }); // has an item on SCR-003
  await expect(covered).toHaveCount(1);
  await expect(covered.locator("[data-uncovered]")).toHaveCount(0);
  await expect(page.locator('[data-proposal="superseded"] [data-uncovered]')).toHaveCount(0); // only an open proposal
});
