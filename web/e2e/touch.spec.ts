import { devices, expect, test, type Page } from "@playwright/test";
import { signIn } from "./mock-jellyfin";

// A phone held sideways. defaultBrowserType can't be set inside a file.
const { defaultBrowserType: _, ...landscapePhone } = devices["Pixel 7 landscape"];
test.use(landscapePhone);

/** A one-finger vertical swipe from (x, fromY) to (x, toY), as real touch events. */
async function swipe(page: Page, x: number, fromY: number, toY: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: fromY }],
  });
  for (let step = 1; step <= 8; step++) {
    const y = fromY + ((toY - fromY) * step) / 8;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("phone in landscape: swipes set brightness and volume; full screen locks landscape", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Runs once, with its own phone settings");
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.assign(window, { orientationLocks: calls });
    Object.defineProperty(screen.orientation, "lock", {
      value: (type: string) => {
        calls.push(type);
        return Promise.resolve();
      },
    });
  });
  await signIn(page);
  await page.goto("/play/movie3");
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /stream/);
  const { width, height } = page.viewportSize()!;

  // Right half, down: volume falls.
  await swipe(page, width * 0.75, height * 0.3, height * 0.7);
  await expect(page.getByRole("status", { name: /^Volume \d+%$/ })).toBeVisible();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.volume))
    .toBeLessThan(0.6);

  // Left half, down: the picture dims.
  await swipe(page, width * 0.25, height * 0.3, height * 0.7);
  await expect(page.getByRole("status", { name: /^Brightness \d+%$/ })).toBeVisible();
  await expect(video).toHaveAttribute("style", /brightness\(0\.[0-9]+\)/);

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { orientationLocks: string[] }).orientationLocks),
    )
    .toEqual(["landscape"]);
});
