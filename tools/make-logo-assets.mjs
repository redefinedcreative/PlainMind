#!/usr/bin/env node
/**
 * make-logo-assets.mjs — every PlainMind logo raster, from the one place the
 * logo actually is.
 *
 * ## Why this exists
 *
 * The shipping app icon has been the circle-backed mark since 2026-06-15
 * (`PlainMind/AppIcon.icon`, Icon Composer, iOS 26). Nothing else moved with
 * it. On 2026-10-12 the site header, the favicon, the apple-touch icon, the
 * press-kit downloads, the three OG cards, the onboarding tiles and the splash
 * screen were all still showing a mark from a previous generation — in the
 * splash's case, a line-art glyph that was never the logo at all. Four months,
 * eleven files, nobody noticed, because a PNG cannot be diffed by eye and no
 * one surface owned the others.
 *
 * So the rasters are generated now, and they are generated from the icon
 * itself: the geometry below is lifted from `AppIcon.icon/Assets/*.svg` and the
 * group transforms from its `icon.json`. `--check` re-reads that source and
 * fails if it has moved. When the icon changes, this script is the one thing
 * to re-run, and every surface moves together.
 *
 * ## What it does NOT do
 *
 * It does not reproduce Liquid Glass. The home-screen icon's gloss, specular
 * and translucency are applied by iOS at render time from `icon.json`; they
 * exist nowhere as pixels. What this renders is the same mark, flat, with a
 * restrained shadow and top-light — which is the right treatment for a 32px
 * favicon and a site header anyway, and is what the icon reduces to.
 *
 * ## Usage
 *   node tools/make-logo-assets.mjs              # website assets
 *   node tools/make-logo-assets.mjs --ios        # ...and the iOS asset catalog
 *   node tools/make-logo-assets.mjs --branding   # ...and the Drive social profile images
 *   node tools/make-logo-assets.mjs --check      # verify geometry vs AppIcon.icon
 *   node tools/make-logo-assets.mjs --preview    # contact sheet, writes nothing else
 *
 * After running with no flags, re-run `node tools/make-og-cards.mjs` — the OG
 * cards embed `plainmind-light.png` and do not watch it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const IOS_REPO = join(homedir(), "Developer", "plainMind-ios");
const ICON_SRC = join(IOS_REPO, "PlainMind", "AppIcon.icon");
const TMP = join(ROOT, "tools", ".logo-tmp");

const args = new Set(process.argv.slice(2));
const WANT_IOS = args.has("--ios");
const WANT_BRANDING = args.has("--branding");
const WANT_EXPORT = args.has("--export");
const CHECK_ONLY = args.has("--check");
const PREVIEW_ONLY = args.has("--preview");

// The social profile images live in Drive, not in any repo — the only pair of
// logo rasters that does. They were the same stale mark as everything else, so
// they are generated here too rather than left as the one hand-made exception.
// The seven `Social Header Image/` banners are NOT generated: they are designed
// artwork with the mark composed into them, and need a human.
const BRANDING = join(ROOT, "..", "Branding", "Social Profile Image");

/* ── The mark ────────────────────────────────────────────────────────────────
 * Lifted from AppIcon.icon. The canvas is 1240×1240 (Icon Composer's grid).
 *
 *   icon.json  fill.solid  srgb(0.98431,0.90588,0.80784)  → the cream canvas
 *   group 1    01-circle            scale 1.05
 *   group 0    02-sage/03-amber/    scale 0.93, shadow neutral @0.79
 *              04-cream-bookmark
 *
 * Icon Composer paints the FIRST layer in a group on top, so group 0's paint
 * order bottom-to-top is sage, amber, cream+bookmark — not the order the JSON
 * lists them in. Getting that backwards buries the bookmark.
 * ──────────────────────────────────────────────────────────────────────────── */
const GRID = 1240;

