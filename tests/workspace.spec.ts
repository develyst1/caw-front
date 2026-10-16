// The folders the team may write in (TASK-B-043, SPEC-A-008 v1.1) on the mock: the header's warning while there are none, the dialog,
// a path the rules refuse, add and remove. Leaves the project as it found it (no folders).
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { workspace } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;
const warning = (page: import("@playwright/test").Page) => page.locator("header [role=status]");
const open = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: new RegExp(workspace.heading) }).click();
  return page.getByRole("dialog");
};

test("with no folders the header says so — on the board and on the runs page", async ({ page }) => {
  for (const url of [BOARD, `${BOARD}/runs`]) {
    await page.goto(url);
    await expect(warning(page), url).toHaveText(workspace.none);
  }
});

test("a path the rules refuse answers with the field's hint and adds nothing: relative, a `..` segment", async ({ page }) => {
  await page.goto(BOARD);
  const dialog = await open(page);
  await expect(page.getByRole("dialog", { name: workspace.heading })).toBeVisible(); // the dialog is named by its title
  for (const bad of ["relative/path", "/Users/me/../you", "~/repo"]) {
    await dialog.getByRole("textbox").fill(bad);
    await dialog.getByRole("button", { name: workspace.add }).click();
    await expect(dialog.getByRole("alert"), bad).toHaveText(workspace.hint);
    await expect(dialog.locator("[data-root]"), bad).toHaveCount(0);
  }
  await expect(warning(page)).toHaveText(workspace.none);
});

test("add a folder: it is listed, the warning goes, it survives a reload; a repeat is refused; remove brings the warning back", async ({ page }) => {
  await page.goto(BOARD);
  let dialog = await open(page);
  await dialog.getByRole("textbox").fill("/Users/me/my-repo");
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.locator("[data-root]")).toHaveText(new RegExp("/Users/me/my-repo"));
  await expect(dialog.getByRole("textbox")).toHaveValue("");
  await expect(warning(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(workspace.heading) })).toContainText("(1)");

  await dialog.getByRole("textbox").fill("/Users/me/my-repo");                       // the same again
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.getByRole("alert")).toHaveText(workspace.hint);
  await expect(dialog.locator("[data-root]")).toHaveCount(1);

  await page.reload();
  await expect(warning(page)).toHaveCount(0);
  dialog = await open(page);
  await expect(dialog.locator("[data-root]")).toHaveCount(1);
  await dialog.getByRole("button", { name: workspace.remove }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(0);
  await expect(warning(page)).toHaveText(workspace.none);
});

test("keyboard: the dialog opens from its button, the field takes Enter, Escape closes it", async ({ page }) => {
  await page.goto(BOARD);
  const trigger = page.getByRole("button", { name: new RegExp(workspace.heading) });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("/Users/me/kb-repo");
  await page.keyboard.press("Enter");
  await expect(dialog.locator("[data-root]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const again = await open(page);
  await again.getByRole("button", { name: workspace.remove }).click();   // leave it as found
  await expect(again.locator("[data-root]")).toHaveCount(0);
});

test("@390: the warning and the folder dialog fit the screen, nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BOARD);
  await expect(warning(page)).toHaveText(workspace.none);
  const dialog = await open(page);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
});

// TASK-B-065 (A-P6, words PM 2026-10-16): removing a folder acts at once and offers เลิกทำ, which puts it back.
test("removing a folder offers เลิกทำ, which puts it back", async ({ page }) => {
  const { undo } = await import("../src/words");
  await page.goto(BOARD);
  const dialog = await open(page);
  await dialog.getByRole("textbox").fill("/Users/me/repo");
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(1);
  await dialog.locator("[data-root]").getByRole("button", { name: workspace.remove }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(0);
  await expect(dialog.locator("[data-undo-toast]")).toContainText(undo.folderRemoved("/Users/me/repo"));
  await dialog.getByRole("button", { name: undo.button }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(1);
});
