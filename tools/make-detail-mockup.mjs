#!/usr/bin/env node
/**
 * make-detail-mockup.mjs — a hi-res, app-accurate saved-item detail screen.
 *
 * **Everything here is an app POINT.** The page is laid out at 440x956 — the
 * 6.9" iPhone's size in points — and Chrome renders it at a device scale factor
 * of 3, exactly as the phone does. So `font-size: 34px` in this file IS the
 * app's 34pt `.largeTitle`, and `padding: 24px` IS `Spacing.xl`. No conversion,
 * no eyeballing, nothing to re-derive when a size changes.
 *
 * The previous version drew the same screen on a 1320px canvas and treated app
 * points as 1:1 against device PIXELS, so every value had to be multiplied by
 * roughly three somewhere — `font-size: 118px` for a 34pt title, `44px` for a
 * 17pt body. Those numbers could not be checked against the app, and several
 * were wrong.
 *
 * The layout follows `DetailViewD7`:
 *
 *   hero header   in flow, the first row — artwork, then a blur band at its
 *                 bottom carrying the title and the type/source pill
 *   D7GlassCard   one solid panel holding the sections, each in its own
 *                 `detailSectionZone` (Full text / Details / Note)
 *   action bar    floating glass pill at the tab bar's width
 *   tab bar       iOS 26 floating tabs, Search detached in its own circle
 *
 * Colours, radii, metrics and type tiers come from the generated token block in
 * `public/styles.css` — re-run `sync-app-tokens.mjs` after any app design
 * change and this follows automatically.
 *
 * Usage:
 *   node tools/make-detail-mockup.mjs [--dark|--light] [--scale N]
 *                                     [--record path.json] [--art path]
 *                                     [--out path.png]
 *
 * The RECORD is data, not markup — point `--record` at a different saved item
 * and the layout is untouched. `--art` overrides just the hero image.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const dark = !argv.includes("--light");
const scale = Number(flag("--scale", "2"));

/* 6.9" iPhone (17 Pro Max): 440x956pt at @3x -> 1320x2868 device pixels. */
const W = 440, H = 956, DSF = 3 * scale;
/* How far the page is scrolled, in points. The screen is 956pt and the hero
   alone claims 56% of it, so the detail cannot show every section at once —
   which is true of the app too. 0 captures the hero; ~430 captures the card's
   sections with the hero scrolled off the top. */
const scrollPt = Number(flag("--scroll", "0"));

const outPath = flag("--out", join(ROOT, "..", "App Launch", "Screenshots",
  `detail-${dark ? "dark" : "light"}@${scale}x.png`));

/* -- the saved item ---------------------------------------------------------
   Real metadata from redefinedcreative.com: title and description are the
   page's own `og:` tags, which is what `MetadataFetcher` stores, and the body
   is the page's own copy, which is what the readability pass extracts.

   `source` is NOT the bare domain. `DomainDisplayName.display(for:)` misses the
   curated table, then `SiteNameResolver` route B matches the title's trailing
   segment ("Redefined Creative") letter-for-letter against the domain label
   ("redefinedcreative") — self-verifying, so a single save is enough. The app
   shows the name, not the hostname. */
const DEFAULT_RECORD = {
  type: "Link",
  /* The page serves "<headline> | Redefined Creative". Titles are tap-to-edit
     in the app, and the source pill directly beneath this one already says
     "Redefined Creative" — so the saved title drops the duplicated suffix. A
     realistic state, and the right one for a record that is hand-picked.
     Pass --record to use the raw og:title instead. */
  title: "Web design + local SEO for home service businesses",
  domain: "redefinedcreative.com",
  source: "Redefined Creative",
  saved: "Oct 10, 2026",
  opened: "4 times",
  art: "tools/assets/rc-og.png",
  favicon: "tools/assets/rc-favicon.png",
  body: [
    "We build custom, high-performance web designs for mid-sized service businesses that rank on Google, convert visitors into calls, and scale with your growth.",
    "Your competitors aren’t better than you; they are just easier to find on Google Maps. We put you in front of customers who are ready to buy today.",
  ],
  /* What sits behind "View more" — counted into the word total, as the app
     does, but not rendered until the section is expanded. */
  bodyRest: [
    "Your website shouldn’t be a second job. We don’t just build websites; we provide a complete WordPress Growth Engine — from strategy and design to secure hosting and updates, so you never have to worry about a broken plugin or a slow page again.",
  ],
  note: "The positioning line to keep. “Easier to find, not better” is the whole pitch in six words — reuse it on the services page.",
};

