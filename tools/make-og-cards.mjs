#!/usr/bin/env node
/**
 * make-og-cards.mjs — the link-preview cards, generated rather than drawn.
 *
 * The three cards in `public/assets/og/` were made by hand in May 2026 and
 * then quietly went stale: the home card still read "iOS · OPEN BETA SOON"
 * three weeks after 1.0 shipped and two days after 1.1, and the /beta/ card
 * still said "Open Beta · TestFlight" even though that page's own headline had
 * long since become "PlainMind is on the App Store". Nothing caught it,
 * because a PNG cannot be checked.
 *
 * So they are generated now, from the same token block the site and the phone
 * mockups read. Change the copy in CARDS below, re-run, and every card moves
 * together — and a brand colour change moves them without anyone editing copy
 * at all.
 *
 * The design is the original's, matched against it: cream gradient, the app
 * icon beside the wordmark, a teal eyebrow, a two-line serif headline whose
 * second line is the italic accent, a hairline, and the domain. The one
 * deliberate change is the teal: the hand-drawn cards used #6CA0A1, which is
 * not a token and predates the design system. These use --accent-readable,
 * which is what `.accent` resolves to on the page each card represents.
 *
 * Usage:
 *   node tools/make-og-cards.mjs            # write all three
 *   node tools/make-og-cards.mjs --check    # fail if any card is missing
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = join(ROOT, "public", "assets", "og");

const W = 1200, H = 630;   // the Open Graph standard, and what the meta tags declare

/* ── the cards. Copy lives here and nowhere else. ────────────────────────── */
const CARDS = [
  {
    file: "og-home.png",
    eyebrow: "iOS · On the App Store",
    // The homepage's own headline (2026-10-19 tagline consolidation: the
    // hero line and the App Store subtitle, nothing else).
    line1: "Save anything.",
    line2: "It sorts itself.",
  },
  {
    file: "og-download.png",
    eyebrow: "Free on the App Store",
    line1: "PlainMind is",
    line2: "on the App Store.",
  },
  {
    file: "og-press.png",
    eyebrow: "Press kit",
    line1: "PlainMind",
    line2: "press kit.",
  },
];

/* ── tokens, from the generated block, so a brand change reaches these ───── */
const css = readFileSync(join(ROOT, "public", "styles.css"), "utf8");
const START = "/* app-tokens:start", END = "/* app-tokens:end */";
if (!css.includes(START)) {
  console.error("✗ no generated token block — run sync-app-tokens.mjs");
  process.exit(2);
}
const tokenBlock = css.slice(css.indexOf(START), css.indexOf(END) + END.length);

if (process.argv.includes("--check")) {
  const missing = CARDS.filter((c) => !existsSync(join(OUT_DIR, c.file)));
  if (missing.length) {
    console.error("✗ missing OG cards: " + missing.map((c) => c.file).join(", ") +
                  "\n  Run: node tools/make-og-cards.mjs");
    process.exit(1);
  }
  console.log(`✓ all ${CARDS.length} OG cards present`);
  process.exit(0);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const iconURL = "file://" + join(ROOT, "public", "assets", "plainmind-light.png");

/* Geometry measured off the original card, in its own 1200x630 pixels. */
const page = (card) => `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<style>
${tokenBlock}
@font-face { font-family: "PMSerif"; src: url("file:///System/Library/Fonts/NewYork.ttf"); }
@font-face { font-family: "PMSerifIt"; src: url("file:///System/Library/Fonts/NewYorkItalic.ttf"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body {
  position: relative;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  /* Cream, deepening toward the top-right — matched to the original card. */
  background: linear-gradient(to top right,
    var(--app-background) 0%, var(--app-background) 52%, #EAEBE4 100%);
}
.brand { position: absolute; left: 88px; top: 92px; display: flex; align-items: center; gap: 26px; }
.brand img { width: 116px; height: 116px; border-radius: 26px; display: block; }
.brand span {
  font-family: "PMSerif", ui-serif, Georgia, serif; font-weight: 700;
  font-size: 52px; letter-spacing: -0.015em; color: var(--app-primary);
}
.eyebrow {
  position: absolute; left: 90px; top: 308px;
  font-size: 23px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--app-accent-readable);
}
.head {
  position: absolute; left: 88px; top: 357px; right: 80px;
  font-family: "PMSerif", ui-serif, Georgia, serif; font-weight: 700;
  font-size: 86px; line-height: 92px; letter-spacing: -0.02em;
  color: var(--app-primary);
}
.head em {
  display: block; font-family: "PMSerifIt", "PMSerif", ui-serif, Georgia, serif;
  font-style: italic; font-weight: 600; color: var(--app-accent-readable);
}
.rule { position: absolute; left: 90px; right: 90px; top: 575px; height: 1px; background: var(--app-divider); }
.domain { position: absolute; left: 92px; top: 580px; font-size: 20px; color: #919291; }
</style></head><body>
  <div class="brand"><img src="${iconURL}" alt="" /><span>PlainMind</span></div>
  <div class="eyebrow">${esc(card.eyebrow)}</div>
  <div class="head">${esc(card.line1)}<em>${esc(card.line2)}</em></div>
  <div class="rule"></div>
  <div class="domain">plainmind.app</div>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
for (const card of CARDS) {
  const htmlPath = join(ROOT, "tools", `.og-${card.file}.html`);
  writeFileSync(htmlPath, page(card));
  const out = join(OUT_DIR, card.file);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--screenshot=${out}`, `--window-size=${W},${H}`,
    "--force-device-scale-factor=1", "--virtual-time-budget=6000",
    `file://${htmlPath}`,
  ], { stdio: "ignore" });
  if (!existsSync(out)) { console.error(`✗ ${card.file} did not render`); process.exit(1); }
  console.log(`✓ ${card.file}  ${W}x${H}  "${card.eyebrow}"`);
}
