import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockJellyfin, signIn } from "./mock-jellyfin";

/** Serious and critical WCAG 2.1 A/AA problems on the current page. */
async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
}

test("sign-in page", async ({ page }) => {
  await mockJellyfin(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

for (const [name, path, ready] of [
  ["home", "/", "Continue watching"],
  ["library", "/libraries/view-movies", "Movies"],
  ["item", "/items/movie3", "Movie 03"],
  ["search", "/search?q=movie", "Movies"],
  ["settings", "/settings", "Settings"],
] as const) {
  test(`${name} page`, async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
    await page.goto(path);
    await expect(page.getByRole("heading", { name: ready }).first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

test("admin user page", async ({ page }) => {
  await signIn(page, { admin: true });
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.goto("/admin/users/kid1");
  await expect(page.getByRole("heading", { name: "Kid" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("player", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.goto("/play/movie3");
  await expect(page.getByRole("button", { name: /pause|play/i }).first()).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("keyboard users can skip the navigation", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});
