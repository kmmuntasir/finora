import { expect, test } from "@playwright/test";
import { signIn } from "./mock-jellyfin";

test("plays a movie directly and reports progress to Jellyfin", async ({ page }) => {
  const reports: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname.replace(/^\/jf/, "");
    if (path.startsWith("/Sessions/Playing")) reports.push(path);
  });
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Continue watching" })).toBeVisible();
  await page.goto("/items/movie3");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page).toHaveURL(/\/play\/movie3/);

  const video = page.locator("video");
  // Direct play: the original file, not an HLS transcode.
  await expect(video).toHaveAttribute("src", /\/Videos\/movie3\/stream\.webm\?.*Static=true/);
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0.5);
  await expect.poll(() => reports).toContain("/Sessions/Playing");

  await page.keyboard.press("Escape");
  await expect.poll(() => reports).toContain("/Sessions/Playing/Stopped");
});
