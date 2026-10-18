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
    "id": "v1-3",
    "version": "1.3",
    "iso": "2026-10-18",
    "date": "18 October 2026",
    "headline": "PlainMind, whole on iPad.",
    "items": [
      "iPad gets everything iPhone has: Search with every filter, your collections in the sidebar, the collection suggestions, and a source filter. Recently Saved and Unopened now show exactly that.",
      "Reading mode. Open a saved article and get just its title and its words — no images, no panels, nothing else.",
      "Listen. PlainMind reads a saved article aloud with your device's own voices, and keeps reading with your phone locked. Nothing leaves your device. Pro.",
      "Bring your bookmarks. Import the bookmarks file from Safari (Reading List included), Chrome, Firefox, Pocket or Instapaper. Each link keeps the date you saved it, and anything already in PlainMind is skipped.",
      "Give a collection an icon, and put your collections in the order you want. Pro.",
      "A new first run. It shows you how saving, sorting and finding work, sets up PlainMind in your share sheet one step at a time, then walks you through your first save — and opens it for you. Your library starts empty: no sample items.",
      "New saves show up in Spotlight straight away, and Delete All Data now clears PlainMind from Spotlight too.",
      "On iPad, keyboard shortcuts (⌘1, ⌘2, ⌘F), Spotlight results and links now open where they should.",
      "Pro on a new device: if iCloud sync is waiting for PlainMind to restart, it now says so — once when it happens, and in Settings — instead of quietly keeping a separate library.",
      "Fixed: a collection could be made twice when the names differed only in capitals, like “Orlando” and “orlando”.",
      "PlainMind is smaller to download."
    ]
  },
  {
    "id": "v1-2",
    "version": "1.2",
    "iso": "2026-10-15",
    "date": "15 October 2026",
    "headline": "A library that keeps itself in order.",
    "items": [
      "Search is faster, especially in larger libraries.",
      "Rename a source. Call it whatever you call it — the name follows you to your other devices. Pro.",
      "One site, one source. Mobile and AMP versions of a page — and links like youtu.be — now group with everything else from that site instead of sitting apart. Your existing saves are tidied up too.",
      "Collections now introduce themselves. When a phrase keeps turning up in your notes, PlainMind offers to group those saves — once, in your library, and only when it has actually found something.",
      "Pin a search. Build a search you want to keep, pin it, and it becomes a collection that stays current on its own — free, like the collections PlainMind suggests.",
      "A collection can match more than one phrase. The thing you're collecting rarely has one name — add the others and they all count. Pro.",
      "When two collections drift into holding the same saves, PlainMind notices and offers to merge them — and asks which of the two names the merged list should keep. Pro.",
      "Archive a collection you're done with. It keeps matching and keeps syncing — it's just off the list, with everything waiting when you put it back. Pro.",
      "Saves from Instagram and other social apps read properly now: the handle and the date the post went up, then the post itself. Like and comment counts are gone — they were only ever true for a moment. Your existing saves are tidied up too."
    ]
  },
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
