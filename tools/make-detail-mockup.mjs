#!/usr/bin/env node
/**
 * make-detail-mockup.mjs — a hi-res, app-accurate saved-item detail screen.
 *
 * Builds a standalone HTML file at **true device resolution** (1320×2868, the
 * 6.9" iPhone) and renders it with headless Chrome. Unlike the small phone
 * mockups on the site, nothing here is scaled down: every value is the app's
 * own point value at 1:1, so the output can stand next to a real screenshot.
 *
 * Colours come from the generated token block in `public/styles.css`, so this
 * follows the app the same way the site does — re-run `sync-app-tokens.mjs`
 * first if the app's design has moved.
 *
 * Usage:
 *   node tools/make-detail-mockup.mjs [--dark|--light] [--scale 1|2] [--out path.png]
 *
 * Why HTML and not a screenshot: a screenshot is one theme, one article, one
 * moment, and it cannot be re-cut for a new size or a different headline. This
 * can, and it stays correct automatically when the tokens change.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const dark = !argv.includes("--light");
const scale = Number(flag("--scale", "2"));
const outPath = flag("--out", join(ROOT, "..", "App Launch", "Screenshots",
  `detail-${dark ? "dark" : "light"}@${scale}x.png`));

const W = 1320, H = 2868;   // 6.9" iPhone, device pixels

/* ── tokens, lifted from the generated block so this cannot drift ────────── */
const css = readFileSync(join(ROOT, "public", "styles.css"), "utf8");
const START = "/* app-tokens:start", END = "/* app-tokens:end */";
if (!css.includes(START)) { console.error("✗ no generated token block — run sync-app-tokens.mjs"); process.exit(2); }
const tokenBlock = css.slice(css.indexOf(START), css.indexOf(END) + END.length);

