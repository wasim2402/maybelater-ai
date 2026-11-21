import { expect, test } from "@playwright/test";

/**
 * Capture to inbox, end to end against the real web app, API and database:
 * empty inbox -> save a link -> it appears -> duplicate is recognised -> save a note ->
 * open, edit and keep the edits -> mark done (moves to Done) -> delete.
 */
test("capture to inbox", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `e2e-capture-${Date.now()}@example.com`;
  const toast = (text: string) => page.getByRole("region", { name: /Notifications/ }).getByText(text);

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Capture Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Empty inbox with a direct capture action.
  await expect(page.getByText("Your inbox is empty")).toBeVisible();
  await page.getByRole("button", { name: "Save your first link or thought" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Link or thought").fill("https://example.com/sourdough-guide?utm_source=newsletter");
  await expect(dialog.getByText("Saving as a link")).toBeVisible();
  await dialog.getByRole("button", { name: /Save for later/ }).click();
  await expect(toast("Saved to your inbox.")).toBeVisible();
  const list = page.getByRole("list", { name: "Saved items" });
  await expect(list.getByRole("link", { name: "example.com/sourdough-guide" })).toBeVisible();

  // The same link again (tracking parameter differs) is recognised, not duplicated.
  await page.getByRole("button", { name: "Save something" }).first().click();
  await page.getByRole("dialog").getByLabel("Link or thought").fill("https://EXAMPLE.com/sourdough-guide");
  await page.getByRole("dialog").getByRole("button", { name: /Save for later/ }).click();
  await expect(toast("That link is already in your inbox.")).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(1);

  // A text thought.
  await page.getByRole("button", { name: "Save something" }).first().click();
  await page.getByRole("dialog").getByLabel("Link or thought").fill("Try the ramen place Ana mentioned");
  await page.getByRole("dialog").getByRole("button", { name: /Save for later/ }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText("Try the ramen place Ana mentioned"); // newest first

  // Open the link, edit it, and the edit sticks after a reload.
  await list.getByRole("link", { name: "example.com/sourdough-guide" }).click();
  await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 }); // a dev server compiles the route on first visit
  await expect(page.getByRole("heading", { level: 1, name: "example.com/sourdough-guide" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open original" })).toHaveAttribute("href", "https://example.com/sourdough-guide?utm_source=newsletter");
  await page.getByLabel("Title").fill("Sourdough starter guide");
  await page.getByLabel("Why you saved it").fill("For a weekend bake");
  await page.getByLabel("Category").selectOption({ label: "Food and cooking" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Sourdough starter guide" })).toBeVisible();
  await expect(page.getByLabel("Why you saved it")).toHaveValue("For a weekend bake");

  // Mark done: it leaves Open and shows under Done.
  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(toast("Marked as done.")).toBeVisible();
  await page.getByRole("link", { name: "Inbox" }).first().click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/status=completed/);
  await expect(list.getByRole("link", { name: "Sourdough starter guide" })).toBeVisible();

  // Delete it from the row menu.
  await page.getByRole("button", { name: "Actions for Sourdough starter guide" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("Nothing marked as done yet")).toBeVisible();

  // Clean up the account.
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByLabel("Password").fill("correct horse battery");
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