const MARK = {
  canvasLight: "#FBE7CE",          // icon.json fill.solid, exactly
  canvasDark:  "#100E11",          // the established dark tile; icon.json has no dark canvas
  circle:      { cx: 620, cy: 620, r: 472, scale: 1.05, fill: "#5C7B70" },
  cardScale:   0.93,
  sage:        { x: 408, y: 286, w: 424, h: 440, rx: 56, fill: "#B6C7AF" },
  amber:       { x: 366, y: 382, w: 508, h: 440, rx: 60, fill: "#E3B255" },
  cream:       { fill: "#F3ECDD", d: "M386 472 L854 472 A64 64 0 0 1 918 536 L918 740 C 918 882 800 954 620 954 C 440 954 322 882 322 740 L322 536 A64 64 0 0 1 386 472 Z" },
  bookmark:    { fill: "#5C7E73", d: "M702 472 H834 V686 a14 14 0 0 1 -22 11 L768 681 L724 697 a14 14 0 0 1 -22 -11 Z" },
};

/* The values above are a copy, so `--check` proves the copy is still true. */
function checkAgainstSource() {
  if (!existsSync(ICON_SRC)) {
    console.error(`✗ cannot check — ${ICON_SRC} not found (is the iOS repo cloned?)`);
    process.exit(1);
  }
  const read = (f) => readFileSync(join(ICON_SRC, "Assets", f), "utf8");
  const icon = JSON.parse(readFileSync(join(ICON_SRC, "icon.json"), "utf8"));
  const fails = [];

  const num = (s, re) => { const m = s.match(re); return m ? m.slice(1) : null; };
  const c = num(read("01-circle.svg"), /<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="(#[0-9A-Fa-f]{6})"/);
  if (!c || +c[0] !== MARK.circle.cx || +c[1] !== MARK.circle.cy || +c[2] !== MARK.circle.r ||
      c[3].toUpperCase() !== MARK.circle.fill) fails.push(`01-circle moved: ${c && c.join(" ")}`);

  for (const [file, key] of [["02-sage.svg", "sage"], ["03-amber.svg", "amber"]]) {
    const r = num(read(file), /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" rx="(\d+)" fill="(#[0-9A-Fa-f]{6})"/);
    const m = MARK[key];
    if (!r || +r[0] !== m.x || +r[1] !== m.y || +r[2] !== m.w || +r[3] !== m.h ||
        +r[4] !== m.rx || r[5].toUpperCase() !== m.fill) fails.push(`${file} moved: ${r && r.join(" ")}`);
  }

  const cb = read("04-cream-bookmark.svg");
  for (const [key, label] of [["cream", "cream card"], ["bookmark", "bookmark"]]) {
    const want = `fill="${MARK[key].fill}" d="${MARK[key].d}"`;
    if (!cb.includes(want)) fails.push(`${label} path moved in 04-cream-bookmark.svg`);
  }

  const solid = icon.fill?.solid ?? "";
  const rgb = solid.replace("srgb:", "").split(",").slice(0, 3)
    .map((v) => Math.round(parseFloat(v) * 255));
  const hex = "#" + rgb.map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("");
  if (hex !== MARK.canvasLight) fails.push(`canvas fill moved: ${hex} (have ${MARK.canvasLight})`);

  const g0 = icon.groups?.[0]?.position?.scale, g1 = icon.groups?.[1]?.layers?.[0]?.position?.scale;
  if (g0 !== MARK.cardScale) fails.push(`card group scale moved: ${g0} (have ${MARK.cardScale})`);
  if (g1 !== MARK.circle.scale) fails.push(`circle scale moved: ${g1} (have ${MARK.circle.scale})`);

  if (fails.length) {
    console.error("✗ AppIcon.icon has moved since these rasters were generated:");
    for (const f of fails) console.error(`    ${f}`);
    console.error("  Update MARK in this file to match, then re-run without --check.");
    process.exit(1);
  }
  console.log(`✓ geometry matches ${ICON_SRC.replace(homedir(), "~")}`);
}

const EXPORT_README = `# PlainMind logo — export set

Generated, not drawn. Re-run \`node tools/make-logo-assets.mjs --export\` in
PlainMind-Website to refresh; everything here comes from the shipping app icon
(\`PlainMind/AppIcon.icon\`), so it cannot drift from what is on the home screen.

## Which file

| Use | File |
|---|---|
| **Compositing onto the social banners** | \`plainmind-mark-transparent-2048.png\` — no background, drop it on your own artwork |
| Scaling past 2048, or editing in a vector tool | \`plainmind-mark.svg\` (transparent) |
| A square avatar / profile tile | \`plainmind-tile-{light,dark}-1024.png\` |
| Somewhere that should read as "the app icon" | \`plainmind-squircle-{light,dark}-1024.png\` — iOS-style rounded corners, transparent outside them |

The profile images in \`../Social Profile Image/\` are already regenerated — you
do not need to rebuild those.

## The seven banners

\`../Social Header Image/\`: X, YouTube, Bluesky, Mastodon, Threads, LinkedIn,
Facebook. All still carry the **previous** mark (fanned cards, no circle). They
are designed artwork with the logo composed in, so no script can refresh them.

## Palette

| | |
|---|---|
| canvas (light) | \`#FBE7CE\` |
| canvas (dark) | \`#100E11\` |
| circle | \`#5C7B70\` |
| sage card | \`#B6C7AF\` |
| amber card | \`#E3B255\` |
| cream card | \`#F3ECDD\` |
| bookmark | \`#5C7E73\` |

The mark reads as a **circle behind a stack of cards with a bookmark**. The
older fanned-cards mark with no circle is retired — if you see it anywhere, it
is stale.
`;

/* ── Squircle ────────────────────────────────────────────────────────────────
 * iOS clips app icons to a continuous-corner superellipse, not a rounded rect.
 * Only `PlainMindLogo` needs it as a path — it sits unclipped on BrandBackground
 * in SplashView and AppLockView, so the shape has to be in the pixels. Every
 * other consumer clips for itself (CSS `border-radius`, SwiftUI `clipShape`,
 * iOS for the touch icon) and takes a full-bleed square.
 * ──────────────────────────────────────────────────────────────────────────── */
function squirclePath(size, n = 5, steps = 240) {
  const a = size / 2, pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const ct = Math.cos(t), st = Math.sin(t);
    const x = a * Math.sign(ct) * Math.abs(ct) ** (2 / n);
    const y = a * Math.sign(st) * Math.abs(st) ** (2 / n);
    pts.push(`${(a + x).toFixed(2)} ${(a + y).toFixed(2)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

/* ── The SVG ─────────────────────────────────────────────────────────────── */
function markSVG({ dark = false, rounded = false, transparent = false, size = GRID } = {}) {
  const canvas = dark ? MARK.canvasDark : MARK.canvasLight;
  const { circle: ci, sage, amber, cream, bookmark, cardScale: cs } = MARK;
  const r = ci.r * ci.scale;
  const cards = `translate(${ci.cx} ${ci.cy}) scale(${cs}) translate(${-ci.cx} ${-ci.cy})`;

  // A restrained stand-in for what iOS does at render time: one neutral shadow
  // under the card group (icon.json: neutral @ 0.79) and a top-light wash on
  // each card. Not Liquid Glass — the mark, with enough depth to not read flat.
  const defs = `
    <filter id="cardShadow" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#1A1A18" flood-opacity="0.26" />
    </filter>
    <filter id="circleShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#1A1A18" flood-opacity="${dark ? 0.45 : 0.14}" />
    </filter>
    <linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.22" />
      <stop offset="55%"  stop-color="#FFFFFF" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.05" />
    </linearGradient>
    <clipPath id="squircle"><path d="${squirclePath(GRID)}" /></clipPath>`;

  const background = transparent ? "" : `<rect width="${GRID}" height="${GRID}" fill="${canvas}" />`;

  const body = `
    ${background}
    <g filter="url(#circleShadow)">
      <circle cx="${ci.cx}" cy="${ci.cy}" r="${r}" fill="${ci.fill}" />
      <circle cx="${ci.cx}" cy="${ci.cy}" r="${r}" fill="url(#topLight)" />
    </g>
    <g transform="${cards}" filter="url(#cardShadow)">
      <rect x="${sage.x}" y="${sage.y}" width="${sage.w}" height="${sage.h}" rx="${sage.rx}" fill="${sage.fill}" />
      <rect x="${sage.x}" y="${sage.y}" width="${sage.w}" height="${sage.h}" rx="${sage.rx}" fill="url(#topLight)" />
      <rect x="${amber.x}" y="${amber.y}" width="${amber.w}" height="${amber.h}" rx="${amber.rx}" fill="${amber.fill}" />
      <rect x="${amber.x}" y="${amber.y}" width="${amber.w}" height="${amber.h}" rx="${amber.rx}" fill="url(#topLight)" />
      <path d="${cream.d}" fill="${cream.fill}" />
      <path d="${cream.d}" fill="url(#topLight)" />
      <path d="${bookmark.d}" fill="${bookmark.fill}" />
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}">
  <defs>${defs}</defs>
  ${rounded ? `<g clip-path="url(#squircle)">${body}</g>` : body}
</svg>`;
}

/* ── Rasterise ───────────────────────────────────────────────────────────── */
function renderPNG(out, opts) {
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const { size } = opts;
  const html = join(TMP, `r-${size}-${opts.dark ? "d" : "l"}-${opts.rounded ? "sq" : "sq0"}-${opts.transparent ? "t" : "o"}.html`);
  // No margin, no background: a transparent page so `transparent`/`rounded`
  // keep their alpha. Chrome screenshots the full window at CSS pixel size.
  writeFileSync(html, `<!doctype html><meta charset="utf8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
${markSVG(opts)}`);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--default-background-color=00000000", "--allow-file-access-from-files",
    `--screenshot=${out}`, `--window-size=${size},${size}`,
    "--force-device-scale-factor=1", "--virtual-time-budget=4000",
    `file://${html}`,
  ], { stdio: "ignore" });
  if (!existsSync(out)) { console.error(`✗ ${out} did not render`); process.exit(1); }
  return out;
}

