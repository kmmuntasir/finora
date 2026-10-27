import { expect, test } from "@playwright/test";
import { signIn } from "./mock-jellyfin";

test("home shows continue watching and recently added", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recently added in Movies" })).toBeVisible();
  await expect(page.getByText("40 min left").or(page.getByText("36 min left"))).toBeVisible();
});

test("library grid, filters and detail page", async ({ page }) => {
  await signIn(page);
  await page.goto("/libraries/view-movies");
  await expect(page.getByText("30 movies")).toBeVisible();
  // Bengali titles render (SolaimanLipi covers both scripts).
  await expect(page.getByText("অতিথী Otithi").first()).toBeVisible();
  await page.getByRole("button", { name: "Unwatched" }).click();
  await expect(page).toHaveURL(/filter=unplayed/);
  await page.getByText("Movie 03").first().click();
  await expect(page).toHaveURL(/\/items\/movie3$/);
  await expect(page.getByRole("heading", { name: "Movie 03" })).toBeVisible();
  await expect(page.getByText("Jane Actor").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("search finds items as you type", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search" }).fill("movie 1");
  await expect(page.getByRole("heading", { name: /Movies \(\d+\)/ })).toBeVisible();
  await expect(page.getByText("Movie 12")).toBeVisible();
});
