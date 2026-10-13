#!/usr/bin/env node
/**
 * make-social-banners.mjs — the seven social header banners, generated.
 *
 * ## Why this exists
 *
 * The banners in `Branding/Social Header Image/` were hand-composed in May 2026
 * and carried the **previous** mark — fanned cards, no circle — for four and a
 * half months after the app icon changed. `make-logo-assets.mjs` fixed every
 * other logo surface on 2026-10-12 and explicitly exempted these seven, on the
 * grounds that they were "designed artwork with the mark composed in" and so
 * "need a human."
 *
 * That exemption is exactly how they went stale. Anything that cannot be
 * re-run is something that will be wrong again the next time the mark moves, so
 * the banners are generated now too, from the same single source.
 *
 * ## Where the pieces come from
 *
 *   mark      `Branding/Logo Export/plainmind-mark.svg` — itself generated from
 *             `PlainMind/AppIcon.icon` by `make-logo-assets.mjs --export`.
 *   colours   the `--app-*` tokens in `public/styles.css`, which
 *             `sync-app-tokens.mjs` generates from the app's asset catalog. The
 *             type-chip colours are therefore the real ones the app renders.
 *   type      New York for the wordmark (the app's serif, and what the press
 *             kit says the wordmark is set in); the system sans for everything
 *             else.
 *
 * Nothing here is sampled off the old PNGs, and nothing is chosen by hand that
 * could be read from somewhere truer. `--check` runs the logo generator's own
 * geometry check first, so a moved icon fails here before it renders.
 *
 * ## What changed from the hand-made set
 *
 * The originals put a blurred 1.0-era Library screenshot behind the cards and
 * used real third-party artwork in the thumbnails — a Goofy Movie still, podcast
 * cover art, an identifiable map pin. That is a licensing question nobody needs
 * on a brand banner, so the rebuilt cards carry the app's own type chips and
 * generic titles instead.
 *
 * ## Usage
 *   node tools/make-social-banners.mjs            # all seven, into Drive
 *   node tools/make-social-banners.mjs --check    # geometry only, writes nothing
 *   node tools/make-social-banners.mjs --preview  # contact sheet to tools/.banner-tmp
 *   node tools/make-social-banners.mjs x linkedin # just these
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EXPORT_DIR = join(ROOT, "..", "Branding", "Logo Export");
const OUT_DIR = join(ROOT, "..", "Branding", "Social Header Image");
const TMP = join(ROOT, "tools", ".banner-tmp");

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const only = argv.filter((a) => !a.startsWith("--")).map((s) => s.toLowerCase());
const CHECK_ONLY = flags.has("--check");
const PREVIEW = flags.has("--preview");

/* ── Source of truth ─────────────────────────────────────────────────────── */

// The logo generator owns the geometry check. Running it here means a banner
// can never be rendered from a mark that has drifted from AppIcon.icon.
function assertMarkIsCurrent() {
  execFileSync("node", [join(ROOT, "tools", "make-logo-assets.mjs"), "--check"], { stdio: "inherit" });
}

function loadMark() {
  const p = join(EXPORT_DIR, "plainmind-mark.svg");
  if (!existsSync(p)) {
    console.error(`✗ ${p} not found — run: node tools/make-logo-assets.mjs --export`);
    process.exit(1);
  }
  // Strip the XML prolog and force the SVG to fill its box; the export carries
  // explicit width/height that would otherwise pin it at 1240px.
  return readFileSync(p, "utf8")
    .replace(/<\?xml[^>]*\?>\s*/i, "")
    .replace(/<svg([^>]*)\swidth="[^"]*"/i, "<svg$1")
    .replace(/<svg([^>]*)\sheight="[^"]*"/i, "<svg$1")
    .replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet" width="100%" height="100%"');
}