function toWebP(pngPath, webpPath) {
  // No cwebp and sips cannot encode WebP on this machine; Pillow can, and the
  // site's <picture> elements list the .webp first, so dropping them would
  // silently serve the stale file from cache-busting-free paths.
  execFileSync("python3", ["-c",
    "import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],'WEBP',quality=92,method=6)",
    pngPath, webpPath], { stdio: "inherit" });
  if (!existsSync(webpPath)) { console.error(`✗ ${webpPath} did not encode`); process.exit(1); }
}

const kb = (p) => `${(readFileSync(p).length / 1024).toFixed(1)}kB`;

/* ── Targets ─────────────────────────────────────────────────────────────── */
const WEB = join(ROOT, "public", "assets");

// Full-bleed square tiles. Every web consumer rounds for itself:
// `.header-icon { border-radius: 22% }`, and iOS masks apple-touch-icon.
const webTargets = [
  { out: join(WEB, "plainmind-light.png"),            size: 256,  dark: false, webp: join(WEB, "plainmind-light.webp") },
  { out: join(WEB, "plainmind-dark.png"),             size: 256,  dark: true,  webp: join(WEB, "plainmind-dark.webp")  },
  { out: join(WEB, "apple-touch-icon.png"),           size: 180,  dark: false },
  { out: join(WEB, "favicon-32.png"),                 size: 32,   dark: false },
  { out: join(WEB, "source", "plainmind-light.png"),  size: 1024, dark: false },
  { out: join(WEB, "source", "plainmind-dark.png"),   size: 1024, dark: true  },
  { out: join(WEB, "press", "plainmind-icon-light.png"), size: 1024, dark: false },
  { out: join(WEB, "press", "plainmind-icon-dark.png"),  size: 1024, dark: true  },
];

