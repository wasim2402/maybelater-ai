import { expect, test, type Page } from "@playwright/test";

/**
 * Reminders end to end with the real clock and the server's worker: set a reminder two minutes ahead
 * (explicitly confirmed), see it under "Coming up", wait for the server to deliver it with no help from
 * the page, mark it done; set and cancel another; save quiet hours. Slow by nature.
 */

/** The wall-clock parts of `instant` on `timeZone`'s clock. */
function wallClock(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return parts as Record<"year" | "month" | "day" | "weekday" | "hour" | "minute", string>;
}

async function saveItem(page: Page, text: string) {
  await page.getByRole("button", { name: "Save something" }).first().click();
  await page.getByRole("dialog").getByLabel("Link or thought").fill(text);
  await page.getByRole("dialog").getByRole("button", { name: /Save for later/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

async function openItem(page: Page, name: string) {
  await page.goto("/app");
  await page.getByRole("list", { name: "Saved items" }).getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/app\/items\//, { timeout: 30_000 });
}

test("a confirmed reminder is delivered by the server, then handled", async ({ page }) => {
  test.setTimeout(300_000);
  const password = "correct horse battery";

  await page.goto("/signup");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Reminder Tester");
  await page.getByLabel("Email").fill(`e2e-reminders-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  await saveItem(page, "Call the bike shop about the brakes");
  await saveItem(page, "Renew the library card");

  // Set a reminder two minutes ahead, on the user's clock.
  await openItem(page, "Call the bike shop about the brakes");
  const panel = page.getByRole("region", { name: "Reminder", exact: true });
  await panel.getByRole("button", { name: "Set a reminder" }).click();
  const zone = (await panel.getByText(/Times are in /).textContent())!.match(/Times are in (\S+?)\.?$/)![1];
  const target = new Date(Math.ceil((Date.now() + 2 * 60_000) / 60_000) * 60_000);
  const at = wallClock(target, zone);
  await panel.getByRole("button", { name: "Pick a day" }).click();
  await page.getByRole("button", { name: new RegExp(`${at.weekday}, ${at.month} ${at.day}(st|nd|rd|th), ${at.year}`) }).click();
  await page.keyboard.press("Escape");
  await panel.getByLabel("Time").fill(`${at.hour}:${at.minute}`);
  await expect(panel.getByText(/You'll be reminded on/)).toContainText(`at ${at.hour}:${at.minute}`);
  await panel.getByRole("button", { name: "Set reminder" }).click();
  await expect(panel.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(panel.getByText(/You'll be reminded on/)).toBeVisible();

  // It waits under "Coming up".
  await page.getByRole("link", { name: /Reminders/ }).first().click();
  await expect(page.getByRole("list", { name: "Upcoming reminders" }).getByRole("link", { name: /bike shop/ })).toBeVisible();
  await expect(page.getByText("Nothing due.", { exact: false })).toBeVisible();

  // Delivered by the server's worker (no page involvement), then marked done.
  await page.goto("/app/resurfaced"); // away from the page: nothing here drives delivery
  await page.waitForTimeout(Math.max(0, target.getTime() - Date.now()) + 30_000);
  await page.goto("/app/reminders");
  const due = page.getByRole("list", { name: "Due reminders" });
  await expect(due.getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
  await expect(due).toContainText("Call the bike shop about the brakes");
  await expect(page.getByRole("link", { name: /Reminders\s*1/ }).first()).toBeVisible();
  await due.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Nothing due.", { exact: false })).toBeVisible();

  // A second reminder from a preset, then cancelled before it is due.
  await openItem(page, "Renew the library card");
  await panel.getByRole("button", { name: "Set a reminder" }).click();
  await panel.getByRole("radio", { name: /Tomorrow morning/ }).click();
  await panel.getByRole("button", { name: "Set reminder" }).click();
  await expect(panel.getByText(/You'll be reminded on/)).toContainText("09:00");
  await page.getByRole("link", { name: /Reminders/ }).first().click();
  await page.getByRole("button", { name: "Cancel reminder for Renew the library card" }).click();
  await expect(page.getByText("No reminders set")).toBeVisible();

  // Quiet hours persist.
  await page.goto("/app/settings");
  await page.getByLabel(/Quiet hours/).check();
  await page.getByLabel("From").fill("21:30");
  await page.getByRole("button", { name: "Save reminder settings" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("From")).toHaveValue("21:30");

  // Clean up the account.
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByLabel("Password").fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});
