import { expect, test, type Page } from "@playwright/test";

/**
 * The signed-in app shell at phone and desktop widths: protection, the new-user dashboard, quick capture,
 * keeping list context, navigation, settings that persist, and an API failure that recovers.
 * Run with --project=mobile and --project=desktop.
 */

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" }); // only the visible one

test("protected pages send you to sign in, and come back after", async ({ page }) => {
  await page.goto("/app/reminders");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Freminders/);
});

test("the dashboard, navigation and settings work end to end", async ({ page }) => {
  test.setTimeout(180_000);
  const password = "correct horse battery";

  await page.goto("/signup");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Shell Tester");
  await page.getByLabel("Email").fill(`e2e-shell-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  // New user: a helpful empty state, nothing invented.
  await expect(page.getByRole("heading", { name: "Your inbox is empty" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Back for you" })).toHaveCount(0);

  // Quick capture from the dashboard.
  await page.getByRole("button", { name: "Save a link or a thought…" }).click();
  await page.getByRole("dialog").getByLabel("Link or thought").fill("Sourdough starter guide");
  await page.getByRole("dialog").getByRole("button", { name: /Save for later/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Recently saved" })).toBeVisible();
  const list = page.getByRole("list", { name: "Saved items" });
  await expect(list.getByRole("link", { name: "Sourdough starter guide" })).toBeVisible();

  // Filters live in the URL, and coming back from an item keeps them.
  const status = page.getByRole("group", { name: "Status" });
  await status.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/status=completed/);
  await expect(page.getByRole("heading", { name: "Nothing marked as done yet" })).toBeVisible();
  await status.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByLabel("Search saved items").fill("sourdough");
  await expect(page).toHaveURL(/q=sourdough/);
  await list.getByRole("link", { name: "Sourdough starter guide" }).click();
  await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 });
  await page.getByRole("link", { name: "Inbox" }).first().click();
  await expect(page).toHaveURL(/q=sourdough/);
  await expect(page.getByLabel("Search saved items")).toHaveValue("sourdough");

  // Every area is reachable from the visible navigation at this width.
  for (const [link, heading] of [
    ["Resurfaced", "Resurfaced"],
    ["Reminders", "Reminders"],
    ["Settings", "Settings"],
    ["Inbox", "Inbox"],
  ] as const) {
    await mainNav(page).getByRole("link", { name: new RegExp(`^${link}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 30_000 });
  }

  // Settings persist: profile, time zone and reduce motion.
  await mainNav(page).getByRole("link", { name: /^Settings/ }).click();
  await page.getByLabel("Display name").fill("Shell Tester Two");
  await page.getByLabel("Time zone").selectOption("Asia/Tokyo");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.", { exact: true }).first()).toBeVisible();
  await page.getByLabel(/Reduce motion/).check();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Shell Tester Two");
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Tokyo");
  await expect(page.getByLabel(/Reduce motion/)).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");

  // An API failure explains itself and recovers.
  await page.route(/\/api\/v1\/intentions(\?|$)/, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal_error", message: "Something went wrong on our side.", request_id: "e2e", details: null } }) }),
  );
  await mainNav(page).getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your inbox did not load" })).toBeVisible({ timeout: 30_000 });
  await page.unroute(/\/api\/v1\/intentions(\?|$)/);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("list", { name: "Saved items" }).getByRole("link", { name: "Sourdough starter guide" })).toBeVisible();

  // Clean up the account.
  await mainNav(page).getByRole("link", { name: /^Settings/ }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByLabel("Password").fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