const XC = join(IOS_REPO, "PlainMind", "Assets.xcassets");
const ONB = join(XC, "OnboardingAppIcon.imageset");
const LOGO = join(XC, "PlainMindLogo.imageset");

// OnboardingAppIcon: every call site clips it (`RoundedRectangle(..., .continuous)`)
// and the largest is the 132pt resting tile, so it stays a square and gains a 3x.
// PlainMindLogo: SplashView and AppLockView draw it UNCLIPPED on BrandBackground,
// so it carries its own squircle and its own alpha — and its dark slot finally
// gets a dark image, having shipped as a copy of the light one.
const iosTargets = [
  { out: join(ONB,  "OnboardingAppIcon-Light@2x.png"), size: 264, dark: false },
  { out: join(ONB,  "OnboardingAppIcon-Dark@2x.png"),  size: 264, dark: true  },
  { out: join(ONB,  "OnboardingAppIcon-Light@3x.png"), size: 396, dark: false },
  { out: join(ONB,  "OnboardingAppIcon-Dark@3x.png"),  size: 396, dark: true  },
  { out: join(LOGO, "PlainMindLogo-Light@1x.png"), size: 120, dark: false, rounded: true, transparent: false },
  { out: join(LOGO, "PlainMindLogo-Dark@1x.png"),  size: 120, dark: true,  rounded: true, transparent: false },
  { out: join(LOGO, "PlainMindLogo-Light@2x.png"), size: 240, dark: false, rounded: true, transparent: false },
  { out: join(LOGO, "PlainMindLogo-Dark@2x.png"),  size: 240, dark: true,  rounded: true, transparent: false },
  { out: join(LOGO, "PlainMindLogo-Light@3x.png"), size: 360, dark: false, rounded: true, transparent: false },
  { out: join(LOGO, "PlainMindLogo-Dark@3x.png"),  size: 360, dark: true,  rounded: true, transparent: false },
];

