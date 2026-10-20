// The AC-5 check (TASK-B-084, polish-plan § 2.7, D-085): every screen × 1440 / 1280 / 390 × light / dark, on the `operator-like` seed (six people with long Thai names,
// a return line, a running hop, a stuck card, an open question, a long folder path), plus one cold pass per screen with the stored dark pick. It fails on text wider than its
// box, an element outside the clipping ancestor that does not scroll, an svg stroke outside its drawing area or under another node, a Thai word broken across lines, a
// page that scrolls sideways, and ANY console error. One test per screen × width × theme, so the report says exactly where; each failure is one line:
//   screen · width · theme · rule · selector · text (≤ 40 characters)
// Tagged `@ac5` and skipped unless `AC5=1` (playwright.config.ts) until the screen TASKs make it green; B-088 puts it in the default run.
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID as P } from "../src/api/mock";
import { mode } from "../src/words";
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
type Handle = import("@playwright/test").ElementHandle | null;
/** the probe measuring INSIDE `root` only (an open dialog or sheet); `probe` takes `[nameSelector, root]` for that */
const probeIn = (page: Page, root: Handle) => page.evaluate(probe as unknown as (a: unknown) => Failure[], [NAME_SELECTOR, root] as unknown);

/** Console errors and uncaught page errors (a hydration warning is a console error). */
const watchConsole = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url; // "Failed to load resource" names no file in its text: the path goes first
    let path = ""; try { path = url ? new URL(url).pathname : ""; } catch { /* not a URL */ }
    // the one exemption: a page that answers 404 on purpose (the unknown-card screen) makes Chrome log its OWN status as a console error — that is the page's
    // document, not a file it failed to load; every other failed resource (a favicon, an asset, an API call) still counts
    if (path && /\b404\b/.test(m.text()) && path === new URL(page.url()).pathname) return;
    if (path.startsWith("/_next/static/chunks/")) path = ""; // `next dev` reports React's own warnings from its bundle: the file says nothing, the text does
    errors.push(`${path} ${m.text()}`.replace(/\s+/g, " ").trim().slice(0, 40));
  });
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

// ---- the console pass under `next dev` (TASK-B-101, D-095 DEF-6): React's development warnings (a duplicate key, a hydration mismatch) only exist in dev mode, so the build project
// cannot see them. Run by `bunx playwright test --project ac5-dev` (own server on 3511, own dist folder); every screen once, on the same seed, console errors only.
test.describe("AC-5 console under next dev", () => {
  test.use({ seedState: "operator-like" });
  for (const screen of SCREENS) {
    test(`@ac5dev ${screen.name} · console`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.goto(screen.url);
      if (screen.name === "card") await expect(page.locator("main")).toContainText("ทำ API ขออนุมัติ");
      await page.waitForLoadState("networkidle");
      expect(lines(`${screen.name} · dev`, [], errors), `${screen.name} · dev`).toEqual([]);
    });
  }
});

// ---- every open layer (D-088, TEST-B-004 DEF-3): a drawer, a modal and a sheet are screens too — each is opened the way a user opens it (a click), at 1440 and 390, light and
// dark, and measured INSIDE the open layer only (the page behind is inert and its overlay is not a defect). The topmost layer is the last `[role=dialog|alertdialog]` in the DOM.
const WID = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [FENA, QA] = [13, 16].map(WID); // `operator-like`: Fena (FE) holds cards; ณัฐธิดา วิริยะกุลพัฒนาเลิศ (QA) has the longest name
const TEAM = `/p/${P}/team`;
const BOARD = `/p/${P}`;
const LAYERS: { name: string; only?: "mobile"; open: (page: Page, width: number) => Promise<void> }[] = [
  { name: "person drawer", open: async (page) => { await page.goto(TEAM); await page.locator(`[data-node="${QA}"]:visible`).click(); } },
  { name: "add modal", open: async (page) => { await page.goto(TEAM); await page.locator("[data-add-person]").click(); } },
  { name: "remove dialog", open: async (page) => { await page.goto(TEAM); await page.locator(`[data-node="${FENA}"]:visible`).click(); await page.locator("[data-side-panel] [data-remove]").click(); } },
  // TASK-B-099 (D-094 H-1, H-3, H-4): the folders open from ทีม, the budget from the board's mode bar; the 390 header menu is gone
  { name: "folders dialog", open: async (page) => { await page.goto(TEAM); await page.locator("[data-folders]:visible").first().click(); } },
  { name: "budget dialog", open: async (page) => { await page.goto(BOARD); await page.locator("[data-mode-control]:visible").first().getByRole("radio", { name: mode.dispatcher }).click(); } },
];