const record = argv.includes("--record")
  ? { ...DEFAULT_RECORD, ...JSON.parse(readFileSync(flag("--record"), "utf8")) }
  : DEFAULT_RECORD;
if (argv.includes("--art")) record.art = flag("--art");

/* `DetailLongTextSection.summary` — whitespace-split, same as the app. */
const wordCount = [...record.body, ...(record.bodyRest ?? [])]
  .join(" ").split(/\s+/).filter(Boolean).length;

const fileURL = (p) => `file://${resolve(ROOT, p)}`;

/* -- tokens, lifted from the generated block so this cannot drift ---------- */
const css = readFileSync(join(ROOT, "public", "styles.css"), "utf8");
const START = "/* app-tokens:start", END = "/* app-tokens:end */";
if (!css.includes(START)) { console.error("✗ no generated token block — run sync-app-tokens.mjs"); process.exit(2); }
const tokenBlock = css.slice(css.indexOf(START), css.indexOf(END) + END.length);

/* A token's raw number, for the few places that need it in JS not CSS. */
const tok = (name) => {
  const m = tokenBlock.match(new RegExp(`--${name}:\\s*([0-9.]+)`));
  if (!m) { console.error(`✗ token --${name} missing — run sync-app-tokens.mjs`); process.exit(2); }
  return Number(m[1]);
};

/* `heroH = layoutH * D7Metrics.heroHeightFraction`, layoutH being the full
   sheet height. The band is laid out inside this, pinned to the bottom. */
const heroH = H * tok("app-detail-hero-height-fraction");
/* `actionBarWidth`: min(width * 0.68, 340) + Spacing.lg * 2 — tracks the tab
   bar's centred pill rather than the screen. */
const actionBarW = Math.min(W * 0.68, 340) + 16 * 2;
/* The pill the action bar is matching. Same 0.68, so they line up by
   construction rather than by eye. */
const tabBarW = W * 0.68;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Over artwork the app uses the ADAPTIVE label colour, not a baked-in white —
   the band resolves to a near-solid page colour, which is what makes that
   legible. Only the status bar sits on bare artwork, so only it is forced. */
const onArt = dark ? "#FFFFFF" : "var(--app-primary)";

