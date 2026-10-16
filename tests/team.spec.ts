// ทีม · สายงาน — REQ-011 R4 (TASK-B-042) rebuilt as REQ-014 comp 4 (TASK-B-065, comps B-068 4a / 4b): the chain is the editor (tap the out-dot,
// then ต่อที่นี่ on the receiver; tap a line to cut it, เลิกทำ puts it back), people cards lead with roles + duty lines, the side panel edits one
// person's roles (1+, incl. BA) and face, the add form picks roles and pre-fills skills; no รวมสองคน. Seed: ปลา PM · ฝน FE · แบงค์ BE · มิ้นท์ QA.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { faces, readiness, rolePicker, section, team as words, undo } from "../src/words";

const TEAM = `/p/${MOCK_PROJECT_ID}/team`;
const node = (page: Page, name: string) => page.locator("[data-node]").filter({ hasText: name });
const card = (page: Page, name: string) => page.locator("[data-worker]").filter({ hasText: name });
const edges = (page: Page) => page.locator("[data-edge]").evaluateAll((es) => es.map((e) => e.getAttribute("data-edge")));
const idOf = (page: Page, name: string) => node(page, name).getAttribute("data-node");

test("team: the header links to ทีม; the chain picture, the readiness panel and every person show; no รวมสองคน anywhere", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByRole("link", { name: section.team }).click();
  await expect(page).toHaveURL(TEAM);
  await expect(page.getByRole("heading", { level: 2, name: section.chain })).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(4);
  await expect(page.locator("[data-worker]")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: readiness.heading })).toBeVisible();
  await expect(page.getByText("รวมสองคน")).toHaveCount(0);
});

test("team: create a worker with FE + BE — both role tags show and the skills are the union, pre-filled", async ({ page }) => {
  await page.goto(TEAM);
  const form = page.locator("[data-add-worker]");
  await form.getByLabel(words.name).fill("ต้นกล้า");
  await form.getByRole("checkbox", { name: /^FE/ }).click();
  await form.getByRole("checkbox", { name: /^BE/ }).click();
  await expect(form.getByLabel(words.skills)).toHaveValue(/role-fe.*role-be|role-be.*role-fe/);
  await form.getByRole("button", { name: words.addWorker }).click();
  const w = card(page, "ต้นกล้า");
  await expect(w).toHaveCount(1);
  await expect(w.locator("[data-role]")).toHaveText(["FE", "+BE"]);
  await w.getByText(rolePicker.details).click();
  for (const k of ["role-fe", "role-be"]) await expect(w.locator("[data-skills]")).toContainText(k);
});

test("team: edit a person's roles in the side panel — saved (reload keeps it); the last role cannot be taken off", async ({ page }) => {
  await page.goto(TEAM);
  await card(page, "แบงค์").getByRole("button", { name: rolePicker.heading("แบงค์") }).click();
  const panel = page.locator("[data-side-panel]");
  await panel.getByRole("checkbox", { name: /^QA/ }).click();
  await expect(card(page, "แบงค์").locator("[data-role]")).toHaveText(["BE", "+QA"]);
  await page.reload();
  await expect(card(page, "แบงค์").locator("[data-role]")).toHaveText(["BE", "+QA"]);
  // QA is also a builder now: the readiness rule turns red, with the fix naming him — no submit needed
  await expect(page.locator('[data-check="qaNotBuilder"]')).toHaveAttribute("data-state", "bad");
  await expect(page.locator('[data-check="qaNotBuilder"]')).toContainText("แบงค์");
  await card(page, "แบงค์").getByRole("button", { name: rolePicker.heading("แบงค์") }).click();
  await panel.getByRole("checkbox", { name: /^QA/ }).click();
  await expect(panel.getByRole("checkbox", { name: /^BE/ })).toBeDisabled(); // the last one left
});

test("team: pick a face — body, colour and eyes save together, and the person shows it everywhere on the page", async ({ page }) => {
  await page.goto(TEAM);
  await card(page, "ฝน").getByRole("button", { name: rolePicker.heading("ฝน") }).click();
  const panel = page.locator("[data-side-panel]");
  await panel.getByRole("radio", { name: faces.body.gem }).click();
  await panel.getByRole("radio", { name: faces.color.teal }).click();
  await panel.getByRole("radio", { name: `ตา${faces.eyes.one}` }).click();
  await expect(card(page, "ฝน").locator("svg[data-face]")).toHaveAttribute("data-face", "gem-teal-one");
  await page.reload();
  await expect(node(page, "ฝน").locator("svg[data-face]")).toHaveAttribute("data-face", "gem-teal-one");
});

test("chain: link by tapping the out-dot then ต่อที่นี่ — by mouse, and by keyboard only", async ({ page }) => {
  await page.goto(TEAM);
  const before = await edges(page);
  const names = ["ปลา", "ฝน", "แบงค์", "มิ้นท์"] as const;
  const ids = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await idOf(page, n)] as const)));
  const free = names.flatMap((a) => names.filter((b) => b !== a).map((b) => [a, b] as const)).filter(([a, b]) => !before.includes(`${ids[a]}>${ids[b]}`));
  const [[a1, b1], [a2, b2]] = [free[0]!, free[1]!];
  await node(page, a1).locator("[data-out]").click();
  await node(page, b1).locator("[data-target]").click();
  await expect(page.locator(`[data-edge="${ids[a1]}>${ids[b1]}"]`)).toHaveCount(1);
  await node(page, a2).locator("[data-out]").focus();
  await page.keyboard.press("Enter");
  await node(page, b2).locator("[data-target]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-edge="${ids[a2]}>${ids[b2]}"]`)).toHaveCount(1);
  expect((await edges(page)).length).toBe(before.length + 2);
});