const ONB_CONTENTS = {
  images: [
    ["Light", "2x", "light"], ["Dark", "2x", "dark"],
    ["Light", "3x", "light"], ["Dark", "3x", "dark"],
  ].map(([v, s, a]) => ({
    idiom: "universal", scale: s, filename: `OnboardingAppIcon-${v}@${s}.png`,
    appearances: [{ appearance: "luminosity", value: a }],
  })),
  info: { author: "xcode", version: 1 },
};

/* ── Run ─────────────────────────────────────────────────────────────────── */
if (CHECK_ONLY) { checkAgainstSource(); process.exit(0); }

if (existsSync(ICON_SRC)) checkAgainstSource();
else console.log(`• ${ICON_SRC.replace(homedir(), "~")} not reachable — rendering from the copy in this file`);

if (PREVIEW_ONLY) {
  const dir = join(ROOT, "tools", ".logo-preview");
  mkdirSync(dir, { recursive: true });
  const shots = [
    ["tile-light-1024.png", { size: 1024, dark: false }],
    ["tile-dark-1024.png",  { size: 1024, dark: true  }],
    ["squircle-light-360.png", { size: 360, dark: false, rounded: true }],
    ["squircle-dark-360.png",  { size: 360, dark: true,  rounded: true }],
    ["favicon-32.png", { size: 32, dark: false }],
  ];
  for (const [name, opts] of shots) {
    const p = renderPNG(join(dir, name), opts);
    console.log(`  ${name.padEnd(24)} ${kb(p)}`);
  }
  writeFileSync(join(dir, "plainmind-mark.svg"), markSVG({ size: 1024 }));
  console.log(`\n✓ preview written to tools/.logo-preview/ — nothing else touched`);
  rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}

