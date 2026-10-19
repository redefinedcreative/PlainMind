#!/usr/bin/env node
/**
 * logo-guard.mjs: keep the site's logo images the generated ones, and make
 * every browser fetch them fresh when they change.
 *
 * Why (2026-10-19): the old fanned-cards mark "came back" in the user's own
 * browser. Until 2026-10-12 the logo files were served with a one-year
 * `immutable` cache, so a browser that had them never asked again, whatever
 * `_headers` said later. A logo's URL therefore has to change when the logo
 * does. This stamps each reference with the image's own content hash
 * (`/assets/favicon-32.png?v=1a2b3c4d`), so a new image is a new URL.
 *
 * It also pins the images: `tools/logo-manifest.json` records the hash of each
 * file `make-logo-assets.mjs` produced, and the check fails if one changes by
 * any other route (a hand export, an old file copied back).
 *
 * Usage:
 *   node tools/logo-guard.mjs           # check: pinned hashes, and every page stamped
 *   node tools/logo-guard.mjs --stamp   # after make-logo-assets.mjs / make-og-cards.mjs:
 *                                       # re-pin and re-stamp every page
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const MANIFEST = join(ROOT, "tools", "logo-manifest.json");

// Every image of the logo the site serves, relative to public/.
const LOGOS = [
  "assets/favicon-32.png", "assets/apple-touch-icon.png",
  "assets/plainmind-light.png", "assets/plainmind-dark.png",
  "assets/plainmind-light.webp", "assets/plainmind-dark.webp",
  "assets/plainmind-mark.svg",
  "assets/press/plainmind-icon-light.png", "assets/press/plainmind-icon-dark.png",
  "assets/og/og-home.png", "assets/og/og-press.png", "assets/og/og-download.png",
];

const hash = (file) => createHash("sha256").update(readFileSync(join(PUBLIC, file))).digest("hex");
const short = (h) => h.slice(0, 8);
const pages = globSync("**/*.html", { cwd: PUBLIC });

// A reference to one of the logos, however the page spells the path
// ("/assets/x.png", "../assets/x.png", "assets/x.png", or the full URL), with
// any existing ?v= stamp.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const refPattern = (file) =>
  new RegExp(`((?:https://plainmind\\.app/|\\.\\./|/)?${escape(file)})(\\?v=[0-9A-Za-z-]+)?(?=["'\\s,)])`, "g");

const stamp = process.argv.includes("--stamp");
const current = Object.fromEntries(LOGOS.map((f) => [f, hash(f)]));
let problems = [];

if (stamp) {
  writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + "\n");
  let edits = 0;
  for (const page of pages) {
    const path = join(PUBLIC, page);
    let s = readFileSync(path, "utf8");
    const before = s;
    for (const f of LOGOS) s = s.replace(refPattern(f), (_, p) => `${p}?v=${short(current[f])}`);
    if (s !== before) { writeFileSync(path, s); edits++; }
  }
  console.log(`logo-guard: pinned ${LOGOS.length} images, stamped ${edits} page(s)`);
  process.exit(0);
}

let pinned = {};
try { pinned = JSON.parse(readFileSync(MANIFEST, "utf8")); } catch { problems.push("no tools/logo-manifest.json; run with --stamp"); }
for (const f of LOGOS) {
  if (pinned[f] && pinned[f] !== current[f]) {
    problems.push(`${f} is not the pinned image. Logo images come from make-logo-assets.mjs only; if this one is a deliberate regeneration, run --stamp.`);
  }
}
for (const page of pages) {
  const s = readFileSync(join(PUBLIC, page), "utf8");
  for (const f of LOGOS) {
    for (const m of s.matchAll(refPattern(f))) {
      if (m[2] !== `?v=${short(current[f])}`) problems.push(`${page}: ${m[1]} is ${m[2] ? "stamped with an old version" : "not stamped"}`);
    }
  }
}
if (problems.length) {
  console.log(problems.map((p) => "FAIL " + p).join("\n"));
  console.log(`\nlogo-guard: FAILED (${problems.length})`);
  process.exit(1);
}
console.log("logo-guard: ok (logo images pinned, every reference stamped)");
