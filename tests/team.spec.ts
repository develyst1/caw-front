// ทีม · สายงาน in direction B (TASK-B-086): the picture is the team (each person once), a person's drawer edits them (every change saves at once), the add modal
// (OD-12), linking from the drawer's list (no dots, OD-4), and honest remove (D-081): no cards → undo toast · cards → who takes them · the entry person →
// who takes work first · a running hop → refused, said. On `operator-like` (TASK-B-083): Paul PM+BA (entry) → สมศักดิ์ SA → Fena FE · Beta BE · กิตติพงษ์ FE+BE →
// ณัฐธิดา QA → back to สมศักดิ์; Beta runs a hop on his card, Fena and ณัฐธิดา hold cards; ปาริชาตินันท์ is on the bench; one deleted worker.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { card, faces, rolePicker, section, team as words, teamPage, undo } from "../src/words";

const TEAM = `/p/${MOCK_PROJECT_ID}/team`;
const W = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [PAUL, SA, FENA, BETA, KIT, QA, BENCH] = [11, 12, 13, 14, 15, 16, 17].map(W);
const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]:visible`);
const drawer = (page: Page) => page.locator("[data-side-panel]");
const open = async (page: Page, id: string) => { await node(page, id).click(); await expect(drawer(page)).toBeVisible(); };

test.use({ seedState: "operator-like" });

test("the picture is the team: each member once, no card grid, no dots; the bench lists the one outsider; the deleted worker is nowhere", async ({ page }) => {
  await page.goto(`/p/${MOCK_PROJECT_ID}`);
  await page.getByRole("link", { name: section.team }).click();
  await expect(page).toHaveURL(TEAM);
  for (const id of [PAUL, SA, FENA, BETA, KIT, QA]) await expect(node(page, id)).toHaveCount(1);
  await expect(page.locator("[data-worker]")).toHaveCount(0);
  await expect(page.locator("[data-out], [data-target]")).toHaveCount(0);
  await expect(page.locator("[data-bench-person]")).toHaveCount(1);
  await expect(page.locator(`[data-bench-person="${BENCH}"]`)).toBeVisible();
  await expect(page.getByText("อดีตสมาชิกทีมที่ลาออกไปแล้ว")).toHaveCount(0);
  // the return line QA → SA is drawn in its lane, as a dashed arrow
  await expect(page.locator(`[data-edge="${QA}>${SA}"]`)).toHaveAttribute("stroke-dasharray", "4 5");
});

test("add a person through the modal (OD-12): name · character · roles → เพิ่มคนทำงาน; they join the picture; nothing of the form stays on the page", async ({ page }) => {
  await page.goto(TEAM);
  await expect(page.locator("[data-add-worker]")).toHaveCount(0);
  await page.locator("[data-add-person]").click();
  const modal = page.locator("[data-add-worker]");
  await expect(modal).toBeVisible();
  await modal.locator("[data-name-input]").fill("วรรณวิสาข์ เจริญรุ่งเรืองกิจ");
  await modal.getByRole("radio", { name: faces.body.gem }).click();
  await modal.locator("[data-roles]").getByRole("radio", { name: "BE" }).or(modal.locator("[data-roles]").getByRole("button", { name: "BE" })).first().click();
  await modal.getByRole("button", { name: words.addWorker, exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator("[data-node]:visible").filter({ hasText: "วรรณวิสาข์" })).toHaveCount(1);
  await expect(page.locator("[data-node]:visible").filter({ hasText: "วรรณวิสาข์" }).locator("svg[data-face]")).toHaveAttribute("data-face", /^gem-/);
});

test("Escape closes the add modal and focus goes back to its button", async ({ page }) => {
  await page.goto(TEAM);
  await page.locator("[data-add-person]").click();
  await expect(page.locator("[data-add-worker]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-add-worker]")).toHaveCount(0);
  await expect(page.locator("[data-add-person]")).toBeFocused();
});

test("edit a person's roles in the drawer — saved at once, kept on reload", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, BETA);
  await expect(drawer(page).getByRole("heading", { name: rolePicker.heading("Beta") })).toBeVisible();
  await drawer(page).locator("[data-roles]").locator("button, [role=radio]").filter({ hasText: /^QA$/ }).click();
  await expect(node(page, BETA)).toContainText("BE · QA");
  await page.reload();
  await expect(node(page, BETA)).toContainText("BE · QA");
});

test("link from the drawer's list, then unlink — and เลิกทำ puts the line back", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, FENA);
  await drawer(page).locator("[data-add-edge]").click();
  await page.locator(`[data-link-to="${PAUL}"]`).click();
  await expect(page.locator(`[data-edge="${FENA}>${PAUL}"]`)).toHaveCount(1);
  await expect(drawer(page).locator(`[data-hands-to="${PAUL}"]`)).toBeVisible();
  await drawer(page).locator(`[data-hands-to="${PAUL}"]`).getByRole("button", { name: words.removeEdge }).click();
  await expect(page.locator(`[data-edge="${FENA}>${PAUL}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: undo.button }).click();
  await expect(page.locator(`[data-edge="${FENA}>${PAUL}"]`)).toHaveCount(1);
});

