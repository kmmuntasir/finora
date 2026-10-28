import { expect, test } from "@playwright/test";
import { signIn } from "./mock-jellyfin";

test("works on plain HTTP, where secure-context APIs are missing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "plain-http", "Only meaningful outside a secure context");
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  // Guards the setup itself: if this ever becomes a secure context, the
  // plain-http project stops testing what it is for.
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
});
