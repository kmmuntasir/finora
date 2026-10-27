import { expect, test } from "@playwright/test";
import { mockJellyfin, signIn } from "./mock-jellyfin";

test("redirects to sign-in and shows the server name and disclaimer", async ({ page }) => {
  await mockJellyfin(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("to Test Server")).toBeVisible();
  await expect(page.getByText("Family server — be kind.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use Quick Connect" })).toBeVisible();
});

test("explains a wrong password", async ({ page }) => {
  await mockJellyfin(page);
  await page.goto("/login");
  await page.getByLabel("Username").fill("alex");
  await page.getByRole("textbox", { name: "Password" }).fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong username or password.");
});

test("signs in, survives a reload and signs out", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.goto("/me");
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("picks a user from the avatars and signs in", async ({ page }) => {
  await mockJellyfin(page, { publicUsers: true });
  await page.goto("/login");
  await page.getByRole("button", { name: "Alex" }).click();
  await expect(page.getByText("Not you?")).toBeVisible();
  await page.getByRole("textbox", { name: "Password" }).fill("secret");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
});

test("users without a password sign in with one tap", async ({ page }) => {
  await mockJellyfin(page, { publicUsers: true });
  await page.goto("/login");
  await page.getByRole("button", { name: "Kid" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("resets a forgotten password with the PIN", async ({ page }) => {
  await mockJellyfin(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Username").fill("alex");
  await page.getByRole("button", { name: "Request a PIN" }).click();
  await expect(page.getByText("/config/passwordreset123.json")).toBeVisible();
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alert")).toContainText("didn't match");
  await page.getByLabel("PIN").fill("1A-2B-3C-4D");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Your password is now the PIN")).toBeVisible();
});
