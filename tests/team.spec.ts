// ทีม · สายงาน (TASK-B-042 DoD 1, REQ-011 AC-5): create a worker · combine two (skills union, the stronger model) · add an edge in the
// picture (mouse and keyboard) · set the entry · remove a member who still holds open cards → asked who takes them, no card lost.
// Each test starts from the mock's seed (fixtures.ts): ปลา PM opus · ฝน FE sonnet · แบงค์ BE sonnet · มิ้นท์ QA sonnet, all in the chain.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { section, team as words } from "../src/words";

const TEAM = `/p/${MOCK_PROJECT_ID}/team`;
const pick = async (page: import("@playwright/test").Page, labelText: string, option: string) => {
  await page.locator("label").filter({ hasText: labelText }).locator(".ant-select").first().click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: option }).first().click();
  await expect(page.locator(".ant-select-dropdown:visible")).toHaveCount(0); // a closing dropdown must not catch the next pick
};
const node = (page: import("@playwright/test").Page, name: string) => page.locator("[data-node]").filter({ hasText: name });
const edges = (page: import("@playwright/test").Page) => page.locator("[data-edge]").evaluateAll((es) => es.map((e) => e.getAttribute("data-edge")));
const idOf = (page: import("@playwright/test").Page, name: string) => node(page, name).getAttribute("data-node");

test("team: the header links to ทีม, and the page shows the chain and every worker", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByRole("link", { name: section.team }).click();
  await expect(page).toHaveURL(TEAM);
  await expect(page.getByRole("heading", { level: 2, name: section.chain })).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(4);
  await expect(page.locator("[data-worker]")).toHaveCount(4);
});

test("team: create a worker — it is listed, with the model its role defaults to", async ({ page }) => {
  await page.goto(TEAM);
  await page.locator("label").filter({ hasText: words.name }).first().locator("input").fill("ต้นกล้า");
  await page.getByPlaceholder(words.skillsHint).fill("role-fe, frontend-finish");
  await page.getByRole("button", { name: words.addWorker }).click();
  const w = page.locator("[data-worker]").filter({ hasText: "ต้นกล้า" });
  await expect(w).toHaveCount(1);
  await expect(w.locator("[data-model]")).toHaveText("sonnet");
  await expect(w.locator("[data-skills]")).toContainText("frontend-finish");
});

test("team: combine two — the union of their skills and the stronger model", async ({ page }) => {
  await page.goto(TEAM);
  await pick(page, `${words.name} 1`, "ปลา");
  await pick(page, `${words.name} 2`, "ฝน");
  await page.locator("label").filter({ hasText: words.combinedName }).locator("input").fill("ปลาฝน");
  await page.getByRole("button", { name: words.combine }).click();
  const w = page.locator("[data-worker]").filter({ hasText: "ปลาฝน" });
  await expect(w).toHaveCount(1);
  await expect(w.locator("[data-model]")).toHaveText("opus");
  for (const k of ["role-pm", "role-fe", "frontend-finish"]) await expect(w.locator("[data-skills]")).toContainText(k);
  await expect(w).toContainText(words.combinedFrom("ปลา", "ฝน"));
});

test("chain: an edge added in the picture shows — by mouse, and by keyboard", async ({ page }) => {
  await page.goto(TEAM);
  const before = await edges(page);
  const names = ["ปลา", "ฝน", "แบงค์", "มิ้นท์"];
  const ids = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await idOf(page, n)] as const)));
  const missing = names.flatMap((a) => names.filter((b) => b !== a).map((b) => [a, b] as const)).filter(([a, b]) => !before.includes(`${ids[a]}>${ids[b]}`));
  const [[a1, b1], [a2, b2]] = [missing[0]!, missing[1]!];
  await node(page, a1).click();
  await expect(node(page, a1)).toHaveAttribute("aria-pressed", "true");
  await node(page, b1).click();
  await expect(page.locator(`[data-edge="${ids[a1]}>${ids[b1]}"]`)).toHaveCount(1);
  await node(page, a2).focus();
  await page.keyboard.press("Enter");
  await node(page, b2).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-edge="${ids[a2]}>${ids[b2]}"]`)).toHaveCount(1);
  expect((await edges(page)).length).toBe(before.length + 2);
});

test("chain: set the entry worker — the mark moves", async ({ page }) => {
  await page.goto(TEAM);
  const row = page.locator("[data-member]").filter({ has: page.getByRole("button", { name: words.setEntry }) }).first();
  const who = (await row.locator("span").first().textContent())!.slice(1); // after the avatar initial
  await row.getByRole("button", { name: words.setEntry }).click();
  const marks = page.locator("[data-member] .ant-tag").filter({ hasText: words.entry }); // the tag, not the ให้รับงานคนแรก buttons
  await expect(marks).toHaveCount(1);
  await expect(page.locator("[data-member]").filter({ has: page.locator(".ant-tag", { hasText: words.entry }) })).toContainText(who);
});

test("chain: removing a member who holds open cards asks who takes them; no card is lost", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  const cards = await page.locator("[data-card]").count();
  await page.goto(TEAM);
  const bank = page.locator("[data-member]").filter({ hasText: "แบงค์" });
  await bank.getByRole("button", { name: `${words.remove} แบงค์` }).click();
  const ask = bank.getByRole("group");
  await expect(ask).toContainText("แบงค์ ยังถือการ์ดอยู่");
  await ask.locator(".ant-select").click();
  await page.locator(".ant-select-dropdown:visible .ant-select-item-option").filter({ hasText: "มิ้นท์" }).click();
  await ask.getByRole("button", { name: words.remove }).click();
  await expect(page.locator("[data-member]").filter({ hasText: "แบงค์" })).toHaveCount(0);
  await expect(page.locator("[data-node]")).toHaveCount(3);
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await expect(page.locator("[data-card]")).toHaveCount(cards);
  // his open cards went to มิ้นท์; a card he finished stays his (the back end moves open cards only)
  await expect(page.locator('[data-column]:not([data-column="done"]) [data-card]').filter({ hasText: "แบงค์" })).toHaveCount(0);
});
