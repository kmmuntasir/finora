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

test("a card's play button plays; the rest of the card opens details", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "Hover only; touch screens open the card");
  await signIn(page);
  await page.goto("/libraries/view-movies");
  const play = page.getByRole("button", { name: "Play Movie 03" });
  await page.getByText("Movie 03").first().hover();
  await expect(play).toBeVisible();
  await play.click();
  await expect(page).toHaveURL(/\/play\/movie3$/);

  await page.goto("/libraries/view-movies");
  await page.getByText("Movie 03").first().click();
  await expect(page).toHaveURL(/\/items\/movie3$/);
});

test("suggestion rows hold movies similar to each watched one", async ({ page }) => {
  await signIn(page);
  await page.goto("/libraries/view-movies?tab=suggestions");
  const first = page.getByRole("region", { name: "Because you watched Movie 01" });
  const second = page.getByRole("region", { name: "Because you watched Movie 02" });
  await expect(first.getByText("Movie 06")).toBeVisible();
  await expect(second.getByText("Movie 07")).toBeVisible();
  await expect(first.getByText("Movie 02", { exact: true })).toHaveCount(0);
});
