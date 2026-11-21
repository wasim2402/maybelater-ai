import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium, expect, test } from "@playwright/test";

/**
 * Notifications end to end, with real Chrome and the real push service: turn notifications on (the
 * browser permission is granted up front), see the device, send a test push, keep the chime setting,
 * turn notifications off. Push doesn't work in incognito, so this uses a throwaway normal profile.
 * Needs the API to have VAPID keys (scripts/generate_vapid_keys.py). Desktop project only.
 */

test("turn notifications on, test them, turn them off", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one real browser profile is enough");
  test.setTimeout(180_000);
  const profile = mkdtempSync(join(tmpdir(), "ml-e2e-push-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
  });
  try {
    await context.grantPermissions(["notifications"], { origin: "http://localhost:3000" });
    const page = await context.newPage();
    const password = "correct horse battery";

    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name").fill("Push Tester");
    await page.getByLabel("Email").fill(`e2e-push-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create my account" }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

    await page.goto("/app/settings");
    const section = page.getByRole("region", { name: "Notifications" });
    await section.getByRole("button", { name: "Turn on notifications" }).click();
    await expect(section.getByText("On. Reminders will show up as notifications on this device.")).toBeVisible({ timeout: 30_000 });
    await expect(section.getByRole("list", { name: "Devices with notifications on" }).getByRole("listitem")).toHaveCount(1);

    await section.getByRole("button", { name: "Send a test notification" }).click();
    await expect(page.getByText("Test notification sent.")).toBeVisible({ timeout: 30_000 });

    await section.getByLabel(/Play a chime in the app/).uncheck();
    await expect(section.getByLabel(/Play a chime in the app/)).not.toBeChecked();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByRole("region", { name: "Notifications" }).getByLabel(/Play a chime in the app/)).not.toBeChecked();

    await page.getByRole("region", { name: "Notifications" }).getByRole("button", { name: "Turn off on this device" }).click();
    await expect(page.getByRole("region", { name: "Notifications" }).getByText("Off on this device.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("list", { name: "Devices with notifications on" })).toHaveCount(0);

    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("dialog").getByLabel("Password").fill(password);
    await page.getByRole("dialog").getByRole("button", { name: "Delete everything" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
