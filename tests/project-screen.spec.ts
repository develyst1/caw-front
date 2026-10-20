// REQ-014 build part 2 (TASK-B-064): the project screen — first steps on a brand-new project, the crew strip, the chat notice (TASK-B-098: no chat beside the board) — and
// the projects home. Seeds: `new-project` (a second project with nothing in it), `working-now` (แบงค์ runs a hop on card 4 now).
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { MOCK_NEW_PROJECT_ID, MOCK_PROJECT_ID } from "../src/api/mock";
import { agreeStart, chat, chatWaits, live, mode, modeLine, redesign, runRunning, section, themeToggle, workspace } from "../src/words";

const NEW = `/p/${MOCK_NEW_PROJECT_ID}`;
const BOARD = `/p/${MOCK_PROJECT_ID}`;
const box = (page: Page) => page.locator("[data-composer] textarea"); // TASK-B-100 C-1: its name is now `เล่างานให้ {entry}…`

test.describe("first steps on a brand-new project", () => {
  test.use({ seedState: "new-project" });

  test("AC-2 walk: ใช้ทีมเริ่มต้น → 5 people · a folder → step 2 · a request in the chat — ≤ 5 clicks and one typed request", async ({ page }) => {
    let clicks = 0;
    const click = async (l: ReturnType<Page["locator"]>) => { clicks++; await l.click(); };
    await page.goto(NEW);
    const steps = page.locator("[data-first-steps]");
    await expect(steps.locator("[data-step]")).toHaveCount(3);
    await expect(steps).toContainText(live.readyCount(0));

    await click(page.getByRole("button", { name: redesign.useStartingTeam }));
    await expect(page.locator("[data-crew] [data-seat]")).toHaveCount(5);
    await expect(steps.locator('[data-step="team"]')).toHaveAttribute("data-done", "true");
    await expect(steps).toContainText(live.teamFact(5));
    await expect(steps).toContainText(live.readyCount(1));

    await steps.getByLabel(workspace.heading).fill("/Users/me/repo");
    await click(steps.getByRole("button", { name: workspace.add }));
    await expect(steps.locator('[data-step="folder"]')).toHaveAttribute("data-done", "true");
    await expect(steps).toContainText(live.readyCount(2));

    // TASK-B-098: no chat beside the board any more — the แชต tab is the way in (step 3's own button is B-2, TASK-B-100)
    await click(page.getByRole("navigation", { name: section.board }).getByRole("link", { name: new RegExp(section.chat) }));
    const ask = `ขอหน้าค้นหาห้อง ${Date.now()}`;
    await box(page).fill(ask);
    await box(page).press("Enter");
    await expect(page.locator('[data-message="operator"]').filter({ hasText: ask })).toHaveCount(1);
    expect(clicks).toBeLessThanOrEqual(5);
  });

  test("A5 @390: while the first steps show, the request box is not pinned over them — ใช้ทีมเริ่มต้น is in the first view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(NEW);
    await expect(page.getByRole("button", { name: redesign.useStartingTeam })).toBeInViewport({ ratio: 1 });
    await expect(page.locator("[data-missing]")).toHaveCount(0); // A6: the steps say what is missing; the chat head does not repeat it
    await expect(page.locator("[data-folder-warn]")).toBeHidden(); // A6: nor the header's banner
  });
});

test.describe("the crew strip", () => {
  test.use({ seedState: "working-now" });

  test("the one running hop reads กำลังทำ: <card> on its seat; the others are not working", async ({ page }) => {
    await page.goto(BOARD);
    const bank = page.locator("[data-seat]").filter({ hasText: "แบงค์" });
    await expect(bank).toHaveAttribute("data-state", "working");
    await expect(bank).toContainText(`${redesign.seatWorking("")}`.trim());
    await expect(page.locator('[data-seat][data-state="working"]')).toHaveCount(1);
  });

  test("a running hop quiet for ≥ 10 minutes reads เงียบไป {n} นาที (browser clock moved 12 minutes)", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await page.goto(BOARD);
    const bank = page.locator("[data-seat]").filter({ hasText: "แบงค์" });
    await expect(bank).not.toContainText("เงียบไป");
    await page.clock.fastForward("12:00");
    await expect(bank).toContainText(live.quiet(12));
  });

  test("the page follows the project without a reload when its events move", async ({ page, context }) => {
    await page.goto(BOARD);
    await page.evaluate(() => { (window as unknown as { stay: number }).stay = 1; });
    const other = await context.newPage();
    await other.goto(`${BOARD}/chat`);
    const ask = `จากอีกแท็บ ${Date.now()}`;
    await box(other).fill(ask);
    await box(other).press("Enter");
    await expect(other.locator('[data-message="operator"]').filter({ hasText: ask })).toHaveCount(1);
    await page.bringToFront(); // LiveRefresh polls only while its tab is visible (by design)
    // the seed's newest chat message is the team's, so the board said it waits on you; your message answers it (TASK-B-098: no panel to watch any more)
    await expect(page.locator("[data-chat-waits]")).toHaveCount(0, { timeout: 30_000 }); // one poll interval at most
    expect(await page.evaluate(() => (window as unknown as { stay?: number }).stay)).toBe(1); // same document: no reload
  });
});

