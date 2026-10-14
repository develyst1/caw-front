// แชต (TASK-B-050 DoD 1, REQ-013): post a message · the seeded proposal shows its estimate · สร้างการ์ด makes the cards (with their
// dependencies) on the board · a superseded proposal has no button · a proposal whose part has left Blueprint is refused in words.
// Seed (fixtures.ts reset): M1 → reply M2 (a question + proposal Q2 open, 3 items, 6 hops; Q1 superseded) · M3 → reply M4 (Q3, gone anchor).
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { chat as words, chatRefused, dependsOnHeading, partKind, proposedAnswer, section, send } from "../src/words";

const CHAT = `/p/${MOCK_PROJECT_ID}/chat`;

test("chat: the header links to แชต; the thread shows the worker's question like Blueprint's question card", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByRole("link", { name: section.chat }).click();
  await expect(page).toHaveURL(CHAT);
  await expect(page.locator("[data-message]")).toHaveCount(4);
  const q = page.locator("[data-question]").first();
  await expect(q).toContainText("ผู้ขอจองต้องได้รับแจ้งผลทางไหน");
  await expect(q).toContainText(proposedAnswer);
});

test("chat: a message posted appears in the thread, as the operator's", async ({ page }) => {
  await page.goto(CHAT);
  const text = `ทดสอบส่งข้อความ ${Date.now()}`;
  await page.getByLabel(words.placeholder).fill(text);
  await page.getByRole("button", { name: send }).click();
  await expect(page.locator('[data-message="operator"]').filter({ hasText: text })).toHaveCount(1);
  await expect(page.getByLabel(words.placeholder)).toHaveValue("");
});

test("chat: the open proposal shows its estimate; a superseded one reads as old and has no button", async ({ page }) => {
  await page.goto(CHAT);
  const open = page.locator('[data-proposal="open"]').first();
  await expect(open).toContainText(words.estimate(3, 6));
  await expect(open.locator("[data-create]")).toHaveText(words.createCards);
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