const html = `<!doctype html><html lang="en" data-theme="${dark ? "dark" : "light"}"><head>
<meta charset="utf-8" />
<style>
${tokenBlock}

/* This file renders at device scale, so app point values are used 1:1 — no
   --mock-scale anywhere. 1320 CSS px wide is the 6.9" iPhone at @1x; --scale
   on the command line re-renders the same layout larger for print. */
@font-face { font-family: "PMSerif"; src: url("file:///System/Library/Fonts/NewYork.ttf"); }

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body {
  background: var(--app-background);
  color: var(--app-primary);
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  position: relative;
}

/* ── hero artwork: full-bleed, blurred, fading into the page ─────────────── */
.art { position: absolute; inset: 0 0 auto; height: 1700px; overflow: hidden; }
.art__img {
  position: absolute; inset: -80px;
  background:
    radial-gradient(60% 50% at 70% 18%, #D9B78A 0%, rgba(217,183,138,0) 62%),
    radial-gradient(70% 55% at 22% 34%, #7E9AA6 0%, rgba(126,154,166,0) 66%),
    linear-gradient(176deg, #9FB4B8 0%, #6E8690 38%, var(--app-background) 96%);
  filter: blur(34px) saturate(1.05);
  transform: scale(1.08);
}
/* The app scrims the artwork so the title stays legible over any image. */
.art__scrim {
  position: absolute; inset: 0;
  background: linear-gradient(180deg,
    rgba(0,0,0,${dark ? "0.20" : "0.04"}) 0%, rgba(0,0,0,${dark ? "0.05" : "0.02"}) 28%,
    color-mix(in srgb, var(--app-background) 55%, transparent) 72%,
    var(--app-background) 100%);
}

/* ── floating chrome ─────────────────────────────────────────────────────── */
.nav { position: absolute; top: 180px; left: 36px; right: 36px;
       display: flex; align-items: center; justify-content: space-between; z-index: 3; }
.nav__back, .nav__pill {
  background: rgba(${dark ? "58,63,69" : "255,255,255"}, 0.62);
  backdrop-filter: blur(18px) saturate(1.4);
  border-radius: calc(var(--app-radius-chip) * 1px);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--app-primary);
}
.nav__back { width: 104px; height: 104px; }
.nav__pill { gap: 54px; padding: 0 44px; height: 104px; }
.nav svg { width: 42px; height: 42px; stroke: currentColor; fill: none;
           stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }

/* ── title + source chip ─────────────────────────────────────────────────── */
.head { position: absolute; top: 1270px; left: 0; right: 0; z-index: 2; padding: 0 64px; text-align: center; }
.title {
  font-family: "PMSerif", ui-serif, Georgia, serif;
  font-weight: 700; font-size: 118px; line-height: 1.08; letter-spacing: -0.01em;
  /* White over dark artwork, graphite over light. A white title on a pale
     hero is close to illegible, and the app's own BrandPrimary is graphite in
     light mode — so this follows the token rather than hardcoding white. */
  color: ${dark ? "#FFFFFF" : "var(--app-primary)"};
  text-shadow: ${dark ? "0 2px 26px rgba(0,0,0,0.42)" : "0 1px 18px rgba(255,255,255,0.55)"};
}
.chip {
  margin: 44px auto 0; display: inline-flex; align-items: center; gap: 28px;
  padding: 18px 36px; border-radius: calc(var(--app-radius-chip) * 1px);
  background: rgba(${dark ? "58,63,69" : "255,255,255"}, 0.55);
  backdrop-filter: blur(18px);
  font-size: 34px; color: var(--app-secondary);
}
.chip__part { display: inline-flex; align-items: center; gap: 12px; }
.chip__rule { width: 2px; height: 34px; background: var(--app-divider); }
.chip svg { width: 32px; height: 32px; }
.favicon { width: 34px; height: 34px; border-radius: 8px;
           background: linear-gradient(140deg, #8FA7A4, #4A7475); flex: none; }

/* ── reader card ─────────────────────────────────────────────────────────── */
.shell {
  position: absolute; top: 1660px; left: 30px; right: 30px; bottom: -40px;
  background: color-mix(in srgb, var(--app-card-background) 72%, var(--app-background));
  border-radius: calc(var(--app-radius-sheet) * 1px * 2.8);
  padding: 30px; overflow: hidden;
  box-shadow: 0 18px 60px rgba(0,0,0,${dark ? "0.38" : "0.10"});
}
.card {
  background: var(--app-card-background);
  border-radius: calc(var(--app-radius-sheet) * 1px * 2.2);
  padding: 46px 42px; height: 100%; overflow: hidden;
}
.card__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 34px; }
.card__label { display: inline-flex; align-items: center; gap: 20px;
               font-family: "PMSerif", ui-serif, Georgia, serif; font-weight: 700; font-size: 44px; }
.card__glyph { width: 66px; height: 66px; border-radius: 16px; flex: none;
               background: color-mix(in srgb, var(--app-accent) 24%, transparent);
               display: inline-flex; align-items: center; justify-content: center; }
.card__glyph svg { width: 34px; height: 34px; stroke: var(--app-accent-readable); fill: none; stroke-width: 2; }
.card__count { font-size: 34px; color: var(--app-tertiary); }
.card p { font-size: 44px; line-height: 1.52; color: var(--app-secondary); margin-bottom: 30px; }

/* ── floating action + tab bar ───────────────────────────────────────────── */
.cta {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 258px; z-index: 4;
  display: inline-flex; align-items: center; gap: 22px;
  background: var(--app-accent); color: var(--app-accent-surface-text);
  border-radius: calc(var(--app-radius-chip) * 1px);
  padding: 34px 96px; font-size: 44px; font-weight: 600;
  box-shadow: 0 14px 40px rgba(0,0,0,0.26);
}
.cta svg { width: 36px; height: 36px; stroke: currentColor; fill: none; stroke-width: 2.2; }

.tabbar {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 64px; z-index: 4;
  display: inline-flex; align-items: center; gap: 96px;
  background: rgba(${dark ? "36,42,47" : "255,255,255"}, 0.86);
  backdrop-filter: blur(18px);
  border-radius: calc(var(--app-radius-chip) * 1px); padding: 26px 76px;
}
.tab { display: flex; flex-direction: column; align-items: center; gap: 8px;
       font-size: 30px; color: var(--app-tertiary); }
.tab--on { color: var(--app-accent-readable); }
.tab svg { width: 50px; height: 50px; stroke: currentColor; fill: none; stroke-width: 1.9;
           stroke-linecap: round; stroke-linejoin: round; }

/* ── status bar ──────────────────────────────────────────────────────────── */
.status { position: absolute; top: 72px; left: 0; right: 0; z-index: 5;
          display: flex; justify-content: space-between; padding: 0 76px;
          font-size: 38px; font-weight: 600; color: #FFFFFF; }
.status__right { display: inline-flex; align-items: center; gap: 14px; }
</style></head><body>

<div class="art"><div class="art__img"></div><div class="art__scrim"></div></div>

<div class="status">
  <span>9:41</span>
  <span class="status__right">
    <svg width="40" height="28" viewBox="0 0 18 12"><path fill="#fff" d="M2 6h2v6H2zM6 4h2v8H6zM10 2h2v10h-2zM14 0h2v12h-2z"/></svg>
    <svg width="40" height="28" viewBox="0 0 24 12"><path fill="#fff" d="M1 4a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3z"/><rect x="19" y="4" width="2" height="4" rx="1" fill="#fff"/></svg>
  </span>
</div>

<div class="nav">
  <span class="nav__back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></span>
  <span class="nav__pill">
    <svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
    <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>
  </span>
</div>

<div class="head">
  <h1 class="title">The quiet case<br />for doing less</h1>
  <span class="chip">
    <span class="chip__part">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--app-type-link)" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
      Link
    </span>
    <span class="chip__rule"></span>
    <span class="chip__part"><span class="favicon"></span>fieldnotes.blog</span>
  </span>
</div>

<div class="shell"><div class="card">
  <div class="card__head">
    <span class="card__label">
      <span class="card__glyph"><svg viewBox="0 0 24 24" stroke-linecap="round"><path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span>
      Full text
    </span>
    <span class="card__count">125 words</span>
  </div>
  <p>There is a particular kind of tiredness that comes not from working too hard but from deciding too often. Every open tab is a small unresolved question, and the mind keeps them all warm.</p>
  <p>The usual advice is to get better at choosing. Faster, cleaner, more decisive. But the people who seem least worn down by this are rarely the quickest deciders. They are the ones who have arranged their lives so that fewer things need deciding at all.</p>
  <p>A saved article is a decision deferred, not avoided. The trick is having somewhere to put it that you trust — so the question stops being “should I read this now?” and becomes simply “later.”</p>
  <p>That is a smaller question. Smaller questions are the whole game.</p>
</div></div>

<span class="cta">
  <svg viewBox="0 0 24 24" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
  Open Link
</span>

<div class="tabbar">
  <span class="tab tab--on"><svg viewBox="0 0 24 24"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 5l3 15"/></svg>Library</span>
  <span class="tab"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6 10.6a7 7 0 0 0 0 2L4 14.2l2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.06-.33.1-.66.1-1z"/></svg>Settings</span>
  <span class="tab"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>Search</span>
</div>

</body></html>`;

const htmlPath = join(ROOT, "tools", ".detail-mockup.html");
writeFileSync(htmlPath, html);
mkdirSync(dirname(outPath), { recursive: true });

execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--screenshot=${outPath}`,
  `--window-size=${W},${H}`,
  `--force-device-scale-factor=${scale}`,
  "--virtual-time-budget=6000",
  `file://${htmlPath}`,
], { stdio: "ignore" });

if (!existsSync(outPath)) { console.error("✗ render produced no file"); process.exit(1); }
console.log(`✓ ${outPath}\n  ${W * scale}×${H * scale} — ${dark ? "dark" : "light"}, app tokens at 1:1`);