test("remove a person with no cards: gone at once, the toast is in the viewport, เลิกทำ brings them and their lines back", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, KIT);
  await drawer(page).locator("[data-remove]").click();
  await expect(node(page, KIT)).toHaveCount(0);
  await expect(page.locator(`[data-bench-person="${KIT}"]`)).toBeVisible(); // out of this project only: on the bench
  const toast = page.getByText(undo.removed("กิตติพงษ์ วัฒนาพาณิชย์กุล"));
  await expect(toast).toBeInViewport();
  await page.getByRole("button", { name: undo.button }).click();
  await expect(node(page, KIT)).toHaveCount(1);
  await expect(page.locator(`[data-edge="${SA}>${KIT}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-edge="${KIT}>${QA}"]`)).toHaveCount(1);
});

test("remove a person holding cards: the dialog asks who takes them, pre-selected to the person they hand to; confirming removes them", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, FENA);
  await drawer(page).locator("[data-remove]").click();
  const dialog = page.locator('[data-remove-dialog="cards"]');
  await expect(dialog).toBeInViewport();
  await expect(dialog.locator("[data-remove-ask]")).toHaveText(words.reassign("Fena", 1));
  await expect(dialog.locator("[data-remove-pick]")).toContainText("ณัฐธิดา");
  await dialog.locator("[data-remove-confirm]").click();
  await expect(dialog).toHaveCount(0);
  await expect(node(page, FENA)).toHaveCount(0);
});

test("remove the entry person: the dialog picks who takes work first instead (pre-selected), then removes", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, PAUL);
  await drawer(page).locator("[data-remove]").click();
  const dialog = page.locator('[data-remove-dialog="entry"]');
  await expect(dialog.locator("[data-remove-ask]")).toHaveText(teamPage.entryFirst("Paul"));
  await expect(dialog.locator("[data-remove-pick]")).toContainText("สมศักดิ์");
  await dialog.locator("[data-remove-confirm]").click();
  await expect(node(page, PAUL)).toHaveCount(0);
  await expect(node(page, SA)).toContainText(words.entry);
});

test("a person with a running hop: removing is refused, the dialog says why, and nothing changes (D-081 item 3)", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, BETA);
  await drawer(page).locator("[data-remove]").click();
  const dialog = page.locator('[data-remove-dialog="running"]');
  await expect(dialog).toContainText(teamPage.hopRunning("Beta"));
  await dialog.getByRole("button", { name: teamPage.close }).click();
  await expect(node(page, BETA)).toHaveCount(1);
});

test("delete a person from the bench — they leave the bench", async ({ page }) => {
  await page.goto(TEAM);
  await page.locator(`[data-bench-person="${BENCH}"] [data-delete-worker]`).click();
  await expect(page.locator(`[data-bench-person="${BENCH}"]`)).toHaveCount(0);
});

test("the face picker: shape, colour and eyes save together, and the node shows the new face", async ({ page }) => {
  await page.goto(TEAM);
  await open(page, FENA);
  await drawer(page).locator("[data-face-button]").click();
  await drawer(page).getByRole("radio", { name: faces.body.gem }).click();
  await expect(node(page, FENA).locator("svg[data-face]")).toHaveAttribute("data-face", /^gem-/);
});

