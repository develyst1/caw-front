// The seam end to end: the page asks `CawApi` (the mock) and shows the project's name.
import { expect, test } from "./fixtures";

test("/ lists the mock project by name, under the section word", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "โปรเจกต์" })).toBeVisible();
  await expect(page.getByText("จองห้องประชุม").first()).toBeVisible();
});
