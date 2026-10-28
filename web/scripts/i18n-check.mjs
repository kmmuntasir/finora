// Lists interface strings (t("…"), msg("…") and tn(n, "…", "…") calls) missing from a
// catalogue, and catalogue entries nothing uses. Exits 1 when any are missing.
// Usage: node scripts/i18n-check.mjs [language] [--write-missing]
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../src/", import.meta.url).pathname;
const language = process.argv.find((arg) => /^[a-z]{2}$/.test(arg)) ?? "bn";
const writeMissing = process.argv.includes("--write-missing");

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return files(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    }),
  );
  return nested.flat();
}

// A double- or single-quoted JS string literal.
const literal = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;
const tCall = new RegExp(String.raw`\b(?:t|msg)\(\s*` + literal, "g");
const tnCall = new RegExp(
  String.raw`\btn\(\s*[^,]+,\s*` + literal + String.raw`\s*,\s*` + literal,
  "g",
);
const unquote = (raw) =>
  JSON.parse(raw.startsWith("'") ? `"${raw.slice(1, -1).replace(/"/g, '\\"')}"` : raw);

const used = new Map();
for (const file of await files(root)) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(tCall))
    used.set(unquote(match[1]), path.relative(root, file));
  for (const match of source.matchAll(tnCall)) {
    used.set(unquote(match[1]), path.relative(root, file));
    used.set(unquote(match[2]), path.relative(root, file));
  }
}

const catalogueDir = path.join(root, "i18n", language);
const catalogue = {};
const conflicts = [];
for (const name of (await readdir(catalogueDir))
  .filter((entry) => entry.endsWith(".json"))
  .sort()) {
  const part = JSON.parse(await readFile(path.join(catalogueDir, name), "utf8"));
  for (const [key, value] of Object.entries(part)) {
    if (key in catalogue && catalogue[key] !== value) conflicts.push(`${key} (${name})`);
    catalogue[key] = value;
  }
}

const missing = [...used.keys()].filter((key) => !(key in catalogue));
const unused = Object.keys(catalogue).filter((key) => !used.has(key));
console.log(`${used.size} strings in use, ${Object.keys(catalogue).length} in ${language}`);
if (conflicts.length)
  console.log(`\nTranslated differently in two files:\n  ${conflicts.join("\n  ")}`);
if (unused.length) console.log(`\nNot used any more (${unused.length}):\n  ${unused.join("\n  ")}`);
if (missing.length) {
  console.log(`\nMissing (${missing.length}):`);
  for (const key of missing) console.log(`  ${used.get(key)}: ${JSON.stringify(key)}`);
  if (writeMissing) {
    const out = path.join(catalogueDir, "_missing.json");
    await writeFile(
      out,
      JSON.stringify(Object.fromEntries(missing.map((key) => [key, ""])), null, 2) + "\n",
    );
    console.log(`\nWrote ${path.relative(process.cwd(), out)}`);
  }
  process.exit(1);
}
