#!/usr/bin/env node
/**
 * sync-roadmap.mjs — the public roadmap, from one place.
 *
 * ## Why this exists
 *
 * `/roadmap/`'s Upcoming and Not-planned panels were hand-written HTML, and on
 * 2026-10-13 the "Next release" group was wrong in **both** directions at once:
 * it promised "Collection icons and ordering", which was neither built nor in
 * 1.2's agreed scope, and it omitted every Pro collection feature plus the
 * social-post cleanup. A public roadmap that overpromises and undersells the
 * same release is worse than no roadmap — it is the Featurebase failure again,
 * in our own HTML.
 *
 * So the roadmap is data now. `sync-releases.mjs` already owns the Released
 * tab; this owns the other two panels, and between them nothing on that page is
 * typed by hand.
 *
 * ## The contract that keeps it true
 *
 * `docs/RELEASE_PROCESS.md` in the iOS repo makes "update NEXT below, run this
 * script, push" a **step of locking scope** — not a thing to remember later.
 * `stage` is the release's position in that process, and the chip on the page
 * renders from it, so the public page cannot claim a release is "in planning"
 * while it is in review.
 *
 * `--check` exits non-zero when the page has drifted from this file. Run it
 * before pushing if you have touched the roadmap by hand.
 *
 * ## Usage
 *   node tools/sync-roadmap.mjs           # stamp the page
 *   node tools/sync-roadmap.mjs --check   # exit 1 if the page is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/* ── Where a release is in `docs/RELEASE_PROCESS.md` ─────────────────────────
 * These are the only legal values, and they are the same words the process
 * document uses. A release that has shipped does not belong here at all — it
 * moves to `sync-releases.mjs` and the Released tab. */
const STAGES = {
  planning:  "in planning",
  locked:    "scope locked",
  building:  "in development",
  testing:   "in test",
  submitted: "with Apple for review",
};

/* ── Next release ────────────────────────────────────────────────────────────
 * One entry per shipped feature, matching `ReleaseNotes.all` in the app. They
 * are deliberately not grouped into a tidier story: this page's job is to say
 * what is actually coming, and the dev list is the thing it has to agree with.
 * ────────────────────────────────────────────────────────────────────────── */
const NEXT = {
  version: "1.2",
  stage: "testing",
  lede: "The organisation layer. Collections stop being something PlainMind offers you and start being something you can build and shape — and a few things that were quietly untidy get tidied.",
  items: [
    {
      title: "Turn a search into a collection",
      body: "Collections can already make themselves from your notes. This is the other half: build a search worth keeping, pin it, and it becomes a collection that stays current on its own. Free — making a collection should not cost anything.",
    },
    {
      title: "Collections introduce themselves",
      body: "Suggestions are off until you turn them on, which meant most people never met the feature. PlainMind now offers once, in your library, and only when it has actually found a phrase you wrote.",
    },
    {
      title: "A collection that matches more than one phrase",
      body: "The thing you are collecting rarely has a single name. Add the others and they all count. Pro.",
    },
    {
      title: "Merge two collections that overlap",
      body: "When two collections drift into holding the same saves, PlainMind notices and offers to merge them. Pro.",
    },
    {
      title: "Archive a collection you're done with",
      body: "It keeps matching and keeps syncing — it is just off the list, with everything waiting when you put it back. Pro.",
    },
    {
      title: "One site, one source",
      body: "Mobile and AMP versions of a page — and short links like youtu.be — group with everything else from that site instead of sitting apart. Saves you already had are tidied up too.",
    },
    {
      title: "Rename a source",
      body: "Call a site whatever you actually call it, and the name follows you to your other devices. Pro.",
    },
    {
      title: "Posts from social apps read properly",
      body: "The account handle and the date it went up, then the post itself. Like and comment counts are dropped — they were only ever true for the moment you saved.",
    },
    {
      title: "Faster search in large libraries",
      body: "Search stays quick into the low thousands of saves and then starts to show. Groundwork now, so it never becomes something you notice.",
    },
  ],
};

/* ── The release after next ──────────────────────────────────────────────────
 * The only thing with a version number attached that is not in NEXT. iPad was
 * built, briefly enabled to exercise the layout, and held back deliberately —
 * shipping it means an iPad visual sweep and iPad App Store screenshots, and
 * neither belongs in a release already carrying nine features. */
const AFTER = {
  version: "1.3",
  label: "iPad",
  lede: "One release, one job.",
  items: [
    {
      title: "PlainMind on iPad",
      body: "A proper three-pane layout rather than a stretched phone screen. The layout is built; what it still needs is a pass on real hardware, which is why it is a release of its own rather than a flag we flip.",
    },
  ],
};