console.log("\nWebsite");
for (const t of webTargets) {
  renderPNG(t.out, t);
  let line = `  ✓ ${t.out.replace(WEB + "/", "").padEnd(32)} ${String(t.size).padStart(4)}px  ${kb(t.out)}`;
  if (t.webp) { toWebP(t.out, t.webp); line += `  + webp ${kb(t.webp)}`; }
  console.log(line);
}
// The canonical vector, in the repo, so the site can use it and a human can read it.
writeFileSync(join(WEB, "plainmind-mark.svg"), markSVG({ size: 1024 }));
console.log(`  ✓ ${"plainmind-mark.svg".padEnd(32)}  vector  ${kb(join(WEB, "plainmind-mark.svg"))}`);

if (WANT_IOS) {
  if (!existsSync(XC)) { console.error(`\n✗ --ios given but ${XC} not found`); process.exit(1); }
  console.log("\niOS asset catalog");
  for (const t of iosTargets) {
    renderPNG(t.out, t);
    console.log(`  ✓ ${t.out.replace(XC + "/", "").padEnd(52)} ${String(t.size).padStart(4)}px  ${kb(t.out)}`);
  }
  writeFileSync(join(ONB, "Contents.json"), JSON.stringify(ONB_CONTENTS, null, 2) + "\n");
  console.log(`  ✓ ${"OnboardingAppIcon.imageset/Contents.json".padEnd(52)}  +3x slots`);
} else {
  console.log("\n• iOS assets skipped — pass --ios to write them too");
}

if (WANT_BRANDING) {
  if (!existsSync(BRANDING)) { console.error(`\n✗ --branding given but ${BRANDING} not found`); process.exit(1); }
  console.log("\nBranding (Drive)");
  for (const [file, dark] of [["PlainMind_Social_Light.png", false], ["PlainMind_Social_Dark.png", true]]) {
    const out = join(BRANDING, file);
    renderPNG(out, { size: 1024, dark });
    console.log(`  ✓ ${file.padEnd(32)} 1024px  ${kb(out)}`);
  }
  console.log("  ! Social Header Image/*.png (7 banners) still carry the old mark — designed artwork, needs a human");
} else {
  console.log("• Branding assets skipped — pass --branding to write them too");
}

if (WANT_EXPORT) {
  // What a human needs to rebuild the seven social banners by hand. The
  // transparent mark is the one that matters: the banners have their own
  // backgrounds, so a baked canvas is unusable on them.
  const dir = join(ROOT, "..", "Branding", "Logo Export");
  mkdirSync(dir, { recursive: true });
  const set = [
    ["plainmind-mark-transparent-2048.png", { size: 2048, transparent: true }],
    ["plainmind-mark-transparent-1024.png", { size: 1024, transparent: true }],
    ["plainmind-tile-light-1024.png",       { size: 1024, dark: false }],
    ["plainmind-tile-dark-1024.png",        { size: 1024, dark: true }],
    ["plainmind-squircle-light-1024.png",   { size: 1024, dark: false, rounded: true }],
    ["plainmind-squircle-dark-1024.png",    { size: 1024, dark: true,  rounded: true }],
  ];
  console.log("\nLogo Export (for the banners)");
  for (const [name, opts] of set) {
    const out = join(dir, name);
    renderPNG(out, opts);
    console.log(`  ✓ ${name.padEnd(38)} ${String(opts.size).padStart(4)}px  ${kb(out)}`);
  }
  writeFileSync(join(dir, "plainmind-mark.svg"), markSVG({ size: 2048, transparent: true }));
  writeFileSync(join(dir, "README.md"), EXPORT_README);
  console.log(`  ✓ ${"plainmind-mark.svg".padEnd(38)}  vector, transparent`);
  console.log(`  ✓ ${"README.md".padEnd(38)}  palette + which file to use where`);
}

rmSync(TMP, { recursive: true, force: true });
console.log("\nNext: node tools/make-og-cards.mjs   (the cards embed plainmind-light.png)\n");