test.describe("AC-5 on every open layer, operator-like seed", () => {
  test.use({ seedState: "operator-like" });
  for (const layer of LAYERS) {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      if (layer.only === "mobile" && w >= 768) continue;
      for (const theme of THEMES) {
        test(`@ac5 layer ${layer.name} · ${w} · ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width: w, height: h });
          await storeTheme(page, theme);
          const errors = watchConsole(page);
          await layer.open(page, w);
          const top = page.locator("[role=alertdialog], [role=dialog]").last();
          await expect(top, `${layer.name} did not open`).toBeVisible();
          await top.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => null)))); // measure it at rest
          await page.waitForLoadState("networkidle");
          const root = await top.elementHandle();
          const found = await probeIn(page, root);
          expect(lines(`${layer.name} · ${w} · ${theme}`, found, errors), `${layer.name} · ${w} · ${theme}`).toEqual([]);
        });
      }
    }
  }
});

// ---- the self-test: the probe can fail and can pass (DoD 4) — on pages made in the test, no server data involved ----
test.describe("the AC-5 probe proves itself", () => {
  const BAD = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
    <div style="width:40px;white-space:nowrap">ข้อความที่ยาวกว่ากล่องมากมาย</div>
    <div data-name style="width:150px">ณัฐธิดา วิริยะกุลพัฒนาเลิศ</div>
    <script>console.error("a console error the probe must see")</script>`;
  const CLEAN = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
    <div style="width:200px">ข้อความสั้น</div>
    <div data-name style="width:200px">สมศักดิ์</div>
    <div style="width:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="ข้อความที่ยาวกว่ากล่องมากมาย">ข้อความที่ยาวกว่ากล่องมากมาย</div>`;
  /** `setup` runs in the page after it is set and before it is measured (e.g. to scroll a box) */
  const run = async (page: Page, html: string, setup?: () => void) => {
    const errors = watchConsole(page);
    await page.setContent(html);
    await page.waitForLoadState("load");
    if (setup) await page.evaluate(setup);
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

  // a box cut short on purpose still owes the reader its whole text: in its own title / aria-label, an ancestor's, or what its aria-labelledby points to
  const CUT = (attrs: string, extra = "") => `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">${extra}
    <div ${attrs} style="width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">ณัฐธิดา วิริยะกุลพัฒนาเลิศ</div>`;
  const rulesOf = (found: string[]) => found.map((f) => f.split(" · ")[3]);

  test("@ac5 a name cut with an ellipsis and NO full text anywhere is caught as truncated-no-full-text", async ({ page }) => {
    expect(rulesOf(await run(page, CUT("")))).toEqual(["truncated-no-full-text"]);
  });

  test("@ac5 …and a title that holds only PART of the text is caught too", async ({ page }) => {
    expect(rulesOf(await run(page, CUT('title="ณัฐธิดา"')))).toEqual(["truncated-no-full-text"]);
  });

  test("@ac5 the same cut name passes when its whole text is in its title, its aria-label, an ancestor's title, or an aria-labelledby target", async ({ page }) => {
    const full = "ณัฐธิดา วิริยะกุลพัฒนาเลิศ";
    for (const html of [
      CUT(`title="${full}"`),
      CUT(`aria-label="${full}"`),
      `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><section title="${full}"><div style="width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${full}</div></section>`,
      CUT('aria-labelledby="whole"', `<span id="whole" hidden>${full}</span>`),
    ]) expect(await run(page, html), html.slice(0, 120)).toEqual([]);
  });

  test("@ac5 a box that has an ellipsis but is NOT cut (its text fits) owes nothing", async ({ page }) => {
    expect(await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><div style="width:300px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">สั้น</div>`)).toEqual([]);
  });

  test("@ac5 a line-clamped box is held to the same rule: cut with no full text is caught, with a title it passes", async ({ page }) => {
    const clamp = (attrs: string) => `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px/20px sans-serif"><div ${attrs} style="width:120px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">ข้อความที่ยาวมากพอจะถูกตัดที่บรรทัดที่สองของกล่องนี้แน่นอนเพราะมีตัวอักษรมากมายเกินสองบรรทัดอย่างแน่นอน</div>`;
    expect(rulesOf(await run(page, clamp("")))).toEqual(["truncated-no-full-text"]);
    expect(await run(page, clamp('title="ข้อความที่ยาวมากพอจะถูกตัดที่บรรทัดที่สองของกล่องนี้แน่นอนเพราะมีตัวอักษรมากมายเกินสองบรรทัดอย่างแน่นอน"'))).toEqual([]);
  });

  // a person's name has one "word" for the reader per space-separated part (TASK-B-089): `Intl.Segmenter` splits a compound Thai surname into dictionary words, so a
  // browser that wraps INSIDE the surname used to pass; for `[data-name]` the part itself must stay on one line
  test("@ac5 [data-name]: the browser wrapping INSIDE a compound surname is caught — exactly one thai-broken", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span data-name style="display:block;width:150px">ณัฐธิดา วิริยะกุลพัฒนาเลิศ</span>`);
    expect(rulesOf(out)).toEqual(["thai-broken"]);
  });

  test("@ac5 [data-name]: the same name with each part on one line (nowrap), breaking only at the space, gives 0", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span data-name style="display:block;width:150px"><span style="white-space:nowrap">ณัฐธิดา</span> <span style="white-space:nowrap">วิริยะกุลพัฒนาเลิศ</span></span>`);
    expect(out).toEqual([]);
  });

  test("@ac5 [data-name]: one part longer than its box, cut with an ellipsis that has its whole text in a title, gives 0 (it stays on one line)", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span data-name title="ณัฐธิดาวิริยะกุลพัฒนาเลิศ" style="display:block;width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">ณัฐธิดาวิริยะกุลพัฒนาเลิศ</span>`);
    expect(out).toEqual([]);
  });

  test("@ac5 [data-name]: a name that wraps at its SPACE (the parts each whole on their own line) gives 0 — a space is where a name may break", async ({ page }) => {
    // 70px: "ณัฐธิดา" fits on the first line, "วิริยะ" does not fit beside it, so the break falls at the space and "วิริยะ" is whole on line two
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span data-name style="display:block;width:70px">ณัฐธิดา วิริยะ</span>`); // ONE text node: the parts are separated only by the space
    expect(out).toEqual([]);
    const lines = await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector("[data-name]")!); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; });
    expect(lines, "the test is only meaningful if the name really wraps at the space").toBe(2);
  });

  test("@ac5 [data-name]: the name's SECOND text node is measured too (a name made of several elements): a break inside the surname there is caught", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span data-name style="display:block;width:150px"><b>ณัฐธิดา</b> <i>วิริยะกุลพัฒนาเลิศ</i></span>`);
    expect(rulesOf(out)).toEqual(["thai-broken"]);
  });

  // a part wider than its box on ONE line cannot fit anywhere: it may wrap inside itself as a last resort (polish-plan § 2.4, overflow-wrap:anywhere) — TASK-B-091 Q1.
  // Every part that WOULD fit on one line still must not wrap (the 150 px / 16 px "ณัฐธิดา วิริยะกุลพัฒนาเลิศ" test above: the surname is ~124 px wide on one line).
  test("@ac5 [data-name]: a part WIDER than the box on one line wraps inside itself — allowed (last resort), 0 failures", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px sans-serif"><span data-name style="display:block;width:150px;overflow-wrap:anywhere">มิ้นท์มณีรัตนาภรณ์ วงศ์สวัสดิ์</span>`);
    expect(out).toEqual([]);
    const m = await page.evaluate(() => {
      const el = document.querySelector("[data-name]")!, text = el.firstChild as Text;
      const first = document.createRange(); first.setStart(text, 0); first.setEnd(text, "มิ้นท์มณีรัตนาภรณ์".length);
      const ruler = document.createElement("span"); ruler.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap"; ruler.textContent = "มิ้นท์มณีรัตนาภรณ์"; el.appendChild(ruler);
      const oneLine = ruler.getBoundingClientRect().width; ruler.remove();
      return { lines: new Set([...first.getClientRects()].map((r) => Math.round(r.top))).size, oneLine };
    });
    expect(m.oneLine, "the first part must really be wider than the 150px box").toBeGreaterThan(150);
    expect(m.lines, "…and must really wrap inside itself").toBeGreaterThan(1);
  });

  test("@ac5 [data-name]: the exemption is PER PART — a long part wrapping inside itself does not excuse another part that would fit one line and is broken", async ({ page }) => {
    // the first part is wider than the box (exempt); the 2nd fits on one line in a 150px box but is held in a 40px box so it breaks inside itself
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px sans-serif"><span data-name style="display:block;width:150px;overflow-wrap:anywhere">มิ้นท์มณีรัตนาภรณ์ วงศ์สวัสดิ์</span>`.replace("วงศ์สวัสดิ์</span>", "<span style=\"display:inline-block;width:40px;overflow-wrap:anywhere\">วงศ์สวัสดิ์</span></span>"));
    expect(out.map((f) => f.split(" · ")[3])).toEqual(["thai-broken"]);
  });

  test("@ac5 a name element WITHOUT data-name (the screens' `__name` class) is still measured word by word with Intl.Segmenter: a word cut mid-way is caught", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><span class="x__name" style="display:block;width:30px;word-break:break-all">สมศักดิ์ศรีประเสริฐวงศ์</span>`);
    expect(rulesOf(out)).toEqual(["thai-broken"]);
  });

  // an svg scrolled out of its OWN scroll box is scrolled away, not covered (TASK-B-090): its centre then lies over whatever sits outside the box — a panel head — and
  // `elementsFromPoint` would call that "covered". A sticky bar that really sits on content in view must still be caught.
  const BOX = (inner: string) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
    <header style="height:50px;background:#ddd">head</header>
    <div id="box" style="position:relative;overflow:auto;height:100px;width:200px">${inner}</div>`;
  const SVG = `<svg width="40" height="40" viewBox="0 0 40 40" style="display:block"><circle cx="20" cy="20" r="10" stroke="#000" stroke-width="2" fill="none"/></svg>`;

  test("@ac5 an svg scrolled past the top edge of its scroll box, with a header above the box, gives 0 — scrolled away, not covered", async ({ page }) => {
    const out = await run(page, BOX(`${SVG}<div style="height:400px"></div>`), () => { document.getElementById("box")!.scrollTop = 30; }); // the svg's centre is now 10px above the box
    expect(out).toEqual([]);
    const centre = await page.evaluate(() => { const r = document.querySelector("svg")!.getBoundingClientRect(), b = document.getElementById("box")!.getBoundingClientRect(); return (r.top + r.height / 2) - b.top; });
    expect(centre, "the test is only meaningful if the svg's centre really is above the box").toBeLessThan(0);
  });

  test("@ac5 …and past the BOTTOM edge of its box, with a footer under the box, gives 0 too (the skip is not only for the top)", async ({ page }) => {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="box" style="position:relative;overflow:auto;height:100px;width:200px"><div style="height:400px"></div>${SVG}<div style="height:400px"></div></div><footer style="height:50px;background:#ddd">foot</footer>`;
    const out = await run(page, html, () => { const b = document.getElementById("box")!; b.scrollTop = 400 - 100 + 10; }); // the svg's top is 10px under the box's bottom edge
    expect(out).toEqual([]);
    const centre = await page.evaluate(() => { const r = document.querySelector("svg")!.getBoundingClientRect(), b = document.getElementById("box")!.getBoundingClientRect(); return (r.top + r.height / 2) - b.bottom; });
    expect(centre, "the svg's centre really is below the box").toBeGreaterThan(0);
  });

  test("@ac5 …and past the SIDE edge of a box that scrolls sideways (something beside the box), gives 0", async ({ page }) => {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;display:flex"><aside style="width:200px;height:60px;background:#ddd">side</aside><div id="box" style="overflow:auto;width:100px;height:60px;white-space:nowrap">${SVG.replace('style="display:block"', 'style="display:inline-block"')}<div style="display:inline-block;width:300px;height:10px"></div></div>`;
    const out = await run(page, html, () => { document.getElementById("box")!.scrollLeft = 100; }); // the svg is now left of the box, over the aside
    expect(out).toEqual([]);
    const centre = await page.evaluate(() => { const r = document.querySelector("svg")!.getBoundingClientRect(), b = document.getElementById("box")!.getBoundingClientRect(); return (r.left + r.width / 2) - b.left; });
    expect(centre, "the svg's centre really is left of the box").toBeLessThan(0);
  });

  test("@ac5 the same svg IN view inside the box, with a sticky bar inside the box lying on top of it, is still caught as svg-covered", async ({ page }) => {
    const out = await run(page, BOX(`${SVG}<div style="position:sticky;top:0;height:30px;margin-top:-30px;background:#f00;z-index:2"></div><div style="height:400px"></div>`));
    expect(out.map((f) => f.split(" · ")[3])).toEqual(["svg-covered"]);
  });

  test("@ac5 an svg scrolled past the box edge is NOT excused when it is the box's own overflow that hides nothing: an svg in view with the header overlapping it (no scroll box) is caught", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="position:absolute;left:0;top:0;width:100px;height:100px;background:#f00;z-index:3"></div>
      <svg width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:10px;top:10px"><circle cx="20" cy="20" r="10" stroke="#000" stroke-width="2" fill="none"/></svg>`);
    expect(out.map((f) => f.split(" · ")[3])).toEqual(["svg-covered"]);
  });

  // D-088: while a dialog or sheet is open the probe measures INSIDE it only — the page behind is inert and its overlay is not a defect (TEST-B-004 OD-6)
  test("@ac5 with a dialog open, an overlay over the page behind it gives 0 inside the dialog — and the same page measured whole is flagged (so the root really changes the result)", async ({ page }) => {
    await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
      <svg width="40" height="40" viewBox="0 0 40 40" style="position:absolute;left:20px;top:20px"><circle cx="20" cy="20" r="10" stroke="#000" stroke-width="2" fill="none"/></svg>
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10"></div>
      <div role="dialog" style="position:fixed;left:120px;top:20px;width:240px;background:#fff;z-index:11;padding:8px"><span data-name>สมศักดิ์ วิริยะ</span></div>`);
    const dialog = await page.locator("[role=dialog]").elementHandle();
    expect(await probeIn(page, dialog)).toEqual([]);
    expect((await page.evaluate(probe, NAME_SELECTOR)).map((f) => f.rule)).toEqual(["svg-covered"]);
  });

  test("@ac5 …and a real defect INSIDE the open dialog is still caught (a name broken across lines in a narrow dialog)", async ({ page }) => {
    await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif">
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10"></div>
      <div role="dialog" style="position:fixed;left:20px;top:20px;width:150px;background:#fff;z-index:11"><span data-name style="display:block">ณัฐธิดา วิริยะกุลพัฒนาเลิศ</span></div>`);
    const dialog = await page.locator("[role=dialog]").elementHandle();
    expect((await probeIn(page, dialog)).map((f) => f.rule)).toEqual(["thai-broken"]);
  });

  // an open layer's TITLE is the thing the layer is about (DEF-3: the person drawer at 390 cut the name to "วิริยะกุลพัฒ…"): it must not be truncated. The ellipsis-with-an-accessible-name
  // pass of `truncated-no-full-text` is right for a list row and not enough for a title. Only measured inside an open layer (the title = what `aria-labelledby` names, else its first heading).
  const LAYER = (title: string, boxWidth: number) => `<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px/1.375 sans-serif">
    <div role="dialog" aria-labelledby="t" style="position:fixed;left:0;top:0;width:${boxWidth}px;background:#fff">${title}</div>`;
  const NAME = "ณัฐธิดา วิริยะกุลพัฒนาเลิศ";
  const CUT_PART = `<span style="display:inline-block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom">วิริยะกุลพัฒนาเลิศ</span>`;
  const inLayer = async (page: Page, html: string) => { await page.setContent(html); return (await probeIn(page, await page.locator("[role=dialog]").elementHandle())).map((f) => f.rule); };

  test("@ac5 a layer title with a part cut by an ellipsis is caught as title-cut — even though its whole text is in its own title attribute", async ({ page }) => {
    expect(await inLayer(page, LAYER(`<h2 id="t" title="${NAME}" style="margin:0">ณัฐธิดา ${CUT_PART}</h2>`, 100))).toEqual(["title-cut"]);
  });

  test("@ac5 …and a title clamped to 2 lines with a third line hidden is caught too; the same title with room (whole on its lines) gives 0", async ({ page }) => {
    const clamped = `<h2 id="t" style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">ข้อความหัวเรื่องที่ยาวมากพอจะเกินสองบรรทัดอย่างแน่นอนเพราะมีตัวอักษรมากมายจริงๆ ไม่ต้องสงสัยเลย</h2>`;
    expect(await inLayer(page, LAYER(clamped, 120))).toEqual(["title-cut"]);
    expect(await inLayer(page, LAYER(`<h2 id="t" style="margin:0">ณัฐธิดา วิริยะ</h2>`, 400))).toEqual([]);
  });

  test("@ac5 a title whose parts wrap at the space and are all whole gives 0; a CUT cell elsewhere in the layer (not the title) is left to the other rules", async ({ page }) => {
    expect(await inLayer(page, LAYER(`<h2 id="t" style="margin:0">ณัฐธิดา วิริยะกุลพัฒนาเลิศ</h2>`, 150))).not.toContain("title-cut");
    const other = `<h2 id="t" style="margin:0">หัวเรื่อง</h2><div title="${NAME}" style="width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${NAME}</div>`;
    expect(await inLayer(page, LAYER(other, 300))).toEqual([]);
  });

  test("@ac5 a title clamped to 2 lines that fits in its 2 lines, its line box overshooting by a pixel or two, is NOT cut", async ({ page }) => {
    // 2 lines of 30px in a 61px two-line clamp; an inline-block with a 3px bottom margin makes the 2nd line box 33px, so the content is 63px — nothing is hidden, nothing sticks out
    const fits = `<h2 id="t" style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:30px;height:61px">ณัฐธิดา<br><span style="display:inline-block;height:20px;margin-bottom:3px;vertical-align:baseline">วิริยะ</span></h2>`;
    const found = await inLayer(page, LAYER(fits, 300));
    expect(found).toEqual([]);
    const gap = await page.evaluate(() => { const h = document.getElementById("t")!; return h.scrollHeight - h.clientHeight; });
    expect(gap, "the test is only meaningful if scrollHeight really exceeds clientHeight by a little").toBeGreaterThan(0);
    expect(gap).toBeLessThan(10);
  });

  test("@ac5 the title is the LAYER's, not the page's: a cut heading OUTSIDE the open layer is not title-cut", async ({ page }) => {
    await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px/1.375 sans-serif">
      <h2 style="width:60px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="หัวเรื่องของหน้าที่อยู่ข้างหลังและยาวมาก">หัวเรื่องของหน้าที่อยู่ข้างหลังและยาวมาก</h2>
      <div role="dialog" style="position:fixed;left:200px;top:0;width:300px;background:#fff"><p style="margin:0">เนื้อหาของชั้นที่เปิด</p></div>`);
    expect((await probeIn(page, await page.locator("[role=dialog]").elementHandle())).map((f) => f.rule)).toEqual([]);
  });

  // an inline element's box is the FONT's box (a Thai font's ascent + descent), taller than a tight line box: measured against a clipping parent it overshoots by a few px with nothing cut
  test("@ac5 an inline span whose font box overshoots a tight, overflow-hidden line box by a few px is NOT outside-clip; one that sticks out sideways still is", async ({ page }) => {
    const tight = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px sans-serif"><h2 style="margin:0;width:300px;height:24px;line-height:24px;overflow:hidden"><span>ณัฐธิดา วิริยะ</span></h2>`;
    expect(await run(page, tight)).toEqual([]);
    const wide = `<!doctype html><meta charset="utf-8"><body style="margin:0;font:22px sans-serif"><h2 style="margin:0;width:100px;height:40px;line-height:30px;overflow:hidden;white-space:nowrap"><span>ณัฐธิดาวิริยะกุลพัฒนาเลิศ</span></h2>`;
    expect((await run(page, wide)).map((f) => f.split(" · ")[3])).toContain("outside-clip");
  });

  test("@ac5 a page that scrolls sideways is caught", async ({ page }) => {
    const out = await run(page, `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="width:3000px;height:10px;background:#ccc"></div>`);
    expect(out.map((f) => f.split(" · ")[3])).toContain("page-overflow-x");
  });
});