test("readiness: one line of ticks; with no QA the fix opens the add modal with QA picked (B10 / OD-3)", async ({ page }) => {
  await page.goto(TEAM);
  await expect(page.locator("[data-readiness] [data-check]")).toHaveCount(5);
  await open(page, QA);
  await drawer(page).locator("[data-remove]").click();       // ณัฐธิดา holds a card → the cards dialog
  await page.locator("[data-remove-confirm]").click();
  await expect(node(page, QA)).toHaveCount(0);
  const fix = page.locator('[data-check="handoff"] [data-fix]');
  await expect(fix).toHaveText(`${teamPage.noQa.text} — ${teamPage.noQa.fix}`);
  await fix.click();
  const modal = page.locator("[data-add-worker]");
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-roles] [data-state=on]")).toHaveText("QA");
});

test("@390 the chain is a list; the return line is said in words under its sender", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TEAM);
  await expect(page.locator("[data-chain-picture]")).toBeHidden();
  await expect(page.locator("[data-chain-tree] [data-node]")).toHaveCount(6);
  await expect(page.locator("[data-return-line]")).toHaveText(teamPage.returnLine("ณัฐธิดา วิริยะกุลพัฒนาเลิศ", "สมศักดิ์ ศรีประเสริฐวงศ์"));
  await expect(drawer(page)).toHaveCount(0); // the drawer is closed until a person is pressed
  await page.locator(`[data-chain-tree] [data-node="${SA}"]`).click();
  await expect(drawer(page).getByRole("heading", { name: card.handoff })).toBeVisible();
});

test("C4: the team page follows the project without a reload when its events move", async ({ page, context }) => {
  await page.goto(TEAM);
  await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
  const other = await context.newPage();
  await other.goto(TEAM);
  await other.locator(`[data-node="${SA}"]:visible`).click();
  await other.locator("[data-set-entry]").click();
  await expect(other.locator(`[data-node="${SA}"]:visible`)).toContainText(words.entry);
  await page.bringToFront(); // LiveRefresh polls only while its tab is visible
  await expect(node(page, SA)).toContainText(words.entry, { timeout: 40_000 });
  expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1);
});

// B-086 review: a name breaks only at its spaces — a Thai surname is never split across lines (on the nodes and in the drawer head)
test("@1440 no name part is broken across lines — nodes and drawer head", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TEAM);
  const broken = async () => page.locator("[data-name-part]:visible").evaluateAll((ps) =>
    ps.filter((p) => new Set([...p.getClientRects()].map((r) => Math.round(r.top))).size > 1).map((p) => p.textContent));
  await expect(page.locator("[data-chain-picture] [data-name-part]")).toHaveCount(9); // 6 people: 3 one-part + 3 two-part names
  expect(await broken()).toEqual([]);
  await open(page, KIT);
  await expect(drawer(page).locator("[data-name-part]")).toHaveText(["กิตติพงษ์", "วัฒนาพาณิชย์กุล"]);
  expect(await broken()).toEqual([]);
});

// TASK-B-092 DEF-3: at 390 a first name wider than the drawer title ends in … (never cut), and the whole name is in the title
test("@390 a too-long first name ends in … in the drawer title, with the whole name in its title", async ({ page }) => {
  const long = "มิ้นท์มณีรัตนาภรณ์ วงศ์สวัสดิ์";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TEAM);
  await page.locator("[data-add-person]").click();
  const modal = page.locator("[data-add-worker]");
  await modal.locator("[data-name-input]").fill(long);
  await modal.locator("[data-roles]").getByRole("button", { name: "QA" }).click();
  await modal.getByRole("button", { name: words.addWorker, exact: true }).click();
  await page.locator("[data-chain-tree] [data-node]").filter({ hasText: "วงศ์สวัสดิ์" }).click();
  const title = drawer(page).locator("h2[data-name]");
  await expect(title).toHaveAttribute("title", long);
  const first = title.locator("[data-name-part]").first();
  const m = await first.evaluate((e) => ({ cut: e.scrollWidth > e.clientWidth, ellipsis: getComputedStyle(e).textOverflow, inside: e.getBoundingClientRect().right <= innerWidth }));
  expect(m).toEqual({ cut: true, ellipsis: "ellipsis", inside: true });
});