// TASK-B-098 (D-093, D-094 § 0): no chat on the board at any width — the แชต tab is the way in; one notice while the team waits on you there
for (const [vw, vh] of [[1440, 900], [390, 844]] as const) {
  test(`@${vw}: the board has no chat thread and no request box`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto(BOARD);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(page.locator("[data-thread]")).toHaveCount(0);
    await expect(page.locator("[data-composer]")).toHaveCount(0);
  });
}

test("the newest chat message is the team's, with no question → the notice; ไปที่แชต lands on the chat", async ({ page }) => {
  await page.goto(BOARD); // the plain seed: Paul's reply is the newest message and asks nothing
  const notice = page.locator("[data-chat-waits]");
  // the plain seed's newest reply also carries an open proposal, so since D-105 P2 (TASK-B-120) the line says it waits for his agreement
  await expect(notice).toContainText(agreeStart.waiting("").trim()); // `{entry} เสนองานไว้ รอคุณตกลง`, whoever the entry person is
  await expect(notice.locator("svg[data-face]")).toHaveCount(1);
  await notice.getByRole("link", { name: chatWaits.go }).click();
  await expect(page).toHaveURL(new RegExp(`${BOARD}/chat$`));
  await expect(box(page)).toBeVisible();
});

test.describe("a structured question from the entry person", () => {
  test.use({ seedState: "entry-asked" });
  test("shows as the AskSheet, never also as the notice (B-5)", async ({ page }) => {
    await page.goto(BOARD);
    await expect(page.locator('[data-ask="chat"]')).toHaveCount(1);
    await expect(page.locator("[data-chat-waits]")).toHaveCount(0);
  });
});

test("the mode switch explains itself — in its title and in the budget dialog (H-2) — and both headers have the light / dark toggle", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-mode-control]")).toHaveAttribute("title", modeLine.manual);
  await expect(page.locator("[data-mode-line]")).toHaveCount(0); // no line under the toggle any more
  await page.locator("[data-mode-control]").getByRole("radio", { name: mode.dispatcher }).click();
  await expect(page.locator("[data-budget-ask] [data-mode-line]")).toHaveText(modeLine.dispatcher);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: themeToggle })).toHaveCount(1);
  await page.goto("/");
  await expect(page.getByRole("button", { name: themeToggle })).toHaveCount(1);
});

test("home: a project row shows who is working, stuck and waiting on you, with the team's faces", async ({ page }) => {
  await page.goto("/");
  const row = page.locator("[data-project]").first();
  await expect(row.locator("svg[data-face]").first()).toBeVisible();
  await expect(row).toContainText(/ติดอยู่ \d|รอคุณตอบ \d/);
});

// B-064 review → TASK-B-065: one primary per screen — two open proposals, only the newest one's สร้างการ์ด is primary
test("@1440: the board shows exactly one visible primary button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BOARD);
  await expect(page.locator('[data-slot="button"][data-variant="default"]:visible')).toHaveCount(1); // TASK-B-087: shadcn Button
});

test("A4: the mode bar shows a budget only while an automatic run is open", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-mode-bar]")).not.toContainText("ใช้ไป");
  await page.locator("[data-mode-control]").getByRole("radio", { name: "อัตโนมัติ" }).click(); // TASK-B-085: ToggleGroup
  await page.locator("[data-budget-ask] form button[type=submit]").click();
  await expect(page.locator("[data-mode-bar]")).toContainText(/งบ \d+ ก้าว · ใช้ไป 0/);
});

// TASK-B-074 C2 / C3 / C7 (after B-073)
test("C2: the home's ติดอยู่ {n} is the number in the board's stuck column", async ({ page }) => {
  await page.goto(BOARD);
  const n = await page.locator('[data-column="stuck"] [data-card]').count();
  await page.goto("/");
  await expect(page.locator("[data-project]").first()).toContainText(`ติดอยู่ ${n}`);
});

// TASK-B-076: on Bob's `entry-asked` seed (B-075) the entry worker's question is the newest chat message
test.describe("C3: the entry worker asked last", () => {
  test.use({ seedState: "entry-asked" });
  test("ปลา reads รอคำตอบจากคุณ, and the home counts it in รอคุณตอบ", async ({ page }) => {
  await page.goto(BOARD);
  await expect(page.locator('[data-seat="ปลา"]')).toHaveAttribute("data-state", "waitingOnYou");
  await expect(page.locator('[data-seat="ปลา"]')).toContainText(redesign.seatWaiting);
  await page.goto("/");
  await expect(page.locator("[data-project]").first()).toContainText(/รอคุณตอบ [1-9]/);
  });
});

