// The AC-5 check (TASK-B-084, polish-plan § 2.7, D-085): every screen × 1440 / 1280 / 390 × light / dark, on the `operator-like` seed (six people with long Thai names,
// a return line, a running hop, a stuck card, an open question, a long folder path), plus one cold pass per screen with the stored dark pick. It fails on text wider than its
// box, an element outside the clipping ancestor that does not scroll, an svg stroke outside its drawing area or under another node, a Thai word broken across lines, a
// page that scrolls sideways, and ANY console error. One test per screen × width × theme, so the report says exactly where; each failure is one line:
//   screen · width · theme · rule · selector · text (≤ 40 characters)
// Tagged `@ac5` and skipped unless `AC5=1` (playwright.config.ts) until the screen TASKs make it green; B-088 puts it in the default run.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID as P } from "../src/api/mock";
import { NAME_SELECTOR, probe, type Failure } from "./ac5-probe";

const CARD = "30000000-0000-4000-8000-000000000001"; // `operator-like`'s card 1 (Beta's, in `doing`) — its title is asserted below, so a wrong id cannot pass silently
const SCREENS = [
  { name: "home", url: "/" },
  { name: "board", url: `/p/${P}` },
  { name: "team", url: `/p/${P}/team` },
  { name: "chat", url: `/p/${P}/chat` },
  { name: "runs", url: `/p/${P}/runs` },
  { name: "card", url: `/p/${P}/c/${CARD}` },
  { name: "card-unknown", url: `/p/${P}/c/00000000-0000-4000-8000-0000000000ff` },
] as const;
const WIDTHS = [[1440, 900], [1280, 800], [390, 844]] as const;
const THEMES = ["light", "dark"] as const;

type Page = import("@playwright/test").Page;

/** Console errors and uncaught page errors (a hydration warning is a console error). */
const watchConsole = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().replace(/\s+/g, " ").slice(0, 40)); });
  page.on("pageerror", (e) => errors.push(String(e.message).replace(/\s+/g, " ").slice(0, 40)));
  return errors;
};

/** One line per failure: screen · width · theme · rule · selector · text. */
const lines = (where: string, found: Failure[], errors: string[]) =>
  [...found.map((f) => `${where} · ${f.rule} · ${f.selector} · ${f.text.slice(0, 40)}`), ...errors.map((e) => `${where} · console-error · - · ${e}`)];

/** The stored pick, set before the page's own scripts run (the way the header toggle keeps it). */
const storeTheme = (page: Page, theme: string) => page.addInitScript((t) => { try { localStorage.setItem("caw-theme", t); } catch { /* none */ } }, theme);

const measure = async (page: Page, where: string, errors: string[]) => {
  await page.waitForLoadState("networkidle");
  const found = await page.evaluate(probe, NAME_SELECTOR);
  return lines(where, found, errors);
};