const html = `<!doctype html><html lang="en" data-theme="${dark ? "dark" : "light"}"><head>
<meta charset="utf-8" />
<style>
${tokenBlock}

/* === Every length below is an APP POINT. The page is 440x956 — the device's
   size in points — and renders at dsf ${DSF}, so points map to pixels the way
   they do on the phone. Read \`24px\` as \`Spacing.xl\`. === */
@font-face { font-family: "PMSerif"; src: url("file:///System/Library/Fonts/NewYork.ttf"); }

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
:root {
  --app-font-serif: "PMSerif", ui-serif, Georgia, serif;
  --app-font-system: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
}
body {
  background: var(--app-background);
  color: var(--app-primary);
  font-family: var(--app-font-system);
  -webkit-font-smoothing: antialiased;
  position: relative;
}

/* -- hero header: artwork with the blur band pinned to its bottom ---------
   \`VStack { Spacer(minLength: heroImageMinBand); heroTextBand }\` at
   \`minHeight: heroH\`, over the artwork, clipped. */
/* ONE scrolling column — the hero header, then the single content panel.
   Nothing behind the page is positioned independently. */
.page { position: absolute; top: 0; left: 0; right: 0; transform: translateY(-${scrollPt}px); }

.hero {
  position: relative; min-height: ${heroH}px; overflow: hidden;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.hero__art { position: absolute; inset: 0; }
.hero__art img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* \`heroTextBand\` — the top padding is D7Metrics.heroFadeLeadIn, the run over
   which blur and page colour resolve, which is what lets the title below use
   the adaptive label colour instead of a baked-in white. */
.band {
  position: relative;
  padding: calc(var(--app-detail-hero-fade-lead-in) * 1px) calc(var(--app-space-xl) * 1px) calc(var(--app-space-lg) * 1px);
  display: flex; flex-direction: column; align-items: center;
  gap: calc(var(--app-space-md) * 1px);
}
/* The blur is a gradient-MASKED material, not a blurred copy of the artwork. */
.band::before {
  content: ""; position: absolute; inset: 0; z-index: 0;
  -webkit-backdrop-filter: blur(22px) saturate(1.2);
  backdrop-filter: blur(22px) saturate(1.2);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 50%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 50%, #000 100%);
}
/* ...over the page-colour fade, stops exactly as in \`heroTextBand\`. */
.band::after {
  content: ""; position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(to bottom,
    transparent 0%,
    color-mix(in srgb, var(--app-background) 50%, transparent) 42%,
    color-mix(in srgb, var(--app-background) 90%, transparent) 68%,
    var(--app-background) 100%);
}
.band > * { position: relative; z-index: 1; }

/* \`.brandHero()\` — tier 1: serif largeTitle bold, centred, lineSpacing xxs. */
.title {
  font-family: var(--app-tier-hero-family);
  font-weight: var(--app-tier-hero-weight);
  font-size: calc(var(--app-tier-hero-size) * 1px);
  color: ${onArt};
  text-align: center;
  line-height: calc((var(--app-tier-hero-size) * 1.16 + var(--app-space-xxs)) * 1px);
  letter-spacing: -0.01em;
}

/* \`DetailFilterPillRow(style: .onHero)\` — a real material, a stronger edge and
   primary-weight labels, because a 6% wash vanished against artwork. */
.pills {
  display: inline-flex; align-items: stretch; border-radius: 999px;
  background: color-mix(in srgb, var(--app-card-background) 72%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: inset 0 0 0 0.75px color-mix(in srgb, var(--app-primary) 12%, transparent);
}
.pill {
  display: inline-flex; align-items: center; gap: calc(var(--app-space-xs) * 1px);
  padding: calc(var(--app-space-sm) * 1px) calc(var(--app-space-lg) * 1px);
  font-size: calc(var(--app-text-footnote) * 1px);
  font-weight: 600; color: var(--app-primary); white-space: nowrap;
}
.pill svg { width: 12px; height: 12px; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.pill__rule { width: 0.75px; height: 16px; align-self: center; flex: none;
              background: color-mix(in srgb, var(--app-primary) 30%, transparent); }
/* \`faviconSide\` is 14 — the label's cap height, so the mark reads as part of
   the text run rather than a sticker on it. Rounded, not circular. */
.favicon { width: 14px; height: 14px; border-radius: 3px; flex: none; object-fit: contain; }

/* -- D7GlassCard: the one SOLID surface. "Content is solid. Chrome is glass." */
.card {
  margin: calc(var(--app-detail-hero-to-panel-gap) * 1px) calc(var(--app-space-lg) * 1px) 0;
  padding: calc(var(--app-space-xl) * 1px) 0;
  display: flex; flex-direction: column; gap: calc(var(--app-space-xl) * 1px);
  background: var(--app-card-background);
  border-radius: calc(var(--app-detail-card-corner-radius) * 1px);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-stone) 40%, transparent),
              0 4px 12px rgba(0, 0, 0, 0.04);
}

/* \`detailSectionZone()\` — padding md, the PAGE colour inside the card (so each
   layer is legible against the next), radius card, inset to the content margin. */
.zone {
  margin: 0 calc(var(--app-space-lg) * 1px);
  padding: calc(var(--app-space-md) * 1px);
  background: var(--app-background);
  border-radius: calc(var(--app-radius-card) * 1px);
  display: flex; flex-direction: column; gap: calc(var(--app-space-sm) * 1px);
}

/* \`D7SectionBadge\` + \`.brandItemTitle()\`, shared by every section header. */
.sec { display: flex; align-items: center; gap: calc(var(--app-space-sm) * 1px); }
.sec__badge {
  width: calc((var(--app-detail-favicon-size) + var(--app-space-sm)) * 1px);
  height: calc((var(--app-detail-favicon-size) + var(--app-space-sm)) * 1px);
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  border-radius: calc(var(--app-radius-small) * 1px);
  background: color-mix(in srgb, var(--app-accent) 12%, transparent);
  color: var(--app-accent-readable);
}
.sec__badge svg { width: 13px; height: 13px; fill: none; stroke: currentColor;
                  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sec__title {
  font-family: var(--app-tier-item-title-family);
  font-weight: var(--app-tier-item-title-weight);
  font-size: calc(var(--app-tier-item-title-size) * 1px);
  color: var(--app-tier-item-title-color);
}
.sec__trail { margin-left: auto; font-size: calc(var(--app-text-footnote) * 1px); color: var(--app-tertiary); }
.sec__chev { margin-left: auto; color: var(--app-tertiary); display: inline-flex; }
.sec__chev svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.4;
                 stroke-linecap: round; stroke-linejoin: round; transform: rotate(180deg); }

/* \`ReaderText\` — blocks spaced md, body tier, secondary, lineSpacing xs. */
.reader { display: flex; flex-direction: column; gap: calc(var(--app-space-md) * 1px); }
.reader p {
  font-family: var(--app-tier-body-family);
  font-size: calc(var(--app-tier-body-size) * 1px);
  color: var(--app-secondary);
  line-height: calc((var(--app-tier-body-size) + var(--app-space-xs)) * 1px);
}
.more {
  display: inline-flex; align-items: center; gap: calc(var(--app-space-xxs) * 1px);
  font-size: calc(var(--app-text-subheadline) * 1px); font-weight: 500;
  color: var(--app-accent-readable);
}
.more svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.4;
            stroke-linecap: round; stroke-linejoin: round; }

/* \`D7DetailsCard\` rows — open by default (\`detailsOpen = true\`). */
.rows { padding-top: calc(var(--app-space-sm) * 1px); }
.row { display: flex; align-items: center; gap: calc(var(--app-space-sm) * 1px);
       padding: calc(var(--app-space-sm) * 1px) 0; }
.row__icon { width: calc(var(--app-space-lg) * 1px); flex: none; display: inline-flex;
             justify-content: center; color: var(--app-secondary); }
.row__icon svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2;
                 stroke-linecap: round; stroke-linejoin: round; }
.row__key { font-size: calc(var(--app-text-footnote) * 1px); color: var(--app-secondary); }
/* The value is the SERIF footnote, semibold — \`BrandTypography.display(.footnote)\`. */
.row__val {
  margin-left: auto; font-family: var(--app-font-serif); font-weight: 600;
  font-size: calc(var(--app-text-footnote) * 1px); color: var(--app-primary);
  max-width: 64%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tint { color: var(--app-type-link) !important; }

/* The Note's body is flat on the card at rest — no box until you tap in. */
.note__body {
  font-family: var(--app-tier-body-family);
  font-size: calc(var(--app-tier-body-size) * 1px);
  color: var(--app-primary);
  line-height: calc((var(--app-tier-body-size) + var(--app-space-xs)) * 1px);
  padding: calc(var(--app-space-xs) * 1px) 0;
}

/* -- chrome --------------------------------------------------------------- */
.status {
  position: absolute; top: 0; left: 0; right: 0; height: 62px; z-index: 6;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 34px 0 40px;
  font-size: 17px; font-weight: 600; letter-spacing: 0.1px;
  /* The one element sitting on bare artwork rather than on the resolved band. */
  color: #FFFFFF; text-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}
.status__right { display: inline-flex; align-items: center; gap: 6px; }

/* Navigation bar — system back leading; Share and the More menu as two
   ADJACENT trailing items with no spacer between them, which is what makes
   iOS 26 group them into one glass capsule rather than two circles. */
.nav {
  position: absolute; top: 62px; left: 0; right: 0; height: 44px; z-index: 6;
  display: flex; align-items: center; justify-content: space-between; padding: 0 12px;
}
.glass {
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--app-card-background) 62%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-primary) 10%, transparent);
  color: var(--app-primary);
}
.nav__back { width: var(--c); height: var(--c); border-radius: 50%;
             --c: calc(var(--app-detail-control-size) * 1px); }
.nav__group { height: calc(var(--app-detail-control-size) * 1px);
              border-radius: 999px; padding: 0 14px; gap: 22px; }
.nav svg { width: 17px; height: 17px; stroke: currentColor; fill: none;
           stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* \`DetailBottomActionBar\` — glass pill at the tab bar's width, holding a 44pt
   accent button inset by BottomBarMetrics.padding a side. */
.actionbar {
  /* Spacing.sm clear of the tab bar. Measured on 1.1-6.9inch/03-reader.png:
     the glass bar's bottom edge sits at 856pt, the tab bar starts at 865.7pt.
     At 88 the gap was 3.7pt and the two chrome pieces collided. */
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 100px; z-index: 5;
  width: ${actionBarW}px; padding: 0 calc(var(--app-space-lg) * 1px);
}
.actionbar__glass {
  /* .glass is inline-flex — right for every pill sized to its content, wrong
     for this one, which has to fill the tab-bar-matched frame. */
  display: flex; flex-direction: column; align-items: stretch;
  padding: calc(var(--app-bar-padding) * 1px);
  border-radius: calc(var(--app-bar-outer-corner-radius) * 1px);
}
.actionbar__btn {
  height: calc(var(--app-bar-button-height) * 1px);
  border-radius: calc((var(--app-bar-outer-corner-radius) - var(--app-bar-padding)) * 1px);
  background: var(--app-accent-surface); color: var(--app-accent-surface-text);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: calc(var(--app-text-subheadline) * 1px); font-weight: 600;
}
.actionbar__btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none;
                      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* iOS 27 tab bar: ONE centred floating capsule holding every tab, Search
   included. The detached search circle is the iOS 26 reading of the
   \`.search\` tab role and is what the Simulator still draws; on device the
   three tabs share one pill — and the action bar above is sized to match THAT
   pill, which is why the two line up. */
.tabbar {
  /* 23.7pt clear of the screen bottom on device. */
  position: absolute; left: 0; right: 0; bottom: 24px; z-index: 5;
  display: flex; align-items: center; justify-content: center;
}
.tabs {
  border-radius: 999px; padding: 6px; gap: 4px;
  width: ${tabBarW}px; justify-content: space-between;
  /* The glass sits OFF the page colour — lighter in dark, darker in light.
     Sampled dark: bar rgb(54,56,60) against a rgb(26,30,33) page. */
  background: color-mix(in srgb, var(--app-secondary) 14%, var(--app-background));
}
.tab {
  flex: 1; min-width: 0;
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  /* 8pt, not 5 — the device capsule is 66.6pt tall and 5 made it 58. */
  gap: 2px; padding: 5px 6px; border-radius: 999px;
  font-size: 12px; font-weight: 500; color: var(--app-tertiary);
}
/* The selected tab is a LENS — the page showing back through the glass — not
   a tint. Sampled on device: glass rgb(54,56,60), selected tab rgb(28,32,35)
   against a rgb(26,30,33) page. The teal wash had it LIGHTER than the bar,
   which is backwards. */
.tab--on { color: var(--app-accent-readable); font-weight: 600;
           background: var(--app-background); }
.tab svg { width: 28px; height: 28px; stroke: currentColor; fill: none; stroke-width: 1.6;
           stroke-linecap: round; stroke-linejoin: round; }
</style></head><body>

<div class="page">
<div class="hero">
  <div class="hero__art"><img src="${fileURL(record.art)}" alt="" /></div>
  <div class="band">
    <h1 class="title">${esc(record.title)}</h1>
    <span class="pills">
      <span class="pill">
        <svg viewBox="0 0 24 24" stroke="var(--app-type-link)"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        ${esc(record.type)}
      </span>
      <span class="pill__rule"></span>
      <span class="pill">
        <img class="favicon" src="${fileURL(record.favicon)}" alt="" />
        ${esc(record.source)}
      </span>
    </span>
  </div>
</div>

<div class="card">

  <!-- longTextSection. The description is deliberately NOT shown above it: an
       og:description is usually the opening paragraph, so printing both put the
       same sentences on the page twice. -->
  <div class="zone">
    <div class="sec">
      <span class="sec__badge"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span>
      <span class="sec__title">Full text</span>
      <span class="sec__trail">${wordCount} words</span>
    </div>
    <div class="reader">${record.body.map((p) => "<p>" + esc(p) + "</p>").join("")}</div>
    <span class="more">View more<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
  </div>

  <!-- D7DetailsCard, open by default -->
  <div class="zone">
    <div class="sec">
      <span class="sec__badge"><svg viewBox="0 0 24 24"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3"/></svg></span>
      <span class="sec__title">Details</span>
      <span class="sec__chev"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
    </div>
    <div class="rows">
      <div class="row">
        <span class="row__icon tint"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg></span>
        <span class="row__key">Source</span><span class="row__val">${esc(record.source)}</span>
      </div>
      <div class="row">
        <span class="row__icon tint"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
        <span class="row__key">Type</span><span class="row__val tint">${esc(record.type)}</span>
      </div>
      <div class="row">
        <span class="row__icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
        <span class="row__key">Saved</span><span class="row__val">${esc(record.saved)}</span>
      </div>
      <div class="row">
        <span class="row__icon"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></span>
        <span class="row__key">Opened</span><span class="row__val">${esc(record.opened)}</span>
      </div>
    </div>
  </div>

  <!-- noteField — last, in its own matching zone -->
  <div class="zone">
    <div class="sec">
      <span class="sec__badge"><svg viewBox="0 0 24 24"><path d="M4 4h16v12l-4 4H4z"/><path d="M8 9h8M8 13h5"/></svg></span>
      <span class="sec__title">Note</span>
    </div>
    <p class="note__body">${esc(record.note)}</p>
  </div>

</div>
</div>

<div class="status">
  <span>9:41</span>
  <span class="status__right">
    <svg width="18" height="12" viewBox="0 0 18 12"><path fill="currentColor" d="M1 7h2.4v5H1zM5.6 4.6H8V12H5.6zM10.2 2.3h2.4V12h-2.4zM14.8 0h2.4v12h-2.4z"/></svg>
    <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="20" height="11" rx="3.2" fill="none" stroke="currentColor" stroke-opacity="0.5"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><path d="M22.5 4v4a2.2 2.2 0 0 0 0-4z" fill="currentColor" fill-opacity="0.5"/></svg>
  </span>
</div>

<div class="nav">
  <span class="glass nav__back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></span>
  <span class="glass nav__group">
    <svg viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>
    <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
  </span>
</div>

<div class="actionbar"><div class="glass actionbar__glass"><div class="actionbar__btn">
  <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  Open Link
</div></div></div>

<div class="tabbar">
  <span class="glass tabs">
    <span class="tab tab--on"><svg viewBox="0 0 24 24"><rect x="3" y="4.4" width="4" height="17" rx="1"/><rect x="9.4" y="2.6" width="3.2" height="18.8" rx="1"/><rect x="15" y="4" width="3.4" height="17" rx="1" transform="rotate(14 16.7 12.5)"/><path d="M4.1 12.2h1.8M10.1 10.6h1.8"/></svg>Library</span>
    <span class="tab"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Settings</span>
    <span class="tab"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.4-4.4"/></svg>Search</span>
  </span>
</div>

</body></html>`;

const htmlPath = join(ROOT, "tools", ".detail-mockup.html");
writeFileSync(htmlPath, html);
mkdirSync(dirname(outPath), { recursive: true });

execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--allow-file-access-from-files",
  `--screenshot=${outPath}`,
  `--window-size=${W},${H}`,
  `--force-device-scale-factor=${DSF}`,
  "--virtual-time-budget=8000",
  `file://${htmlPath}`,
], { stdio: "ignore" });

if (!existsSync(outPath)) { console.error("✗ render produced no file"); process.exit(1); }
console.log(
  `✓ ${outPath}\n  ${W * DSF}x${H * DSF} — ${dark ? "dark" : "light"}, ` +
  `${W}x${H}pt at dsf ${DSF}\n  hero ${heroH.toFixed(1)}pt, action bar ${actionBarW}pt, ` +
  `"${record.source}" — ${wordCount} words`
);
