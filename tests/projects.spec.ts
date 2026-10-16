// The projects list and the start-project page (TASK-B-040, REQ-011 R1), on the mock (each test starts from its seed).
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { mode, projectCard, sampleData, section, startRefused } from "../src/words";

const BP = "11111111-2222-4333-8444-555555555555"; // the one Blueprint project the mock knows

test("/ lists the project: name, Blueprint version, mode, cards done of all, stuck — and the card opens its board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: section.projects })).toBeVisible();
  const card = page.locator("ul a").first();
  await expect(card.getByRole("heading", { level: 2, name: "จองห้องประชุม" })).toBeVisible();
  await expect(card).toContainText(projectCard.blueprintVersion(3));
  await expect(card).toContainText(mode.manual);
  await expect(card).toContainText(projectCard.done(3, 12));
  // C2 (TASK-B-074): the home's stuck number is the board's stuck column (was the core's stuckCount, 4) — the same-number check is in project-screen.spec
  await expect(card).toContainText(/ติดอยู่ \d+/);
  const bar = card.getByRole("progressbar");
  expect([await bar.getAttribute("aria-valuenow"), await bar.getAttribute("aria-valuemax")]).toEqual(["3", "12"]);
  await card.click();
  await expect(page).toHaveURL(`/p/${MOCK_PROJECT_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "จองห้องประชุม" })).toBeVisible();
});

test("the body has no browser margin on the projects page, the start page and a board (the white frame is gone)", async ({ page }) => {
  for (const url of ["/", "/start?project=x", `/p/${MOCK_PROJECT_ID}`]) {
    await page.goto(url);
    expect(await page.evaluate(() => getComputedStyle(document.body).margin), url).toBe("0px");
  }
});

test("the card is a real link: reachable by keyboard, a focus ring, ≥ 44 px tall", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("ul a").first();
  await card.focus();
  expect(await card.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

for (const [vw, vh] of [[1440, 900], [390, 844]] as const) {
  test(`@${vw}: / and /start do not scroll sideways`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh });
    for (const url of ["/", "/start"]) {
      await page.goto(url);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), url).toBe(true);
    }
  });
}

test("/start for a Blueprint version that already has a project goes to that project's board (409 already_exists)", async ({ page }) => {
  await page.goto(`/start?project=${BP}&version=3`);
  await expect(page).toHaveURL(`/p/${MOCK_PROJECT_ID}`);
});

test("/start says why it cannot start, in words, with the way back — unknown Blueprint project, unconfirmed version, incomplete link", async ({ page }) => {
  const cases: [string, string][] = [
    ["/start?project=nope&version=1", sampleData], // D-058: on sample data the mock cannot know real Blueprint projects
    [`/start?project=${BP}&version=99`, startRefused.version_not_confirmed],
    [`/start?project=${BP}`, startRefused.incomplete],
    ["/start?version=3", startRefused.incomplete],
    [`/start?project=${BP}&version=abc`, startRefused.incomplete],
  ];
  for (const [url, words] of cases) {
    await page.goto(url);
    await expect(page.locator("main [role=alert]"), url).toHaveText(new RegExp(words));
    await expect(page.getByRole("link", { name: section.projects }), url).toBeVisible();
  }
  await page.getByRole("link", { name: section.projects }).click();
  await expect(page).toHaveURL("/");
});

test("/start for ANOTHER version of a Blueprint project that already has a project goes to that project, and the list keeps one row (v1.15: one project per Blueprint project)", async ({ page }) => {
  await page.goto(`/start?project=${BP}&version=4`); // a confirmed version, but not the one the project was made from
  await expect(page).toHaveURL(`/p/${MOCK_PROJECT_ID}`);
  await page.goto("/");
  await expect(page.locator("ul a")).toHaveCount(1);
  await page.goto(`/start?project=${BP}&version=4`); // again: the same project, never a second one
  await expect(page).toHaveURL(`/p/${MOCK_PROJECT_ID}`);
  await page.goto("/");
  await expect(page.locator("ul a")).toHaveCount(1);
});
