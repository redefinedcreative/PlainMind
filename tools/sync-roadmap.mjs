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
  version: "1.4",
  stage: "submitted",
  lede: "PlainMind on the Mac, and the reading tools that make a saved article worth coming back to.",
  items: [
    {
      title: "PlainMind on Mac",
      body: "The same library, on a bigger screen, without a phone in the middle, and Share to PlainMind right in Safari's Share menu.",
    },
    {
      title: "A copy that outlives the link",
      body: "Keep a complete, readable copy of a saved page (text and images) so when a site goes away, your save doesn't. Pro.",
    },
    {
      title: "Highlights and notes in what you read",
      body: "Mark the passages that matter in a saved article and find them again later.",
    },
    {
      title: "Contents for long articles",
      body: "Jump to any section of a saved article in reading mode. While it's being read aloud, the voice follows you there.",
    },
    {
      title: "Ask Siri for a save",
      body: "Find what you saved from Siri or a Home Screen search, by what it was about, not just its title. Worked out on your device.",
    },
    {
      title: "Tidy your sources",
      body: "Merge two sources that are really one site, and hide the ones that are just noise. Your saves stay exactly as they are. Only how they're listed changes.",
    },
    {
      title: "Feedback that arrives with what we need",
      body: "Send feedback attaches a small diagnostics file: app health only, never your titles, links or notes. It's right there in the email, and you can remove it before you send.",
    },
  ],
};

/* ── Homepage hero pill ──────────────────────────────────────────────────────
 * One short line per version — what the hero pill says while the version is
 * with Apple ("Coming soon in 1.3: …") and for two weeks after it ships ("New
 * in 1.3: …"). The rule is functions/_lib/release-pill.js; this only supplies
 * the words and the stage. Add the next version's line when its scope locks;
 * leave past lines in place. */
/* The version on the App Store and the day it was released (App Store
 * Connect → History), set on release day in Phase 9. Only the hero pill's
 * fallback when Apple's lookup refuses the site's server. */
const LIVE = { version: "1.3", releaseDate: "2026-10-18T19:22:00Z" };

const HERO_HEADLINES = {
  "1.3": "PlainMind on iPad",
  "1.4": "PlainMind on the Mac",
};

/* ── The release after next ──────────────────────────────────────────────────
 * Null until a release after 1.4 is actually scoped: 1.5 is only candidates in
 * the iOS repo's docs/ROADMAP.md, and listing candidates as a numbered release
 * would promise what nobody has decided. The group is left off the page. */
const AFTER = null;

/* ── Exploring ───────────────────────────────────────────────────────────── */
const EXPLORING = {
  lede: "Real candidates with real groundwork behind them. Which of these lands, and when, depends on what people actually ask for.",
  items: [
    {
      title: "PlainMind on iPhone Duo",
      body: "The phone layout on the outside screen; unfold it and your library opens out into list and detail side by side, right where you were.",
    },
    {
      title: "Search in your own words",
      body: "Type \u201cthat recipe I saved in the spring\u201d and PlainMind turns it into the right filters, on your device, with nothing sent anywhere.",
    },
    {
      title: "Photos you can search",
      body: "Find a saved photo by what is in it, even when it has no words.",
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
    body: "Collections are found by literal phrase matching, on your device. Nothing you save is sent anywhere to be analysed. That's what makes the privacy promise true rather than aspirational.",
  },
  {
    title: "A feed, recommendations, or anything social",
    body: "PlainMind shows you what you saved. It will never show you what someone else saved, or decide what you should look at next.",
  },
  {
    title: "A public voting board",
    body: "We tried one. It went stale, which is worse than not having it. Email is slower and more honest, and a person reads every one.",
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
    AFTER && group({
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
  ].filter(Boolean).join("\n\n");
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
/* ── Release status for the hero pill (public/data/release-status.json) ─────── */
{
  const path = join(ROOT, "public/data/release-status.json");
  const body = JSON.stringify({
    next: { version: NEXT.version, stage: NEXT.stage },
    live: LIVE,
    headlines: HERO_HEADLINES,
  }, null, 2) + "\n";
  let cur = "";
  try { cur = readFileSync(path, "utf8"); } catch (e) { /* first run */ }
  if (CHECK) {
    if (cur !== body) { console.error("✗ public/data/release-status.json is stale — run: node tools/sync-roadmap.mjs"); stale = true; }
  } else if (cur !== body) {
    writeFileSync(path, body);
    console.log("✓ public/data/release-status.json");
  } else {
    console.log("· public/data/release-status.json already in sync");
  }
}

if (CHECK) {
  if (stale) process.exit(1);
  console.log(`✓ roadmap in sync — ${NEXT.version} is "${STAGES[NEXT.stage]}"`);
}
