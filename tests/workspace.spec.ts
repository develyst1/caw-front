// The folders the team may write in (TASK-B-043, SPEC-A-008 v1.1) on the mock: ทีม's folders row (TASK-B-099, D-094 H-3 / T-4 — they left the
// header, and so did its warning bar, H-5), the dialog, a path the rules refuse, add and remove. Leaves the project as it found it (no folders).
import { expect, test } from "./fixtures";
import { MOCK_PROJECT_ID } from "../src/api/mock";
import { folderEdit, folderKind, missing, workspace } from "../src/words";

const BOARD = `/p/${MOCK_PROJECT_ID}`;
const TEAM = `${BOARD}/team`;
const row = (page: import("@playwright/test").Page) => page.locator("[data-folders-row]");
const open = async (page: import("@playwright/test").Page) => {
  await row(page).getByRole("button", { name: new RegExp(workspace.heading) }).click();
  return page.getByRole("dialog", { name: workspace.heading });
};

test("the header has no folders and no warning bar, on every project screen (H-3, H-5); ทีม's row says there are none", async ({ page }) => {
  for (const url of [BOARD, `${BOARD}/runs`, `${BOARD}/chat`, TEAM]) {
    await page.goto(url);
    await expect(page.locator("header [data-folders]"), url).toHaveCount(0);
    await expect(page.locator("header [role=status]"), url).toHaveCount(0);
  }
  await expect(row(page)).toContainText(workspace.heading);
  await expect(row(page)).toContainText(workspace.none);
  await expect(row(page).getByRole("button", { name: new RegExp(workspace.heading) })).toHaveText(folderEdit);
});

test("ทีม's readiness fix for the folders opens the same dialog", async ({ page }) => {
  await page.goto(TEAM);
  await page.locator('[data-check="folder"] [data-fix]').filter({ hasText: missing.folder.fix }).click();
  await expect(page.getByRole("dialog", { name: workspace.heading })).toBeVisible();
});

test("a path the rules refuse answers with the field's hint and adds nothing: relative, a `..` segment", async ({ page }) => {
  await page.goto(TEAM);
  const dialog = await open(page);
  await expect(dialog).toBeVisible(); // the dialog is named by its title
  for (const bad of ["relative/path", "/Users/me/../you", "~/repo"]) {
    await dialog.getByRole("textbox").fill(bad);
    await dialog.getByRole("button", { name: workspace.add }).click();
    await expect(dialog.getByRole("alert"), bad).toHaveText(workspace.hint);
    await expect(dialog.locator("[data-root]"), bad).toHaveCount(0);
  }
});

test("add a folder: it is listed in the dialog and on ทีม's row, it survives a reload; a repeat is refused; remove brings the none line back", async ({ page }) => {
  await page.goto(TEAM);
  let dialog = await open(page);
  await dialog.getByRole("textbox").fill("/Users/me/my-repo");
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.locator("[data-root]")).toHaveText(new RegExp("/Users/me/my-repo"));
  await expect(dialog.getByRole("textbox")).toHaveValue("");
  // the Radix dialog is modal — the page behind it is aria-hidden while it is open, so the row is read by its attribute
  await expect(page.locator("[data-folder-path]")).toHaveText(["my-repo"]); // D-098 (TASK-B-104): the row shows the folder's name; the dialog keeps the path
  await expect(page.locator("[data-folder-path]")).toHaveAttribute("title", "/Users/me/my-repo");

  await dialog.getByRole("textbox").fill("/Users/me/my-repo");                       // the same again
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.getByRole("alert")).toHaveText(workspace.hint);
  await expect(dialog.locator("[data-root]")).toHaveCount(1);

  await page.reload();
  await expect(row(page)).not.toContainText(workspace.none);
  dialog = await open(page);
  await expect(dialog.locator("[data-root]")).toHaveCount(1);
  await dialog.getByRole("button", { name: workspace.remove }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(0);
  await expect(page.locator("[data-folders-row]")).toContainText(workspace.none);
});

test("keyboard: the dialog opens from its button, the field takes Enter, Escape closes it", async ({ page }) => {
  await page.goto(TEAM);
  const trigger = row(page).getByRole("button", { name: new RegExp(workspace.heading) });
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

test("@390: the folders row and the dialog fit the screen, nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TEAM);
  await expect(row(page)).toContainText(workspace.none);
  const dialog = await open(page);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
});

// D-099 / D-100 (TASK-B-108): each folder is เขียนได้ or อ่านได้อย่างเดียว — chosen when adding, switched on its row, kept across a reload, gone with the folder
test("add a folder as read-only → ทีม's row tags it, after a reload too; switch it to writable; remove it and its tag goes", async ({ page }) => {
  await page.goto(TEAM);
  let dialog = await open(page);
  await expect(dialog.locator("[data-kind-help]")).toHaveText(folderKind.help);
  await dialog.getByRole("textbox").fill("/Users/me/spec-repo");
  await dialog.locator("form [data-kind-toggle]").getByRole("radio", { name: folderKind.readOnly }).click();
  await dialog.getByRole("button", { name: workspace.add }).click();
  await expect(dialog.locator('[data-root][data-read-only="true"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(row(page).locator('[data-folder-kind="read-only"]')).toHaveText(folderKind.readOnly);

  dialog = await open(page);
  await dialog.locator("[data-root] [data-kind-toggle]").getByRole("radio", { name: folderKind.writable }).click();
  await expect(dialog.locator('[data-root][data-read-only="false"]')).toHaveCount(1);
  await expect(row(page).locator('[data-folder-kind="writable"]')).toHaveCount(1);

  await dialog.locator("[data-root] [data-kind-toggle]").getByRole("radio", { name: folderKind.readOnly }).click();
  await expect(dialog.locator('[data-root][data-read-only="true"]')).toHaveCount(1);
  await dialog.getByRole("button", { name: workspace.remove }).click();
  await expect(dialog.locator("[data-root]")).toHaveCount(0);
  await expect(page.locator("[data-folder-kind]")).toHaveCount(0);
});