test.describe("AC-5 on the operator-like seed", () => {
  test.use({ seedState: "operator-like" });

  for (const screen of SCREENS) {
    for (const [w, h] of WIDTHS) {
      for (const theme of THEMES) {
        test(`@ac5 ${screen.name} · ${w} · ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width: w, height: h });
          await storeTheme(page, theme);
          const errors = watchConsole(page);
          await page.goto(screen.url);
          if (screen.name === "card") await expect(page.locator("main")).toContainText("ทำ API ขออนุมัติ"); // the real card, not the not-found page
          expect(await measure(page, `${screen.name} · ${w} · ${theme}`, errors), `${screen.name} · ${w} · ${theme}`).toEqual([]);
        });
      }
    }

    // the stored dark pick, loaded cold: the first paint is already dark (PM P-1: the page starting light), then the same measurements
    test(`@ac5 ${screen.name} · cold dark pick`, async ({ page }) => {
      await storeTheme(page, "dark");
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const bg = (el: Element) => getComputedStyle(el).backgroundColor;
          const solid = (c: string) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c);
          (window as unknown as { __cold: unknown }).__cold = { theme: document.documentElement.dataset.theme ?? null, bg: solid(bg(document.body)) ? bg(document.body) : bg(document.documentElement) };
        });
      });
      const errors = watchConsole(page);
      await page.goto(screen.url);
      await page.waitForLoadState("networkidle");
      const cold = await page.evaluate(() => (window as unknown as { __cold?: { theme: string | null; bg: string } }).__cold);
      const [r = 255, g = 255, b = 255] = (cold?.bg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const where = `${screen.name} · cold · dark`;
      const found: string[] = [];
      if (cold?.theme !== "dark") found.push(`${where} · cold-theme · html · data-theme is ${cold?.theme ?? "missing"} at first paint`);
      if (luminance > 0.35) found.push(`${where} · cold-theme · body · first paint ${cold?.bg ?? "?"}`);
      expect([...found, ...(await measure(page, where, errors))], where).toEqual([]);
    });
  }
});

// ---- the self-test: the probe can fail and can pass (DoD 4) — on pages made in the test, no server data involved ----
test.describe("the AC-5 probe proves itself", () => {
  const BAD = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
    <div style="width:40px;white-space:nowrap">ข้อความที่ยาวกว่ากล่องมากมาย</div>
    <div data-name style="width:30px;word-break:break-all">สมศักดิ์ศรีประเสริฐวงศ์</div>
    <script>console.error("a console error the probe must see")</script>`;
  const CLEAN = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
    <div style="width:200px">ข้อความสั้น</div>
    <div data-name style="width:200px">สมศักดิ์</div>
    <div style="width:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="ข้อความที่ยาวกว่ากล่องมากมาย">ข้อความที่ยาวกว่ากล่องมากมาย</div>`;
  const run = async (page: Page, html: string) => {
    const errors = watchConsole(page);
    await page.setContent(html);
    await page.waitForLoadState("load");
    return lines("self-test · - · -", await page.evaluate(probe, NAME_SELECTOR), errors);
  };

  test("@ac5 a page with an overflowing box, a broken Thai name and a console error gives exactly 3 failures — one of each", async ({ page }) => {
    const failures = await run(page, BAD);
    expect(failures.map((f) => f.split(" · ")[3]).sort()).toEqual(["console-error", "text-overflow", "thai-broken"]);
    expect(failures).toHaveLength(3);
  });

  test("@ac5 a clean page — including a box truncated on purpose with an ellipsis and its title — gives 0", async ({ page }) => {
    expect(await run(page, CLEAN)).toEqual([]);
  });

  test("@ac5 an svg whose stroke leaves its box, and an svg under another node, are caught; a tidy one is not", async ({ page }) => {
    const found = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0">
      <svg id="a" width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:10px;top:10px"><line x1="0" y1="20" x2="40" y2="20" stroke="#000" stroke-width="8"/></svg>
      <svg id="b" width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:100px;top:10px"><circle cx="20" cy="20" r="10" stroke="#000" stroke-width="2" fill="none"/></svg>
      <div style="position:absolute;left:96px;top:6px;width:60px;height:60px;background:#f00"></div>
      <svg id="c" width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:200px;top:10px"><circle cx="20" cy="20" r="10" stroke="#000" stroke-width="2" fill="none"/></svg>`);
    const rules = found.map((f) => `${f.split(" · ")[3]} ${f.split(" · ")[4]}`).sort();
    expect(rules).toEqual(["svg-covered svg#b", "svg-stroke svg#a"]);
  });

  test("@ac5 a child that sticks out of a clipping box is caught; the same child in a box that scrolls is not", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0">
      <div style="width:100px;height:30px;overflow:hidden"><div style="width:160px;height:20px;background:#ccc">x</div></div>
      <div style="width:100px;height:30px;overflow-x:auto"><div style="width:160px;height:20px;background:#ccc">y</div></div>`);
    expect(out.map((f) => f.split(" · ")[3])).toEqual(["outside-clip"]);
  });

  test("@ac5 a page that scrolls sideways is caught", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="width:3000px;height:10px;background:#ccc"></div>`);
    expect(out.map((f) => f.split(" · ")[3])).toContain("page-overflow-x");
  });
});