test.describe("C7: a running chat step", () => {
  test.use({ seedState: "chat-running" });
  // TASK-B-076: B-075 puts `chat-running`'s step in `hops()` with its `messageId`
  test("the seat reads กำลังตอบแชต, ringed as working", async ({ page }) => {
    await page.goto(BOARD);
    const seat = page.locator('[data-seat][data-state="answeringChat"]');
    await expect(seat).toHaveCount(1);
    await expect(seat).toContainText(live.answeringChat);
    await expect(seat.locator('[data-person-state="working"]')).toHaveCount(1);
  });
});

// TASK-B-077 (REQ-014 DEF-1, D-075): the five-person starting team on the board — every seat fits at 1440; at 390 the strip scrolls and says so
test.describe("DEF-1: the seat strip with the five-person starting team", () => {
  test.use({ seedState: "new-project" });
  const five = async (page: Page) => {
    await page.goto(NEW);
    await page.getByRole("button", { name: redesign.useStartingTeam }).click();
    await expect(page.locator("[data-crew] [data-seat]")).toHaveCount(5);
  };

  test("@1440 every seat's box lies inside the strip's box — no seat cut, no scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await five(page);
    const strip = (await page.locator("[data-crew]").boundingBox())!;
    for (const seat of await page.locator("[data-crew] [data-seat]").all()) {
      const b = (await seat.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(strip.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(strip.x + strip.width + 0.5);
    }
    await expect(page.locator("[data-crew-fade]")).toHaveCount(0);
  });

  test("@390 the strip scrolls, the fade cue shows on the edge that has more, and the 5th seat is reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await five(page);
    const crew = page.locator("[data-crew]");
    expect(await crew.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    const fade = page.locator('[data-crew-fade="end"]');
    await expect(fade).toHaveCount(1);
    expect(await fade.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain("gradient");
    await page.locator("[data-crew] [data-seat]").nth(4).scrollIntoViewIfNeeded();
    await expect(page.locator("[data-crew] [data-seat]").nth(4)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-crew-fade="start"]')).toHaveCount(1);
  });
});

// TASK-B-099 (D-094 § 1): the header's one job — back · name · tabs · theme, plus a small กำลังรัน while a run is open; the mode lives on the board
for (const [vw, vh] of [[1440, 900], [390, 844]] as const) {
  test(`@${vw}: the project header holds only back, name, tabs and theme — กำลังรัน only while a run is open`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    for (const url of [BOARD, `${BOARD}/team`, `${BOARD}/runs`, `${BOARD}/chat`]) {
      await page.goto(url);
      const header = page.locator("header").first();
      const controls = await header.locator("a, button, [role=radio], input").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
      expect(controls, url).toBe(1 + 4 + 1); // back · the four tabs · theme
      await expect(header.locator("[data-mode-control], [data-folders], [data-header-menu]"), url).toHaveCount(0);
      await expect(header.locator("[data-run-mark]"), url).toHaveCount(0); // the seed's runs have ended
    }
    await page.goto(BOARD);
    await page.locator("[data-mode-bar] [data-mode-control]").getByRole("radio", { name: mode.dispatcher }).click();
    await page.locator("[data-budget-ask] form button[type=submit]").click();
    await page.goto(`${BOARD}/team`); // seen from another screen too
    await expect(page.locator("header [data-run-mark]")).toHaveText(runRunning);
  });
}

test("the mode bar on the board: switch, budget and stop work there; การรัน shows the same state, read-only", async ({ page }) => {
  await page.goto(BOARD);
  const bar = page.locator("[data-mode-bar]");
  await expect(bar.locator("xpath=following-sibling::*[1]")).toHaveAttribute("data-columns"); // right above the columns
  await bar.getByRole("radio", { name: mode.dispatcher }).click();
  await page.locator("[data-budget-ask] form button[type=submit]").click();
  await expect(bar.locator('[data-run-state="open"]')).toHaveText(runRunning);
  await page.goto(`${BOARD}/runs`);
  await expect(page.locator("[data-run-mode]")).toContainText(mode.dispatcher);
  await expect(page.locator("[data-run-mode]")).toContainText(runRunning);
  await expect(page.locator("main [data-mode-control], main [data-stop-run]")).toHaveCount(0);
  await page.goto(BOARD);
  await bar.locator("[data-stop-run]").click();
  await expect(bar.locator('[data-run-state="open"]')).toHaveCount(0);
  await expect(page.locator("header [data-run-mark]")).toHaveCount(0);
});
