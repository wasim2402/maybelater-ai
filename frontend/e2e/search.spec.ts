import { expect, test, type Page } from "@playwright/test";

/**
 * Organise and search, end to end: search as you type (debounced), filters combine and live in the
 * URL, opening an item and coming back keeps the search, a no-results state with a clear action,
 * and a category of your own created from the item page.
 */

async function save(page: Page, text: string) {
  await page.getByRole("button", { name: "Save something" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Link or thought").fill(text);
  await dialog.getByRole("button", { name: /Save for later/ }).click();
  await expect(dialog).toBeHidden();
}

test("search, filter and organise", async ({ page }) => {
  test.setTimeout(150_000);
  const password = "correct horse battery";
  const list = page.getByRole("list", { name: "Saved items" });

  await page.goto("/signup");
  await page.waitForLoadState("networkidle"); // a dev server may still be compiling: let the page hydrate first
  await page.getByLabel("Name").fill("Search Tester");
  await page.getByLabel("Email").fill(`e2e-search-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  await save(page, "Lemon drizzle cake recipe for Saturday");
  await save(page, "Lemon grove walk near Sorrento");
  await save(page, "Book the dentist in January");
  await expect(list.getByRole("listitem")).toHaveCount(3);

  // Search as you type: the URL follows after a short pause, and every word must match.
  const search = page.getByLabel("Search saved items");
  await search.fill("lemon");
  await expect(page).toHaveURL(/q=lemon/);
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await search.fill("lemon cak");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Lemon drizzle cake recipe");

  // Open the result and come back: the search is still there.
  await list.getByRole("link", { name: /Lemon drizzle cake/ }).click();
  await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 });

  // Organise: a category of my own, and a tag.
  const details = page.getByRole("region", { name: "Details" });
  await details.getByLabel("Category").selectOption("__new__");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Baking projects");
  await dialog.getByRole("button", { name: "Create category" }).click();
  await expect(dialog).toBeHidden();
  await expect(details.getByLabel("Category")).toHaveValue(/.+/);
  await details.getByLabel("Tags").fill("baking, weekend");
  await details.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Inbox" }).first().click();
  await expect(page).toHaveURL(/q=lemon\+cak|q=lemon%20cak/);
  await expect(page.getByLabel("Search saved items")).toHaveValue("lemon cak");
  await expect(list.getByRole("listitem")).toHaveCount(1);

  // Filters combine with the search and live in the URL.
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await page.getByLabel("Tag").selectOption("baking");
  await expect(page).toHaveURL(/tag=baking/);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Tag").selectOption("");
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Baking projects" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Category", { exact: true }).selectOption("none");
  await expect(list.getByRole("listitem")).toHaveCount(2);

  // Reloading keeps the view.
  await page.reload();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("none");
  await expect(list.getByRole("listitem")).toHaveCount(2);

  // No results: a clear message and a way out.
  await page.getByLabel("Search saved items").fill("zeppelin");
  await expect(page.getByText("Nothing matches “zeppelin”")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).last().click();
  await expect(list.getByRole("listitem")).toHaveCount(3);

  // Clean up the account.
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByLabel("Password").fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