/* ── Exploring ───────────────────────────────────────────────────────────── */
const EXPLORING = {
  lede: "Real candidates with real groundwork behind them. Which of these lands — and when — depends on what people actually ask for.",
  items: [
    {
      title: "Collection icons and ordering",
      body: "Give a collection its own symbol, and put your collections in the order you think of them.",
    },
    {
      title: "PlainMind on Mac",
      body: "The same library, on a bigger screen, without a phone in the middle.",
    },
    {
      title: "Search that narrows as you go",
      body: "Combine type, source and when, and see how many results each choice would leave before you commit to it.",
    },
    {
      title: "Filter your library by date",
      body: "Jump to a month or a year without scrolling through everything in between.",
    },
    {
      title: "Audio",
      body: "Save voice memos and audio files, play them in place, and optionally have them transcribed on your device.",
    },
    {
      title: "More of what a page tells us",
      body: "Author, publication and published date, kept alongside the article text we already save.",
    },
  ],
};

/* ── Not planned ─────────────────────────────────────────────────────────────
 * Deliberate refusals, not a backlog. Each one is a decision recorded in
 * PROJECT.md; if an entry here ever stops being true, that is a product change,
 * not a copy edit. */
const NOT_PLANNED = [
  {
    title: "Tags and folders",
    body: "Filing is work you do now for a payoff you might get later. Everything sorts itself by what it is, and collections form from notes you were writing anyway.",
  },
  {
    title: "Sending your library to an AI",
    body: "Collections are found by literal phrase matching, on your device. Nothing you save is sent anywhere to be analysed — that's what makes the privacy promise true rather than aspirational.",
  },
  {
    title: "A feed, recommendations, or anything social",
    body: "PlainMind shows you what you saved. It will never show you what someone else saved, or decide what you should look at next.",
  },
  {
    title: "A public voting board",
    body: "We tried one. It went stale, which is worse than not having it. Email is slower and more honest — and a person reads every one.",
  },
];

/* ── Render ──────────────────────────────────────────────────────────────── */
const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function items(list, h = "h4") {
  return list.map((i) => `              <li class="rm-item">
                <${h} class="rm-item__title">${esc(i.title)}</${h}>
                <p class="rm-item__body">${esc(i.body)}</p>
              </li>`).join("\n");
}

function group({ title, chip, chipMod = "", lede, list }) {
  return `          <div class="rm-group">
            <div class="rm-group__head">
              <h3 class="rm-group__title">${esc(title)}</h3>
              <span class="rm-chip${chipMod}">${esc(chip)}</span>
            </div>
            <p class="rm-group__lede">${esc(lede)}</p>
            <ul class="rm-list">
${items(list)}
            </ul>
          </div>`;
}

function upcoming() {
  const stage = STAGES[NEXT.stage];
  if (!stage) {
    console.error(`✗ unknown stage "${NEXT.stage}" — use one of: ${Object.keys(STAGES).join(", ")}`);
    process.exit(2);
  }
  return [
    group({
      title: "Next release",
      chip: `${NEXT.version} · ${stage}`,
      chipMod: " rm-chip--next",
      lede: NEXT.lede,
      list: NEXT.items,
    }),
    group({
      title: "The one after",
      chip: `${AFTER.version} · ${AFTER.label}`,
      lede: AFTER.lede,
      list: AFTER.items,
    }),
    group({
      title: "Exploring",
      chip: "no release attached",
      lede: EXPLORING.lede,
      list: EXPLORING.items,
    }),
  ].join("\n\n");
}

function notPlanned() {
  return NOT_PLANNED.map((i) => `            <li class="rm-item">
              <h3 class="rm-item__title">${esc(i.title)}</h3>
              <p class="rm-item__body">${esc(i.body)}</p>
            </li>`).join("\n");
}

/* ── Stamp ───────────────────────────────────────────────────────────────── */
const TARGETS = [
  { file: "public/roadmap/index.html", marker: "roadmap-upcoming",    render: upcoming },
  { file: "public/roadmap/index.html", marker: "roadmap-not-planned", render: notPlanned },
];

let stale = false;
for (const t of TARGETS) {
  const path = join(ROOT, t.file);
  const cur = readFileSync(path, "utf8");
  const start = `<!-- generated:${t.marker}:start -->`;
  const end = `<!-- generated:${t.marker}:end -->`;
  if (!cur.includes(start) || !cur.includes(end)) {
    console.error(`✗ ${t.file}: markers missing. Add:\n  ${start}\n  ${end}`);
    process.exit(2);
  }
  const next = cur.slice(0, cur.indexOf(start) + start.length) + "\n" +
               t.render() + "\n" + cur.slice(cur.indexOf(end));
  if (CHECK) {
    if (cur !== next) { console.error(`✗ ${t.file} (${t.marker}) is stale — run: node tools/sync-roadmap.mjs`); stale = true; }
  } else if (cur !== next) {
    writeFileSync(path, next);
    console.log(`✓ ${t.file} — ${t.marker}`);
  } else {
    console.log(`· ${t.file} — ${t.marker} already in sync`);
  }
}
if (CHECK) {
  if (stale) process.exit(1);
  console.log(`✓ roadmap in sync — ${NEXT.version} is "${STAGES[NEXT.stage]}"`);
}
