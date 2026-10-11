#!/usr/bin/env node
/**
 * sync-releases.mjs — one source for the release history, two surfaces.
 *
 * The history is shown twice: in full on `/releases/`, and as the "Past
 * releases" tab on `/roadmap/`. Maintaining that by hand is how the Featurebase
 * board died — a second copy nobody remembered to update. So the data lives
 * here, once, and both pages are stamped from it.
 *
 * Adding a release: add an entry at the TOP of RELEASES, run the script, done.
 * `ReleaseNotes.all` in the iOS app is the other copy of this text — keep them
 * saying the same thing; the app's is what a user reads in What's New.
 *
 * Usage:
 *   node tools/sync-releases.mjs           # stamp both pages
 *   node tools/sync-releases.mjs --check   # exit 1 if either is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ── the release history, newest first ──────────────────────────────────── */
const RELEASES = [
  {
    "id": "v1-1",
    "version": "1.1",
    "iso": "2026-10-09",
    "date": "9 October 2026",
    "headline": "Collections that make themselves, and a calmer library.",
    "items": [
      "Collections — when the same phrase turns up across a few of your notes, PlainMind offers to group those saves. Nothing to file: items join and leave on their own as your notes change.",
      "Filter by where something came from. Images, PDFs and text remember their source now, not just links. Collections and sources both live in the ⋯ menu at the top of your library.",
      "Item pages are one scrolling page, with full-width artwork at the top — closer to the Music app than a stack of cards.",
      "Saved articles read like a reader view, with the full text in place.",
      "Search and Power search are one screen. Same name, all the filters.",
      "Links bring back more: article text, author, music genre and duration, and the page a PDF or image came from.",
      "“Stored data” on any item shows exactly what PlainMind has kept, field by field, with sizes.",
      "Library rows are shorter — about nine fit on screen instead of five — with three sort orders and an A–Z index.",
      "Face ID can lock the app, with an auto-lock delay you choose.",
      "Fixed: some saves never reached iCloud. Everything syncs now.",
      "Fixed: sharing an image or PDF shares the actual file instead of a text document.",
      "Fixed: saved links no longer store the page’s CSS and scripts alongside the text."
    ]
  },
  {
    "id": "v1-0",
    "version": "1.0",
    "iso": "2026-09-24",
    "date": "24 September 2026",
    "headline": "The first release.",
    "items": [
      "Save links, images, PDFs, text, music, podcasts, places and video from any app, in one tap through the share sheet.",
      "Everything sorts itself by what it is — no tagging, no folders, no decisions in the moment.",
      "Search across titles, your own notes, and the text inside what you saved.",
      "Local-first: your library lives on your device. iCloud sync across your devices with Pro.",
      "No feed, no algorithm, no recommendations. Your library is yours."
    ]
  }
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Full entries — `/releases/`. */
function fullList() {
  return RELEASES.map((r) => `      <article class="release" id="${r.id}">
        <div class="release__head">
          <h2 class="release__version">${esc(r.version)}</h2>
          <p class="release__date"><time datetime="${r.iso}">${esc(r.date)}</time></p>
        </div>
        <div class="release__body">
          <p class="release__headline">${esc(r.headline)}</p>
          <ul class="release__list">
${r.items.map((i) => `          <li>${esc(i)}</li>`).join("\n")}
          </ul>
        </div>
      </article>`).join("\n");
}

/* Condensed — the roadmap's Past tab. Version, date, headline and a count,
   linking into the full entry. A reader scanning the roadmap wants to know
   WHAT shipped and WHEN; the detail has a page of its own. */
function pastPanel() {
  return RELEASES.map((r) => `          <li class="rm-item rm-past">
            <div class="rm-past__head">
              <h3 class="rm-item__title">${esc(r.version)}</h3>
              <span class="rm-past__date"><time datetime="${r.iso}">${esc(r.date)}</time></span>
            </div>
            <p class="rm-item__body">${esc(r.headline)}</p>
            <p class="rm-past__more"><a href="/releases/#${r.id}">${r.items.length} changes in ${esc(r.version)} &rarr;</a></p>
          </li>`).join("\n");
}

const TARGETS = [
  { file: "public/releases/index.html", marker: "releases-list", render: fullList },
  { file: "public/roadmap/index.html",  marker: "releases-past", render: pastPanel },
];

let stale = false;
for (const t of TARGETS) {
  const path = join(ROOT, t.file);
  const cur = readFileSync(path, "utf8");
  const start = `<!-- generated:${t.marker}:start -->`;
  const end = `<!-- generated:${t.marker}:end -->`;
  if (!cur.includes(start) || !cur.includes(end)) {
    console.error(`\u2717 ${t.file}: markers missing. Add:\n  ${start}\n  ${end}`);
    process.exit(2);
  }
  const next = cur.slice(0, cur.indexOf(start) + start.length) + "\n" +
               t.render() + "\n" + cur.slice(cur.indexOf(end));
  if (process.argv.includes("--check")) {
    if (cur !== next) { console.error(`\u2717 ${t.file} is out of date — run: node tools/sync-releases.mjs`); stale = true; }
  } else if (cur !== next) {
    writeFileSync(path, next);
    console.log(`\u2713 ${t.file}`);
  } else {
    console.log(`\u00b7 ${t.file} already in sync`);
  }
}
if (process.argv.includes("--check")) {
  if (stale) process.exit(1);
  console.log(`\u2713 both release surfaces in sync (${RELEASES.length} releases)`);
}