// The app's own colours, as generated into the site by sync-app-tokens.mjs.
function loadTokens() {
  const css = readFileSync(join(ROOT, "public", "styles.css"), "utf8");
  const want = [
    "app-accent", "app-accent-readable", "app-background", "app-primary",
    "app-card-background", "app-divider", "app-highlight", "app-mist-teal-deep",
    "app-warm-cream-soft", "app-type-link", "app-type-image", "app-type-pdf",
    "app-type-text", "app-type-music", "app-type-podcast", "app-type-location",
  ];
  const t = {};
  for (const name of want) {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{3,8})`));
    if (!m) { console.error(`✗ --${name} not found in public/styles.css`); process.exit(1); }
    t[name.replace(/^app-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = m[1];
  }
  // The icon canvas, which is not an app token — it is icon.json's own fill and
  // the one colour these banners share with the home screen.
  t.canvas = "#FBE7CE";
  return t;
}

/* ── The seven ───────────────────────────────────────────────────────────────
 * Dimensions are the ones already in Drive, so these drop in as replacements
 * rather than forcing a re-crop on seven networks.
 *
 * `safe` is the fraction of the width that is guaranteed visible after the
 * platform's own cropping, centred. YouTube is the strict one — a 16:9 channel
 * art file is cropped to roughly 1546×423 of its centre on a phone — so the
 * lockup is sized against that, not against the file.
 * ────────────────────────────────────────────────────────────────────────── */
const BANNERS = [
  { key: "x",         file: "PlainMind_X_Twitter_Banner_Image.png", w: 2172, h: 724,  safe: 0.78 },
  { key: "bluesky",   file: "PlainMind_Bluesky_Banner_Image.png",   w: 2172, h: 724,  safe: 0.84 },
  { key: "mastodon",  file: "PlainMind_Mastadon_Banner_Image.png",  w: 2172, h: 724,  safe: 0.84 },
  { key: "linkedin",  file: "PlainMind_LinkedIn_Banner_Image.png",  w: 2508, h: 627,  safe: 0.72 },
  { key: "threads",   file: "PlainMind_Threads_Banner_Image.png",   w: 2508, h: 627,  safe: 0.80 },
  { key: "facebook",  file: "PlainMind_Facebook_Banner_Image.png",  w: 2033, h: 774,  safe: 0.70 },
  { key: "youtube",   file: "PlainMind_YouTube_Banner_Image.png",   w: 1672, h: 941,  safe: 0.56 },
];

/* ── Composition ─────────────────────────────────────────────────────────── */

// One row of the library, as a floating chip. Type name and colour are the
// app's own; titles are deliberately generic — see the header note on why the
// originals' real cover art did not survive the rebuild.
const CHIPS = [
  { type: "Link",    tone: "typeLink",    title: "The Design of Everyday Things", meta: "betterwebtype.com" },
  { type: "Place",   tone: "typeLocation", title: "Eiffel Tower",                 meta: "Paris, France" },
  { type: "PDF",     tone: "typePdf",     title: "Design Inspiration",            meta: "24 pages" },
  { type: "Podcast", tone: "typePodcast", title: "Start This Today",              meta: "Mindset Mentor" },
  { type: "Image",   tone: "typeImage",   title: "Reference shot",                meta: "May 19, 2026" },
  { type: "Music",   tone: "typeMusic",   title: "Coffee Shop Vibes",             meta: "Lo-Fi Essentials" },
];

function chipHTML(c, t, i) {
  return `<div class="chip chip--${i}">
    <div class="chip__type" style="color:${t[c.tone]}">${c.type}</div>
    <div class="chip__title">${c.title}</div>
    <div class="chip__meta">${c.meta}</div>
  </div>`;
}

/* Geometry.
 *
 * Everything is derived from one number — `unit`, the optical height of the
 * lockup — and from the **safe box**, the centred rectangle the platform
 * guarantees to show. The rule the first attempt broke: a chip may never enter
 * the safe box. So chips are anchored to the safe box's edges and allowed to
 * run off the frame, with a fade toward the edge so the clipping reads as
 * "there is more of this library" rather than as a broken export.
 *
 * That also makes the YouTube plate behave. Its safe area is roughly the middle
 * 56% of the file, so its chips sit entirely in the region a phone crops away,
 * and the brand has the middle to itself. */
function geometry(b) {
  const safeW = b.w * b.safe;
  const gutter = (b.w - safeW) / 2;          // one side's cropped margin
  // Sized generously off the height; the fit script in the page clamps it to
  // the safe box. Guessing a serif wordmark's width in Node is how the first
  // two attempts ran "PlainMind" off the edge — so it is measured, not guessed.
  const unit = b.h * 0.3;
  const chipW = Math.round(unit * 1.5);
  const pad = Math.round(unit * 0.3);
  return { safeW, gutter, unit, chipW, pad };
}

function bannerHTML(b, mark, t) {
  const g = geometry(b);
  const unit = g.unit;
  const wordPx = Math.round(unit * 1.02);
  const tagPx = Math.round(unit * 0.38);
  const markPx = Math.round(unit * 1.72);

  return `<!doctype html><meta charset="utf8">
<style>
  @page { margin: 0 }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${b.w}px; height: ${b.h}px; overflow: hidden; position: relative;
    background: ${t.canvas};
    font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* Two soft washes so the ground is not a flat fill. Deliberately
     low-contrast: these sit behind a wordmark and must never compete. */
  .wash { position: absolute; border-radius: 50%; filter: blur(${Math.round(unit * 0.9)}px); }
  .wash--a {
    width: ${Math.round(b.w * 0.5)}px; height: ${Math.round(b.h * 1.4)}px;
    left: ${Math.round(-b.w * 0.12)}px; top: ${Math.round(-b.h * 0.3)}px;
    background: ${t.warmCreamSoft}; opacity: .9;
  }
  .wash--b {
    width: ${Math.round(b.w * 0.38)}px; height: ${Math.round(b.h * 1.1)}px;
    right: ${Math.round(-b.w * 0.1)}px; bottom: ${Math.round(-b.h * 0.4)}px;
    background: ${t.accent}; opacity: .15;
  }

  /* The lockup owns the centre of the safe box and nothing else goes here. */
  .lockup {
    position: absolute; z-index: 3; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    display: flex; align-items: center; gap: ${Math.round(unit * 0.52)}px;
  }
  .lockup__mark {
    width: ${markPx}px; height: ${markPx}px; flex: none;
    filter: drop-shadow(0 ${Math.round(unit * 0.08)}px ${Math.round(unit * 0.16)}px rgba(26,26,24,.16));
  }
  .lockup__mark svg { display: block; width: 100%; height: 100%; }
  .word {
    font-family: "New York", ui-serif, Georgia, serif; font-weight: 600;
    font-size: ${wordPx}px; line-height: 1; letter-spacing: ${(-wordPx * 0.015).toFixed(1)}px;
    color: ${t.primary}; margin: 0; white-space: nowrap;
  }
  .tag {
    font-size: ${tagPx}px; line-height: 1.2; margin: ${Math.round(tagPx * 0.5)}px 0 0;
    color: ${t.accentReadable}; font-weight: 500; white-space: nowrap;
  }

  /* Chips live only in the gutters — the parts of the file a platform crops. */
  .chip {
    position: absolute; z-index: 2; width: ${g.chipW}px;
    background: ${t.cardBackground};
    border: ${Math.max(1, Math.round(unit * 0.012))}px solid ${t.divider}55;
    border-radius: ${Math.round(unit * 0.26)}px;
    padding: ${Math.round(unit * 0.2)}px ${Math.round(unit * 0.24)}px;
    box-shadow: 0 ${Math.round(unit * 0.1)}px ${Math.round(unit * 0.26)}px rgba(44,49,54,.09);
    opacity: .78;
  }
  .chip__type  { font-size: ${Math.round(unit * 0.17)}px; font-weight: 600; letter-spacing: .04em; }
  .chip__title { font-size: ${Math.round(unit * 0.21)}px; font-weight: 600; color: ${t.primary};
                 margin-top: ${Math.round(unit * 0.06)}px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip__meta  { font-size: ${Math.round(unit * 0.165)}px; color: ${t.primary}8C;
                 margin-top: ${Math.round(unit * 0.04)}px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  ${b.chipCSS}
</style>
<div class="wash wash--a"></div>
<div class="wash wash--b"></div>
<div class="lockup">
  <div class="lockup__mark">${mark}</div>
  <div>
    <p class="word">PlainMind</p>
    <p class="tag">Save anything. Find it later.</p>
  </div>
</div>
${CHIPS.map((c, i) => chipHTML(c, t, i)).join("\n")}
<script>
  /* Fit the lockup to the safe box, measured.
   *
   * The wordmark is New York at a size derived from the banner height, and its
   * rendered width depends on the face — which Node cannot measure. Chrome can,
   * so the scale is computed here, after layout and before the screenshot.
   * Clamped to 1: this only ever shrinks, so a wide banner keeps the intended
   * size and a narrow one gives up size rather than running off the edge. */
  (function () {
    var el = document.querySelector(".lockup");
    var maxW = ${Math.round(g.safeW - g.pad * 2)};
    var maxH = ${Math.round(b.h * 0.66)};
    var r = el.getBoundingClientRect();
    var k = Math.min(1, maxW / r.width, maxH / r.height);
    el.style.transform = "translate(-50%, -50%) scale(" + k.toFixed(4) + ")";
    // The chips take the same factor, so a plate with a narrow safe area (the
    // 16:9 YouTube file) does not end up with decoration larger than the brand.
    document.body.style.setProperty("--k", k.toFixed(4));
    document.documentElement.dataset.fit = k.toFixed(3);
  })();
</script>`;
}

/* Three chips per gutter, evenly spaced down the height and staggered
 * outward, each faded toward the frame edge. Positions are computed from the
 * safe box, so widening `safe` moves the chips out rather than over the
 * wordmark. */
function chipCSS(b) {
  const g = geometry(b);
  const rows = [0.16, 0.5, 0.84];                  // vertical centres
  const stagger = [0, 0.34, 0.12];                 // how far each runs off-frame
  const rules = [];
  CHIPS.forEach((_, i) => {
    const side = i % 2 === 0 ? "left" : "right";
    const row = rows[Math.floor(i / 2)];
    const out = Math.round(g.chipW * stagger[Math.floor(i / 2)]);
    const inner = Math.round(g.gutter - g.pad);    // the safe box's edge, minus air
    const x = side === "left" ? inner - g.chipW - out : b.w - inner + out;
    const top = Math.round(b.h * row);
    const fade = side === "left" ? "to right" : "to left";
    // Anchored at the edge it faces the lockup across, so `--k` shrinks a chip
    // toward the safe box instead of sliding it away from its gutter.
    const origin = side === "left" ? "right center" : "left center";
    rules.push(
      `.chip--${i} { left: ${x}px; top: ${top}px; transform-origin: ${origin};\n` +
      `    transform: translateY(-50%) scale(var(--k, 1));\n` +
      `    -webkit-mask-image: linear-gradient(${fade}, transparent 0, #000 72%); }`
    );
  });
  return rules.join("\n  ");
}

/* ── Render ──────────────────────────────────────────────────────────────── */
function render(b, mark, t) {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const html = join(TMP, `${b.key}.html`);
  const out = join(OUT_DIR, b.file);
  writeFileSync(html, bannerHTML({ ...b, chipCSS: chipCSS(b) }, mark, t));
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--allow-file-access-from-files", `--screenshot=${out}`,
    `--window-size=${b.w},${b.h}`, "--force-device-scale-factor=1",
    "--virtual-time-budget=5000", `file://${html}`,
  ], { stdio: "ignore" });
  if (!existsSync(out)) { console.error(`✗ ${b.file} did not render`); process.exit(1); }
  return out;
}

