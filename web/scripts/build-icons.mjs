// Renders the PWA icons from the Finora mark with headless Chromium.
// Run after changing the mark: node scripts/build-icons.mjs
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const mark = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

// padding is the share of the canvas kept clear around the mark.
const icons = [
  { name: "icon-192.png", size: 192, padding: 0.12, background: "#090C12" },
  { name: "icon-512.png", size: 512, padding: 0.12, background: "#090C12" },
  // Maskable icons are cropped to a circle as small as 80% of the canvas.
  { name: "icon-maskable-512.png", size: 512, padding: 0.24, background: "#090C12" },
  { name: "apple-touch-icon.png", size: 180, padding: 0.14, background: "#090C12" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of icons) {
  const inner = Math.round(icon.size * (1 - icon.padding * 2));
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${icon.size}px;height:${icon.size}px;background:${icon.background}">
      <div style="width:${inner}px;height:${inner}px;display:grid;place-items:center">${mark.replace("<svg ", '<svg style="max-width:100%;max-height:100%;width:100%;height:100%" ')}</div>
    </body>`,
  );
  await page.screenshot({ path: new URL(icon.name, out).pathname });
}
await browser.close();
