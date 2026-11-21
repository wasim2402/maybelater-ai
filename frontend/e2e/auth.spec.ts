import { expect, test, type Page } from "@playwright/test";

/**
 * End to end, against the real web app, API and database (both servers running):
 * sign up -> session survives refresh -> API knows the user -> settings persist -> sign out ->
 * protected pages redirect -> wrong password rejected vaguely -> sign in -> delete account.
 */

const password = "correct horse battery";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("an unauthenticated visitor is sent to sign in, then back", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings/);
});

test("the full account journey", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail();
  await signUp(page, email);

  // The page reads the account from FastAPI with a verified token.
  await expect(page.getByText("Signed in as Test Person")).toBeVisible();

  // The session survives a refresh.
  await page.reload();
  await expect(page.getByText("Signed in as Test Person")).toBeVisible();

  // Settings persist through the API.
  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Display name").fill("Ana Tester");
  await page.getByLabel("Time zone").selectOption("Europe/Berlin");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Ana Tester");
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Berlin");

  // Sign out: protected pages redirect again.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out/);
  await expect(page.getByText("You are signed out.")).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);

  // A wrong password gets a vague message (no hint whether the email exists).
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password did not match. Try again.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email); // input kept

  // Signing up again with the same email does not confirm the account exists either.
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Someone");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("another long password");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText(/We could not create an account with those details/)).toBeVisible();

  // Sign in for real.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Signed in as Ana Tester")).toBeVisible();

  // Delete the account: a wrong password deletes nothing; the right one deletes everything.
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Password").fill("wrong password here");
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(dialog.getByText("That password did not match. Nothing was deleted.")).toBeVisible();
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // The account is gone: signing in fails (or the sign-in rate limit, 5 a minute, answers first).
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/That email and password did not match|Too many attempts/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
