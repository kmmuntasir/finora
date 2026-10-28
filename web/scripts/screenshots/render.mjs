// Renders made-up posters, backdrops and an album cover from catalogue.json
// into a Jellyfin media folder, for the README screenshots.
// Usage (from web/): node scripts/screenshots/render.mjs <media-folder>
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = process.argv[2];
if (!out) throw new Error("Usage: render.mjs <media-folder>");
const cat = JSON.parse(await readFile(new URL("./catalogue.json", import.meta.url), "utf8"));
const font = (
  await readFile(new URL("../../src/assets/fonts/solaimanlipi-bold.woff2", import.meta.url))
).toString("base64");

function html(w, h, item, kind) {
  const big = kind === "poster" ? 64 : kind === "cover" ? 56 : 96;
  const title =
    kind === "backdrop"
      ? ""
      : `<div class="t">${item.title}</div>${item.original ? `<div class="s">${item.original}</div>` : item.artist ? `<div class="s">${item.artist}</div>` : `<div class="s">${item.year}</div>`}`;
  return `<html><head><style>
  @font-face { font-family: L; src: url(data:font/woff2;base64,${font}); }
  body { margin:0; width:${w}px; height:${h}px; overflow:hidden; font-family: L, sans-serif; }
  .bg { position:absolute; inset:0; background:
     radial-gradient(circle at 70% 30%, ${item.a} 0%, transparent 45%),
     radial-gradient(circle at 20% 80%, ${item.b} 0%, transparent 60%),
     linear-gradient(160deg, ${item.b}, ${item.c} 70%); }
  .orb { position:absolute; border-radius:50%; filter: blur(2px); opacity:.85;
     background: radial-gradient(circle at 35% 35%, #fff8, ${item.a} 40%, transparent 70%); }
  .lines { position:absolute; inset:0; background: repeating-linear-gradient(115deg, #ffffff08 0 2px, transparent 2px 18px); }
  .t { position:absolute; left:8%; right:8%; bottom:${kind === "poster" ? "16%" : "14%"}; color:#fff; font-size:${big}px; line-height:1.05; text-shadow:0 4px 24px #0009; }
  .s { position:absolute; left:8%; bottom:${kind === "poster" ? "9%" : "7%"}; color:#ffffffcc; font-size:${big * 0.38}px; letter-spacing:.08em; text-transform:uppercase; }
  </style></head><body><div class="bg"></div><div class="lines"></div>
  <div class="orb" style="width:${w * 0.55}px;height:${w * 0.55}px;left:${w * 0.42}px;top:${h * 0.08}px"></div>
  ${title}</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(path, w, h, item, kind) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html(w, h, item, kind));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type: "jpeg", quality: 88 });
}
const slug = (item) => (item.sort ?? item.title).replace(/[^\w ]/g, "").trim();
for (const movie of cat.movies) {
  const dir = `${out}/Movies/${slug(movie)} (${movie.year})`;
  await shot(`${dir}/poster.jpg`, 600, 900, movie, "poster");
  await shot(`${dir}/fanart.jpg`, 1920, 1080, movie, "backdrop");
}
const showDir = `${out}/Shows/${cat.show.title} (${cat.show.year})`;
await shot(`${showDir}/poster.jpg`, 600, 900, cat.show, "poster");
await shot(`${showDir}/fanart.jpg`, 1920, 1080, cat.show, "backdrop");
await shot(
  `${out}/Music/${cat.album.artist}/${cat.album.title} (${cat.album.year})/folder.jpg`,
  800,
  800,
  cat.album,
  "cover",
);
await browser.close();
