import { expect, test } from "@playwright/test";

/**
 * Resurfacing end to end with the real clock: pick a time a minute or two ahead, wait for it, see the
 * item under Resurfaced with its reason, snooze another one away, open the first (it leaves the
 * list), and save resurfacing settings. Slow by nature (it waits for real time to pass).
 */

function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("items come back when chosen, and leave when handled", async ({ page }) => {
  test.setTimeout(240_000);
  const password = "correct horse battery";

  await page.goto("/signup");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Resurface Tester");
  await page.getByLabel("Email").fill(`e2e-resurface-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  // Nothing yet.
  await page.getByRole("link", { name: /Resurfaced/ }).first().click();
  await expect(page.getByText("Nothing to look at again right now")).toBeVisible({ timeout: 30_000 });

  // Save two items and ask for both back in a moment.
  const comeBackAt = new Date(Date.now() + 2 * 60_000);
  for (const text of ["Try the ramen place near the station", "Compare rain jackets"]) {
    await page.getByRole("button", { name: "Save something" }).first().click();
    await page.getByRole("dialog").getByLabel("Link or thought").fill(text);
    await page.getByRole("dialog").getByRole("button", { name: /Save for later/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await page.goto("/app");
  for (const name of ["Try the ramen place near the station", "Compare rain jackets"]) {
    await page.getByRole("list", { name: "Saved items" }).getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 });
    await page.getByRole("button", { name: "Pick a date and time" }).click();
    await page.getByLabel("Date and time").fill(localInput(comeBackAt));
    await page.getByRole("button", { name: "Set day" }).click();
    await expect(page.getByText(/It will come back to Resurfaced on/)).toBeVisible();
    await page.getByRole("link", { name: "Inbox" }).first().click();
    await expect(page.getByRole("list", { name: "Saved items" }).getByText(/^Back /).first()).toBeVisible();
  }

  // Wait for the chosen time to pass, then both appear with their reason.
  await page.waitForTimeout(Math.max(0, comeBackAt.getTime() - Date.now()) + 5_000);
  await page.goto("/app/resurfaced");
  const list = page.getByRole("list", { name: "Resurfaced items" });
  await expect(list.getByRole("listitem")).toHaveCount(2, { timeout: 15_000 });
  await expect(list.getByText("You asked to see this again today.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Resurfaced\s*2/ }).first()).toBeVisible();

  // Snooze one away.
  const jackets = list.getByRole("listitem").filter({ hasText: "Compare rain jackets" });
  await jackets.getByRole("button", { name: "Snooze" }).click();
  await page.getByRole("menuitem", { name: "Next week" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);

  // Open the other: once looked at, it leaves the list.
  await list.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ramen");
  await page.getByRole("link", { name: /Resurfaced/ }).first().click();
  await expect(page.getByText("Nothing to look at again right now")).toBeVisible({ timeout: 15_000 });

  // Resurfacing settings persist.
  await page.goto("/app/settings");
  await page.getByLabel("Bring back items I haven't looked at").selectOption("30");
  await page.getByRole("button", { name: "Save resurfacing settings" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Bring back items I haven't looked at")).toHaveValue("30");

  // Clean up the account.
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByLabel("Password").fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