/* ── Run ─────────────────────────────────────────────────────────────────── */
assertMarkIsCurrent();
if (CHECK_ONLY) process.exit(0);

const mark = loadMark();
const tokens = loadTokens();
const todo = only.length ? BANNERS.filter((b) => only.includes(b.key)) : BANNERS;
if (!todo.length) { console.error(`✗ no banner matches ${only.join(", ")}`); process.exit(1); }

const kb = (p) => `${(readFileSync(p).length / 1024).toFixed(0)}kB`;
const made = [];
for (const b of todo) {
  const out = render(b, mark, tokens);
  made.push(out);
  console.log(`  ${b.key.padEnd(9)} ${String(b.w).padStart(4)}×${String(b.h).padEnd(4)}  ${kb(out)}  ${b.file}`);
}

if (PREVIEW) {
  const sheet = join(TMP, "contact-sheet.html");
  writeFileSync(sheet, `<!doctype html><meta charset=utf8>
<style>body{margin:0;padding:28px;background:#2C3136;font:13px -apple-system;color:#EDE7DD}
figure{margin:0 0 26px}img{width:100%;display:block;border-radius:6px}
figcaption{padding:7px 2px;opacity:.75}</style>
${made.map((p, i) => `<figure><img src="file://${p}"><figcaption>${todo[i].key} — ${todo[i].w}×${todo[i].h}</figcaption></figure>`).join("\n")}`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--allow-file-access-from-files", `--screenshot=${join(TMP, "contact-sheet.png")}`,
    "--window-size=1100,3400", "--force-device-scale-factor=1",
    "--virtual-time-budget=6000", `file://${sheet}`], { stdio: "ignore" });
  console.log(`\n→ ${join(TMP, "contact-sheet.png")}`);
}

console.log(`\n✓ ${made.length} banner${made.length === 1 ? "" : "s"} → ${OUT_DIR.replace(homedir(), "~")}`);
