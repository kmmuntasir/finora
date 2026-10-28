// Takes the README screenshots from a running Finora Web (pnpm dev) signed in
// to a sandbox Jellyfin whose library was filled by render.mjs.
// Usage (from web/): SANDBOX_USER=… SANDBOX_PASSWORD=… node scripts/screenshots/shots.mjs '<item ids as JSON>'
import { chromium } from "@playwright/test";

const out = new URL("../../../docs/screenshots", import.meta.url).pathname;
const user = process.env.SANDBOX_USER;
const password = process.env.SANDBOX_PASSWORD;
if (!user || !password) throw new Error("Set SANDBOX_USER and SANDBOX_PASSWORD");
const base = "http://127.0.0.1:5173";
const browser = await chromium.launch();

async function session(viewport, scale = 1) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.locator("input[name=username]").fill(user);
  await page.locator("input[name=password]").fill(password);
  await page.keyboard.press("Enter");
  await page.waitForURL(`${base}/`);
  await page.waitForTimeout(2500);
  return page;
}
async function shot(page, path, name, wait = 2500) {
  await page.goto(`${base}${path}`);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 });
  console.log("shot", name);
}

const desktop = await session({ width: 1440, height: 900 });
const ids = JSON.parse(process.argv[2]);
await shot(desktop, "/", "home");
await shot(desktop, `/libraries/${ids.movies}`, "library");
await shot(desktop, `/items/${ids.lantern}`, "item");
await shot(desktop, `/items/${ids.show}`, "series");
await shot(desktop, `/admin/overview`, "admin");
// Music: start the album, open the now-playing view.
await desktop.goto(`${base}/items/${ids.album}`);
await desktop.waitForTimeout(2000);
await desktop.getByRole("button", { name: "Play", exact: true }).click();
await desktop.waitForTimeout(2500);
await desktop
  .getByRole("button", { name: /now playing|open player/i })
  .first()
  .click()
  .catch(() => undefined);
await desktop.waitForTimeout(1500);
await desktop.screenshot({ path: `${out}/music.jpg`, type: "jpeg", quality: 82 });
console.log("shot music");
await desktop.keyboard.press("Escape");
// Player with controls visible.
await desktop.goto(`${base}/play/${ids.orbit}`);
await desktop.waitForTimeout(3000);
await desktop.evaluate(() => {
  const v = document.querySelector("video");
  if (v) {
    v.muted = true;
    void v.play();
  }
});
await desktop.waitForTimeout(2000);
await desktop.mouse.move(700, 500);
await desktop.waitForTimeout(500);
await desktop.screenshot({ path: `${out}/player.jpg`, type: "jpeg", quality: 82 });
console.log("shot player");
await desktop.keyboard.press("Escape");

const phone = await session({ width: 390, height: 844 }, 2);
await shot(phone, "/", "phone-home");
await shot(phone, `/items/${ids.bengali}`, "phone-item");
await browser.close();