test("chain: cut a line by mouse and by keyboard — เลิกทำ puts it back; reload keeps the layout", async ({ page }) => {
  await page.goto(TEAM);
  const first = (await edges(page))[0]!;
  const layout = await page.locator("[data-node]").evaluateAll((ns) => ns.map((n) => n.getAttribute("transform")));
  await page.locator(`[data-edge="${first}"]`).click();
  await expect(page.locator(`[data-edge="${first}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: undo.button }).click();
  await expect(page.locator(`[data-edge="${first}"]`)).toHaveCount(1);
  await page.locator(`[data-edge="${first}"]`).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-edge="${first}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: undo.button }).click();
  await expect(page.locator(`[data-edge="${first}"]`)).toHaveCount(1);
  await page.reload();
  expect(await page.locator("[data-node]").evaluateAll((ns) => ns.map((n) => n.getAttribute("transform")))).toEqual(layout);
});

test("chain: set the entry worker — the mark moves", async ({ page }) => {
  await page.goto(TEAM);
  await card(page, "มิ้นท์").getByRole("button", { name: words.setEntry }).click();
  await expect(page.locator("[data-entry-tag]")).toHaveCount(1);
  await expect(card(page, "มิ้นท์").locator("[data-entry-tag]")).toHaveCount(1);
});

test("chain: removing a member who holds open cards asks who takes them; no card is lost", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  const cards = await page.locator("[data-card]").count();
  await page.goto(TEAM);
  const bank = card(page, "แบงค์");
  await bank.getByRole("button", { name: `${words.remove} แบงค์` }).click();
  const ask = bank.getByRole("group", { name: /ยังถือการ์ดอยู่/ });
  await expect(ask).toContainText("แบงค์ ยังถือการ์ดอยู่");
  await ask.locator(".ant-select").click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: "มิ้นท์" }).click();
  await ask.getByRole("button", { name: words.remove }).click();
  await expect(page.locator("[data-node]")).toHaveCount(3);
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await expect(page.locator("[data-card]")).toHaveCount(cards);
  await expect(page.locator('[data-column]:not([data-column="done"]) [data-card]').filter({ hasText: "แบงค์" })).toHaveCount(0);
});

test("at 390 the chain is a read-only tree (no dots, no hint)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TEAM);
  await expect(page.locator("[data-chain-tree] li")).toHaveCount(5); // คุณ + 4
  await expect(page.locator("[data-out]:visible")).toHaveCount(0);
});

test("readiness: a fix is a control that takes you to it (D-063) — the folder fix focuses the header's folder button", async ({ page }) => {
  await page.goto(TEAM);
  const fix = page.locator('[data-check="folder"] [data-fix]');
  await expect(fix).toHaveRole("button");
  await fix.click();
  await expect(page.locator("[data-folders]")).toBeFocused();
});

// TASK-B-074 (Team C's build walk)
test("C1 @390: the tree indents by hand-off distance — ฝน and แบงค์ (both one hand-off from ปลา) sit at the same indent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TEAM);
  const pad = (name: string) => page.locator("[data-chain-tree] li").filter({ hasText: name }).evaluate((e) => getComputedStyle(e).paddingLeft);
  expect(await pad("ฝน")).toBe(await pad("แบงค์"));
  expect(parseFloat(await pad("ปลา"))).toBeLessThan(parseFloat(await pad("ฝน")));
});

test("C8: a return line (QA → PM, back up the chain) is drawn as an arrow round the side", async ({ page }) => {
  await page.goto(TEAM);
  const [qa, pm] = [await idOf(page, "มิ้นท์"), await idOf(page, "ปลา")];
  if ((await page.locator(`[data-edge="${qa}>${pm}"]`).count()) === 0) {
    await node(page, "มิ้นท์").locator("[data-out]").click();
    await node(page, "ปลา").locator("[data-target]").click();
  }
  const handle = page.locator(`[data-edge="${qa}>${pm}"]`);
  await expect(handle).toHaveCount(1);
  const line = handle.locator("xpath=preceding-sibling::*[local-name()='path'][1]");
  await expect(line).toHaveAttribute("marker-end", "url(#caw-arrow)");
  expect((await line.boundingBox())!.width).toBeGreaterThan(20); // a drawn curve, not a point
});

test("C4: the team page follows the project without a reload when its events move", async ({ page, context }) => {
  await page.goto(TEAM);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  const other = await context.newPage();
  await other.goto(TEAM);
  await other.locator("[data-worker]").filter({ hasText: "มิ้นท์" }).getByRole("button", { name: words.setEntry }).click();
  await expect(other.locator("[data-worker]").filter({ hasText: "มิ้นท์" }).locator("[data-entry-tag]")).toHaveCount(1);
  await page.bringToFront(); // LiveRefresh polls only while its tab is visible
  await expect(card(page, "มิ้นท์").locator("[data-entry-tag]")).toHaveCount(1, { timeout: 40_000 });
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
});
