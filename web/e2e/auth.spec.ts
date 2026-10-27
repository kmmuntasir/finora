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
