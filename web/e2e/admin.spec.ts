import { expect, test } from "@playwright/test";
import { signIn } from "./mock-jellyfin";

test("an admin edits a user's permissions and limits", async ({ page }) => {
  const policies: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/Users/kid1/Policy")
    )
      policies.push(request.postDataJSON());
  });
  await signIn(page, { admin: true });
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();

  await page.goto("/admin/users");
  await page.getByRole("link", { name: "Kid" }).click();
  await expect(page).toHaveURL(/\/admin\/users\/kid1$/);

  await page.getByRole("switch", { name: "Can download files" }).click();
  await page.getByLabel("Highest allowed age rating").selectOption({ label: "PG" });
  await page.getByLabel("Simultaneous streams").selectOption("2");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Changes saved.")).toBeVisible();
  expect(policies).toHaveLength(1);
  expect(policies[0]).toMatchObject({
    EnableContentDownloading: false,
    MaxParentalRating: 10,
    MaxActiveSessions: 2,
  });
});
