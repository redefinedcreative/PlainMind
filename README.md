# PlainMind — marketing site

Static site for PlainMind, served from Cloudflare Pages.

## Structure

```
public/
  index.html      landing page (hero, features, signup, theme toggle)
  privacy.html    privacy policy — Termageddon embed wrapped in brand chrome
  terms.html      terms of service — Termageddon embed wrapped in brand chrome
  styles.css      brand tokens, light/dark via [data-theme], components, policy embed overrides
  assets/
    plainmind-light.png   192×192 PNG (optimized for inline use + apple-touch-icon)
    plainmind-dark.png    192×192 PNG (ditto)
    source/               1024×1024 originals, kept as masters (not referenced by HTML)
```

## Theme

The site supports three modes via a footer toggle on every page:
- **System** (default on first visit) — follows the user's OS preference
- **Light**
- **Dark**

The user's choice is stored in `localStorage` under the key `pm-theme`. An anti-flash inline script in `<head>` sets the `data-theme` attribute on `<html>` before paint, so the page never flickers to the wrong theme on load. If the user is in System mode and their OS theme changes while the page is open, the site updates live.

To force-reset a visitor to System mode, clear `localStorage.pm-theme` in DevTools.

## Policy pages — Termageddon embeds

`/privacy` and `/terms` render their policy bodies via Termageddon's embed script, wrapped in the same brand chrome as the rest of the site. The styles in `styles.css` under the *Policy pages* section aggressively override Termageddon's injected styles so the policy text inherits the page's typography and respects the light/dark theme.

**Watch out for:** if Termageddon updates its embed and bleeds white background through in dark mode, or uses inline `style="..."` we haven't accounted for, the override CSS won't catch it. The fix is either to bump specificity on the `.policy-embed *` selectors with `!important`, or fall back to wrapping the embed in an `<iframe>` (which sandboxes Termageddon's styles entirely at the cost of visual continuity inside the policy).

## Local preview

```
cd public && python3 -m http.server 8000
```

- Landing: http://localhost:8000
- Privacy: http://localhost:8000/privacy.html
- Terms: http://localhost:8000/terms.html

Locally, the URLs need the `.html` extension. Cloudflare Pages serves them at the prettier paths (`/privacy`, `/terms`) once deployed. Internal links in `index.html` use the pretty paths and will only work after Cloudflare deploy.

The Termageddon embeds and the SureContact signup forms load from external scripts, so you'll need internet access for the policy text and the signup form to render. Without internet, the embeds show their fallback content (a link to the policy at termageddon.com, and an empty form container).

## Deploy

### One-time: GitHub repo
```
cd PlainMind-Website
git init
git add .
git commit -m "Initial landing site"
gh repo create plainmind-website --private --source=. --remote=origin --push
```

If you don't have `gh`:
```
git remote add origin git@github.com:YOUR-USER/plainmind-website.git
git branch -M main
git push -u origin main
```

### One-time: Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Pick the `plainmind-website` repo
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. **Save and Deploy**

The first deploy gives you a `*.pages.dev` URL. Test the form, theme toggle, and both policy pages there before pointing the custom domain at it.

### One-time: custom domain (plainmind.app)
1. Register `plainmind.app` (Cloudflare Registrar is easiest)
2. If using a different registrar: in Cloudflare dashboard → **Add site** → `plainmind.app`, then update your registrar's nameservers to the two Cloudflare gives you
3. In the Pages project → **Custom domains** → **Set up a custom domain** → enter `plainmind.app`
4. Cloudflare auto-creates DNS records and provisions an SSL cert (~1–5 min)
5. Optional: add `www.plainmind.app` and redirect to apex

## Updating

```
git add .
git commit -m "Tweak copy"
git push
```
Cloudflare Pages auto-deploys on every push to `main`. Each PR also gets a preview URL.

## Shared header & footer (layout sync)

The site is intentionally static with **no build step** — every nav and footer link is real markup in the page (best for SEO; no JS injection, no paint flash). The tradeoff is that the header and footer exist as **copies in every page**. To stop them drifting, there's a single source of truth:

- `_partials/header.html` and `_partials/footer.html` (repo root, **not** deployed — only `public/` ships).
- `tools/sync-layout.mjs` stamps those partials into each in-sync page between `<!-- partial:header:start -->…<!-- partial:header:end -->` markers.

**To change the menu or footer:** edit the partial, then run:
```
node tools/sync-layout.mjs
```
It rewrites all in-sync pages (idempotent — safe to run anytime). **Do not hand-edit the header/footer inside a page** — the next sync overwrites it. Edit the partial instead.

- **Full header + footer (in sync):** `index`, `beta`, `press`, `roadmap`, `help`, `privacy`, `terms` — the `PAGES` array in `tools/sync-layout.mjs`.
- **Footer-only (in sync):** `welcome/` — it has a unique minimal brand-only header (post-signup arrival) that's left untouched, but it shares the global footer (`FOOTER_ONLY` array). So a footer edit still reaches welcome; a header edit does not.
- Links in the partials are **root-relative** (`/`, `/assets/…`, `/beta/#beta-form`, `/privacy/`) so the block is byte-identical regardless of folder depth.

**Changes — 2026-06-14:**
- Header nav simplified + reordered to **How it works · Features · [Join the Open Beta]** (dropped the redundant "Beta" text link); propagated to all pages.
- Removed the four redundant "Learn more" buttons in the features section (+ their now-dead `.learn-more` CSS).
- Fixed `.beta-includes` perk cards (disc bullets + indent → `list-style:none; padding:0`).
- Founding-member **live count** (`/api/founders` + `js/founders.js`): staged/transparent — an open invite under 50 signups, the live "X of 200 left" from 50, "full" at 200; copy tuned per surface (`data-founders="signup" | "welcome"`).
- Introduced this header/footer sync system (`_partials/` + `tools/sync-layout.mjs`).
- **Redesigned `/welcome/` — "Founding Pass" (Direction B), from Claude Design handoff.** Split hero with an assembling Founding Member pass, "what happens next" steps, a roadmap preview, a soft founding-member band, a launch-day credit wall, and Keegan's note. Adds `welcome-plus.css` (web root) + `js/welcome-plus.js` (replaces `welcome.js` on this page; `welcome.js` is now unused). Built on existing tokens — no new palette. Reconciliations from the raw handoff: (1) restored the concrete **$19.99/yr-for-life + first-200 + badge** offer line in the founding section (handoff had omitted pricing); (2) the per-tester "founder no. 47" is replaced by the **live cohort count** via `/api/founders` — under 50 signups it reads "one of the first 200 founders," then the live count; no fake personal number (true per-tester numbering is Phase 2); (3) the founder standing line was moved into the (removed) "You're on the list" pill's slot to cut redundancy. Source bundle: `Concept Design/Welcome_Page_Design/`.
- **Welcome roadmap → live Featurebase board (no fake voting).** Considered pulling real items via the Featurebase API but it needs a paid plan, so that build was dropped. Instead the roadmap cards are a curated preview (status pills, no fabricated vote counts) that link out to the existing free board `plainmind.featurebase.app/roadmap`, plus a "See the live roadmap & vote →" CTA — real voting happens there. Removed the optimistic-vote JS/CSS.
- **Footer social icons fixed** — they referenced the inline sprite (`#icon-x`), which the new `welcome/` page doesn't embed, so they were blank there. Switched the shared footer partial to the external sprite (`/assets/icons.svg#icon-x`) so they render on every page; re-synced.
- **Root-cause fix for the recurring CSS staleness.** `welcome-plus.css` sits at the web root and matched neither `_headers` `no-cache` rule (`/styles.css`, `/js/*`), so browsers cached it across deploys. Added `/welcome-plus.css → Cache-Control: no-cache`. Removed the now-orphaned `js/welcome.js` (replaced by `js/welcome-plus.js`).

## Release day 2026-10-30 log: iOS 1.5.2 and macOS 1.5 released

- **iOS 1.5.2** was released 2026-10-27 at 11:26 AM PT (Apple's lookup:
  18:26:17Z). It contains one fix: a long website name in an item's type and
  source pill used to push the page past the screen edges; now it ends in "…".
- **macOS 1.5** was released by the user before 2026-10-30. Exact time not
  recorded: App Store Connect had signed out, and Apple's lookup shows only the
  iOS version for this universal app.
- Changes:
  - release entry 1.5.2 (same words as the app's What's New);
  - `LIVE` 1.5.2;
  - press line: "1.5.2 on iPhone and iPad (October 27, 2026); 1.5 on Mac".
  - The pill shows "New in 1.5" until 14 days after 1.5.2 (the x.y.z rule).
- **Consistency:** with the Mac on 1.5, the 1.5 notes' Mac lines are true now,
  and the store name "PlainMind: Save & Organize" is on both platforms. No
  other page described the Mac as 1.4.
- **Still owed for the Mac:** the long-source pill fix. iOS has it in 1.5.2; the
  Mac (same item page) needs macOS 1.5.2, or it comes with 1.6.

## Release day 2026-10-26: iOS 1.5.1 released

Released on iPhone and iPad 2026-10-26 11:57 AM PT (App Store Connect →
History). It brings the new store name "PlainMind: Save & Organize" and the
subtitle "Read Later, Links & Bookmarks" to iPhone. The Mac gets them with
macOS 1.5, still in review.

- **Release entry 1.5.1** ("A couple of fixes."), the same words as the app's
  What's New. `LIVE` is 1.5.1, at Apple's release time.
- **Press kit:** "1.5.1 on iPhone and iPad (October 26, 2026); 1.4 on Mac".
- **Hero pill fix (`functions/_lib/release-pill.js`):** headlines are keyed by
  version, and Apple now reports 1.5.1, which has none, so the pill would have
  dropped "New in 1.5" 12 days early. A bug-fix release now shows its
  version's line (1.5.1 → "New in 1.5: Make your own collections"), for 14
  days from the fix's release date. Checked with node against: 1.5.1 live,
  1.5 live, after 15 days, 1.6 submitted, an old x.y.z, and an unknown 2.0.

**When macOS 1.5 is released:** the press line becomes "1.5.1 on iPhone and
iPad; 1.5 on Mac", and the Mac lines in the 1.5 notes are true at last.

## Release day 2026-10-25: iOS 1.5 and macOS 1.4 released

Both went out 2026-10-25 at 10:59 PT (App Store Connect → History).

**Mac release day:** the Mac lines held back on 1.4's iOS day came back:
- the 1.4 release entry;
- the hero headline "PlainMind on the Mac";
- "iPhone, iPad or Mac" in the intro;
- the press kit's platforms line and Mac paragraph.

**1.5 release day:** `release-day/1.5` merged:
- pick-by-hand copy;
- the header card in the hero;
- 1.5 app colours;
- press kit "What's new in 1.5";
- the 1.5 release entry, dated 25 October 2026.

**Roadmap:** `NEXT` is **1.6 · in planning: iPhone Duo**, the one release item decided for 1.6. Duo left Exploring, and its copy no longer promises "list and detail side by side", which may not fit the 466pt outer screen.

**Consistency fixes:**
- The press kit's version line says "1.5 on iPhone and iPad; 1.4 on Mac". macOS 1.5 wasn't created yet: App Store Connect allowed no new macOS version while 1.4 was in review.
- The founders page said reading view "Shipped in 1.1". It shipped in 1.3.
- The founders page said founders can "vote" on the roadmap. There's no voting (decided against), so it now says "tell us what you want most".

**Still inconsistent until macOS 1.5 ships:** the 1.5 release notes and press section mention the Mac ("the sidebar on iPad and Mac", "On the Mac, right-click"), but the Mac runs 1.4.

## Release day 1.5: `release-day/1.5` (prepared 2026-10-20, branched from release-day/1.4)

Merge on 1.5's release day, after 1.4's branch is in `main`.

**Mac first.** This branch says "iPhone, iPad and Mac" (intro, press kit). If
macOS 1.4 is still not out on 1.5's release day, hold those words back as on
1.4's day (see "1.4 released on iOS; the Mac follows"). Re-merge `main` first
so the Mac release-day restore is included.

**What the branch changes:**
- Collections copy, "sorts itself" → "or pick by hand", in four places:
  - the intro
  - How it works: "Collections, found or made"
  - the capture section
  - Help: "Can I make my own?"
- The hero mock's collection page opens with the 1.5 header card.
- The mocks take the 1.5 app colours: the darker greys and the adjusted type
  colours, through `sync-app-tokens.mjs`.
- The press kit has "What's new in 1.5".
- The release history gains 1.5.

**On the day:**
- Fill the 1.5 dates, as for 1.4.
- **Set `NEXT` to the next scoped release.** `sync-roadmap.mjs` refuses while
  `NEXT` is still the version now live.

## Release day 1.4: this branch (prepared 2026-10-20, merge only when 1.4 is live)

`release-day/1.4` holds every website change 1.4's release makes. Merge it on
the day Apple releases 1.4 (Phase 9), not before.

**On the day:**
1. Fill the three placeholders:
   - `tools/sync-releases.mjs`, the 1.4 entry's `iso` and `date`
   - `tools/sync-roadmap.mjs`, `LIVE.releaseDate` (ISO time from App Store
     Connect → History)
   - `public/press/index.html`, the version line's "SET ON RELEASE DAY"

   Both scripts refuse to run while any of them is unfilled.
2. Run `node tools/sync-releases.mjs && node tools/sync-roadmap.mjs`, then
   `node tools/a11y-scan.mjs` and `node tools/logo-guard.mjs`.
3. Merge into `main`, push, and tag the iOS repo `v1.4`.

**What the branch changes:**
- The roadmap's next release becomes 1.5 (custom collections and the
  accessibility pass). 1.4 moves into the release history, with the app's
  1.4 notes and no em dashes.
- The hero pill gains a 1.5 line, "Make your own collections".
- The homepage intro adds the Mac and drops "with suggestions on". 1.4 turns
  suggestions on for new installs.
- The capture section drops "suggestions stay off until you turn them on".
- The finale repeats the hero headline. "Find it later." retires with the old
  App Store subtitle.
- The hero mock's second beat is the collection's own page (back, "Attention",
  ⋯), because 1.4 opens a collection. The 1.3 filter chip and its styles are
  removed.
- The press kit:
  - "for iPhone, iPad and Mac"
  - version 1.4
  - "What's new in 1.4"
  - "Yours to switch off" replaces "Off until you ask"
- Help says suggestions are on for new installs and where the switch is
  (Settings → Privacy & Security → Suggest collections).

## 1.4 released on iOS (2026-10-20); the Mac follows

iOS 1.4 was released 2026-10-20 at 10:47 PT. macOS 1.4 was still waiting for
review, so this release day shipped everything except the Mac: the site never
offers a download nobody can get yet.

**Mac release day** (the day macOS 1.4 is out), put these back:
- `tools/sync-releases.mjs`, the 1.4 entry: add "PlainMind on the Mac. Save
  from Safari with Share to PlainMind, and read your library in a window with
  the sidebar. One purchase covers iPhone, iPad and Mac, and Pro syncs all
  three." as the third item, and end the first-run item "an iPad on iPad, a
  Mac on the Mac."
- `tools/sync-roadmap.mjs`, `HERO_HEADLINES["1.4"]`: "PlainMind on the Mac".
- `public/index.html`, the hero lede: "your iPhone, iPad or Mac".
- `public/press/index.html`: "App: PlainMind for iPhone, iPad and Mac", and
  the "PlainMind on the Mac." paragraph first under What's new in 1.4.
- Then `node tools/sync-releases.mjs && node tools/sync-roadmap.mjs`,
  `node tools/a11y-scan.mjs`, commit, push.

## The old logo can't come back (2026-10-19)

The user saw the retired fanned-cards mark in their own browser. Every logo
file on the site was already the current circle-backed mark (each is
byte-identical to a fresh `make-logo-assets.mjs` render). The browser had kept
the old files: until 2026-10-12, `/assets/*` was served `immutable` for a
year, so it never asked again, and the later `no-cache` header could not reach
it. Every returning visitor from before that date was in the same position.

- **`tools/logo-guard.mjs` (new).** Every reference to a logo image (favicon,
  touch icon, header and footer icon, press-kit icons, Open Graph cards) now
  carries the image's content hash, for example `favicon-32.png?v=6a28cbfd`.
  A new image is a new URL, so a cached copy can't outlive it.
- **The check** (`node tools/logo-guard.mjs`) fails when:
  - a logo image differs from its pin in `tools/logo-manifest.json` (anything
    not made by the generator), or
  - any page references a logo without the current stamp.
- **After regenerating** the logos, run `--stamp`. `make-logo-assets.mjs` now
  says so.
- **Outside this repo:**
  - the old-mark files in Drive moved to `_Retired/`
  - `Branding/PlainMind_Brand.md` names the current mark and its one source
  - the app's Xcode Cloud build now fails if the old icon set returns
    (`ci_scripts/check_app_icon.sh`)

## Accessibility pass (WCAG AA), a real serif everywhere, and the critique's fixes (2026-10-19)

User decisions, 2026-10-19:
- Accessibility must be a pass.
- The critique's critical and consistency items get built. Collections in the
  main nav is the one recommendation held back.
- Site fixes ship as soon as they're built. Anything describing 1.4 or 1.5
  waits for its release day.

**The pass check.** `tools/a11y-scan.mjs` (new) scans every page in light and
dark, at desktop and phone widths, for:
- text contrast against the composited background
- images without alt text
- links and buttons without names
- a missing `lang`
- targets under 24px (WCAG 2.5.8)

The baseline had 1,126 failures; it now reports **0 failures**. Text over a
gradient can't be judged by a script, so it is listed for checking by eye.
Only `/welcome/` has any (the founding pass and the founding section); those
were checked from screenshots in both themes.

**Contrast.**
- Light secondary text goes from 0.64 to 0.74, and tertiary from 0.44 to 0.70.
  Dark tertiary goes from 0.42 to 0.55.
- The new `--accent-ink` (#436A6B) is for text on the Mist Teal tint.
  `--accent-readable` measured 4.25:1 there.
- The new `--sage-ink` is for success text.

**Targets.** Header and footer links get padding, and the footer social
circles are 44px.

**Phone mocks for screen readers.** Each mock is now `role="img"` with a
one-line description. Before this, VoiceOver read every string inside them,
keyboard letters included.

**Serif outside Safari.**
- Source Serif 4 (OFL; `public/fonts/`, 122 KB upright plus 130 KB italic) is
  self-hosted as "PM Serif".
- `size-adjust: 104.5%` matches New York's x-height and cap height.
- The stack is `ui-serif, "New York", "PM Serif", Georgia`, so Safari keeps
  New York and never downloads the web font. Chrome, Firefox and Windows were
  falling back to Iowan Old Style or Georgia.
- `/fonts/*` is cached for 30 days.

**Homepage (critique: critical and consistency).**
- The hero phone stayed half empty after the suggestion beat, because four
  rows fold away. Four more matching rows now keep it full.
- The detail mock showed a Redefined Creative agency page. It is now the
  app's own sample, "The quiet case for doing less" (fieldnotes.blog), with
  the layered-hills artwork drawn in CSS. `rc-preview.jpg` and
  `rc-favicon.png` are no longer referenced.
- The hero intro now says what PlainMind is (save from any app on iPhone or
  iPad, in one tap) before the collections hook. It still says suggestions
  are a setting, which is true for 1.3.
- The "A library that stays calm" section is gone, because the hero already
  shows the library. Four feature sections remain, alternating sides, and
  their label pills are removed.
- The teal italic accent is kept for the hero and the finale only.
- Trust row: "Stays on your device / No item limit / Export anytime".
- Privacy stats are static and concrete ("100% on your device by default /
  0 trackers in the app / No account needed").
- Taglines are down to two:
  - the hero line, "Save anything. It sorts itself."
  - the App Store subtitle, "Save anything. Find it later.", which the finale
    now uses
  - The footer's "A calmer way to capture what matters." is removed from
    every page.
- Mocks are 340px wide from 1024px up. They were 272px, which rendered the
  app's 12pt caption at 7.8px.

**App Store badge.** The hero and the finale use Apple's own "Download on
the App Store" badge in place of a "Get PlainMind" button:
- `public/assets/badges/`: black on light and white on dark, via the
  `.light-only` and `.dark-only` swap.
- The files are unmodified, from `toolbox.marketingtools.apple.com`; the
  black one is identical to the one on developer.apple.com.
- It is 54px tall, inside Apple's 40px minimum, with a quarter-height of
  clear space around it.
- The link is labelled "Download PlainMind on the App Store".
- The header keeps its compact "Get PlainMind" button.

**`/try/` (new).** The practice page the 1.5 app's onboarding opens for the
first save, so a new user isn't sent to a homepage that tells them to "Get
PlainMind". It is noindex and not in the sitemap. It must be live before 1.5
ships.

**Left for release day:**
- When 1.4 ships, the hero's "Collection: Attention" chip (the 1.3 filter)
  and "with suggestions on" in the intro both change.
- The 1.5 app's darker secondary text reaches the mocks via
  `node tools/sync-app-tokens.mjs` once 1.5 ships.

## No em dashes; phone mocks rebuilt to the app's measurements (2026-10-19)

User request: remove every em dash from the site (it reads as AI copy) and make
the phone mocks match the app's type, size and spacing as closely as a web page
can.

- **Em dashes: 0 visible on every page.** Each one was rewritten by hand (comma,
  colon, period, parentheses or " | " in `<title>`), not swapped for a hyphen.
  This also covers the generators (`tools/sync-releases.mjs`,
  `tools/sync-roadmap.mjs`, which both pass `--check`), the strings in
  `js/founders.js`, `js/signup.js` and `js/welcome-plus.js`, and
  `functions/api/subscribe.js`. Code comments still contain em dashes; they
  never render.
- **How the mocks were matched.** `tools/capture-mocks.mjs` (new) screenshots
  each `.phone-mock__screen` at one pixel per app point. Those shots were
  compared side by side with iOS 27 6.3" simulator captures of the app
  (`SiteCompareCaptureTests` in the iOS repo), and every value was taken from
  the app's code or measured off those captures. The tool loads lazy artwork,
  and `MOCK_CSS` can hold a mock in a chosen state.
- **Fixes that apply to every mock:**
  - The screen is now the device's true 402:874. It had been 22pt too tall,
    which put everything anchored to the bottom in the wrong place.
  - Status bar: 17pt semibold, with real signal, Wi-Fi and battery glyphs in the
    positions iOS uses.
  - Glass toolbar buttons are 44pt.
  - The tab bar is the iOS 27 size: 62pt tall, 25pt glyphs, 10pt labels in the
    primary colour.
  - Text tracking is corrected. CoreText spaces text by its rendered size, so a
    phone drawn at 65% picked up loose small-text spacing and ran about 6% wide
    (SF) and 4.5% wide (New York). `--track-sans` and `--track-serif` correct
    this, and Safari now truncates rows exactly where the app does.
- **Library and Collections:**
  - The meta line is the caption size (12pt), 4pt apart, with a tertiary dot.
  - Rows are 64pt, with the month header spaced as in the app.
  - Thumbnails replace the flat squares: artwork, tinted glyph tiles for notes,
    PDFs and places, and favicon tiles.
  - The suggestion card is the shipped `CollectionSuggestionCard`, using its
    real copy.
- **Search** is rebuilt as the app's focused state:
  - The field and close button.
  - The glass facets card in serif.
  - A 2×2 grid of Quick searches cards.
  - The Suggested searches header, subtitle and a suggested row.
  - The iOS 27 keyboard, measured.
- **Settings** is rebuilt from the 1.0 layout to today's:
  - The plan card.
  - Your Library: the Collections card and the Stats, Duplicates, Trash and
    Most Revisited grid.
  - The Privacy & Security switches, which now settle on once as the phone
    arrives (replacing the iCloud sync ring).
- **Detail:**
  - The summary and the Read · 1 min pill replace "Full text".
  - The Saved and Opened rows are added.
  - Nav buttons are 44pt glass.
  - Open Link is the deep-teal accent surface.
- **Dead CSS removed.** About 160 lines of the pre-D7 `.detail-*`, recents and
  keyboard rules went. One of them,
  `.phone-mock--detail .phone-mock__screen { padding: 30px 4px 14px }`, still
  applied and was offsetting the detail mock.
- **Footer fix:** at 375px wide the footer links ran 34px past the screen on
  every page. This was live before this change. `.site-footer__links` now
  wraps.
- **Known limit: fonts outside Safari.** The serif shows as New York only in
  Safari (macOS and iOS). Chrome can't reach New York at all, by name or with
  `local()` (tested), so Chrome, Firefox and Windows show Iowan Old Style or
  Georgia. That applies to the whole site's serif, headlines included. The fix
  is a self-hosted lookalike web font, which is not done yet (see the
  conversation of 2026-10-19).
- **Left for 1.4 release day:**
  - The hero's "Collection: Attention" chip is the 1.3 filter. 1.4 opens the
    collection instead.
  - The Settings footer copy in the app still has an em dash.
- Checked:
  - Every mock side by side with the app in Chrome, in light and dark.
  - The library mock in iOS 27 Safari (real New York and SF).
  - No horizontal scroll at 375px wide on `/`, `/press/`, `/releases/`,
    `/roadmap/`, `/welcome/` and `/help/`.
  - No console errors other than `/api/app-status`, which is a Cloudflare
    function and doesn't exist on a static server.

## Collections lead the homepage (2026-10-18)

User feedback came back twice, unprompted, naming auto-grouped collections as
THE standout feature. User decisions the same day: collections become the
primary positioning; the site changes **now, honest about 1.3** (suggestions
are still off by default until 1.4); the hero headline is replaced.

- **Hero:** "Save anything. / *It sorts itself.*" (was "Save what matters. Find
  it later."). The lede says how it actually works — your own words, on your
  device — and that suggestions are something you turn on. `<title>`, meta,
  Open Graph, Twitter and JSON-LD descriptions follow.
- **Hero visual:** the collections mock (suggestion offered → accepted → the
  library narrows), swapped in from the Collections feature block. It replays
  on a calm loop in the hero only (`js/collections-demo.js`; the feature mocks
  still play once). The beat is held by `.coll-offer`, a class of its own —
  `.in-view` also drives the phone's entrance fade, and reusing it hid the whole
  phone. The suggestion is held 3 s so it outlasts that fade.
- **The share-sheet demo** moved down into that block, now "Save from *any
  app.*", whose copy carries the collections detail (notes are what
  collections are made from; suggestions stay off until you turn them on).
- **How it works,** step 2: "Collections that make themselves".
- **Not wording it as AI** or "automatically groups your saves": it groups by
  the words the user writes. Overclaiming loses exactly the people who loved it.
- **When 1.4 ships** (suggestions on by default for new installs): drop "Turn on
  suggestions and it starts noticing" and "suggestions stay off until you turn
  them on"; update the press kit's "Off until you ask".
- Checked: desktop + 375-wide (no horizontal scroll), the hero loop frames, the
  share demo in its new block, no console errors. The local preview pane does
  not finish the headline's entrance animation; real iOS Safari (simulator)
  shows it fully.

## 1.3 release day (2026-10-18)

1.3 was approved by Apple on 2026-10-17 and released by the user on
2026-10-18 at 2:22 PM (App Store Connect history). Phase 9 of
`docs/RELEASE_PROCESS.md` (iOS repo), all on the day:

- `/releases` and the Released tab: 1.3 added at the top, its notes taken word
  for word from `ReleaseNotes.all` in the app.
- `/roadmap`: **Next is 1.4, stage "in development"** — Mac, a copy that
  outlives the link (Pro), highlights, contents for long articles, Ask Siri for
  a save, tidy your sources, and (new) feedback with diagnostics. **"The one
  after" is off the page** (`AFTER = null`): 1.5 is only candidates, and a
  numbered release made of candidates would promise what nobody decided.
- Hero pill: `HERO_HEADLINES["1.4"] = "PlainMind on the Mac"`, ready for when
  1.4 is submitted. Apple's lookup still answered 1.2 at release time (its cache
  lags), so the pill reads "Now on the App Store · v1.2" until Apple reports
  1.3, then "New in 1.3: PlainMind on iPad" for 14 days — by itself.
- Press kit: current version 1.3 — October 18, 2026; "What else is new in 1.2"
  replaced by "What's new in 1.3".
- Pushed.
- **The pill had stopped working, silently.** `/api/app-status` answered
  `ok:false`; the new `why` field showed Apple's lookup returns **HTTP 403 to
  Cloudflare's servers** (200 from anywhere else, with or without a
  User-Agent). The Function now sends a User-Agent and, when Apple still
  refuses, falls back to `live` in `release-status.json` — the version and
  App Store Connect release time written on release day (`LIVE` in
  `sync-roadmap.mjs`, a Phase 9 step from now on). Apple's answer wins when it
  gets through.

## Homepage hero pill — release status (2026-10-16)

The hero pill above the headline says where the app is, in a visitor's words
(user request: show when an update is in review):

| State | Pill | Links to |
|---|---|---|
| A version is with Apple | **Coming soon in 1.3:** PlainMind on iPad | `/roadmap/` |
| First 14 days after release | **New in 1.3:** PlainMind on iPad | `/releases/` |
| Otherwise | **Now on the App Store** · v1.2 | App Store |

- **Rule:** `functions/_lib/release-pill.js` (one pure function).
- **Live version:** Apple's public iTunes Lookup, fetched by the Pages Function
  `functions/api/app-status.js` (edge-cached 15 min) — not by the visitor's
  browser: the CSP allows same-origin only, and loading the homepage should not
  ping Apple.
- **Stage + words:** `tools/sync-roadmap.mjs` writes
  `public/data/release-status.json` from `NEXT.stage` and `HERO_HEADLINES`.
  Add a version's line to `HERO_HEADLINES` when its scope locks.
- **Cannot drift:** "Coming soon" needs stage `submitted` AND Apple still
  serving an older version, so a release nobody marks flips to "New in" on its
  own. No answer from Apple → the static "Now on the App Store" stays.
- Also: the Collections feature block's eyebrow said "New in 1.1" — now
  "Collections".

## ✅ PUSHED — 1.3 submitted to App Review 2026-10-16; the held roadmap commits went live that day

~~**Do not push this repo until 1.3 is submitted for review in App Store Connect.**~~ Submitted 2026-10-16 (build 159); pushed.
Pushing publishes it (Cloudflare Pages). Two commits are held:

- `/roadmap`: 1.3's chip moves from "in test" to **"with Apple for review"**
  (`stage: "submitted"` in `tools/sync-roadmap.mjs`, page re-stamped), and the
  1.3 list gains **"A first run that sets you up"** so it matches
  `ReleaseNotes.all` in the app. All three `--check`s pass.
- `/roadmap`: 1.4 gains **"Contents for long articles"** (reading-mode table
  of contents, assigned to 1.4 by the user 2026-10-16) — second held commit.

On submit: `git push`. On release: Phase 9 as for 1.2 below.

## 1.2 release day (2026-10-15)

1.2 was approved and released to the public on 2026-10-15. Phase 9 of
`docs/RELEASE_PROCESS.md` (iOS repo), all on the day:

- `/releases` and the Released tab: 1.2 added at the top, its notes taken word
  for word from `ReleaseNotes.all` in the app.
- `/roadmap`: **Next is 1.3, stage "in test"** (all eight items built
  2026-10-13, in device testing). **After that is 1.4 "Mac & reading"** — Mac,
  a copy that outlives the link (Pro), highlights, Ask Siri for a save, Tidy
  your sources. Those five left Exploring when they got a number, so nothing is
  listed twice; Exploring keeps the 1.5 candidates without numbers.
- Press kit: current version 1.2 — October 15, 2026 (the release-day marker
  comment is gone).
- Pushed, publishing every held commit with it.

## ✅ RELEASED — 1.2 went live 2026-10-15; the held commits below were pushed that day

*Kept as the record of what was held and why. Nothing is held now.*

### What was held

~~**Do not push this repo until App Store Connect shows 1.2 as released.**~~ Released 2026-10-15. Pushing
publishes (Cloudflare auto-deploys), and these commits describe 1.2 as current
and 1.3 as next. 1.2 was submitted to App Review on 2026-10-13 (build 139) with
release set to **manual**.

| Commit | What |
|---|---|
| `2e72bcc` | Social banners generated; press kit rewritten for 1.2 |
| `03ef78c` | Roadmap generated (`tools/sync-roadmap.mjs`) |
| `0cc627b` | Roadmap + press kit: the merge asks which name to keep |
| `d2da6e1` | App Store creative assets (`make-social-banners.mjs --appstore`) |
| `5923191` | Roadmap: 1.3 is "iPad and the front door"; 1.4 reading items join Exploring |
| `7031c7d` | Roadmap: 1.2 stage → submitted |
| `086cab6` | Roadmap: "reader typography" removed — never wanted; 1.3 has a text-only reading mode |
| `2b4a4ec` | Roadmap: "Tidy your sources" (source merge + hide) joins Exploring — 1.4 in the dev list (2026-10-15) |
| `9f6f812` | Roadmap: Siri search, iPhone Duo, plain-English search, searchable photos join Exploring (2026-10-15) |

**On release day, in order** (`docs/RELEASE_PROCESS.md` Phase 9 in the iOS repo):

1. Add 1.2 to the top of `RELEASES` in `tools/sync-releases.mjs` (keep it saying
   what `ReleaseNotes.all` says in the app).
2. In `tools/sync-roadmap.mjs`, promote 1.3 into `NEXT` — stage **`testing`**
   (all eight 1.3 items were built 2026-10-13 and are in device testing; set
   whatever is true on the day) — and give `AFTER` whatever follows.
3. Set the press kit's version line — the spot is marked with an HTML comment in
   `public/press/index.html`.
4. Run the checks, then push:
   `node tools/sync-releases.mjs && node tools/sync-roadmap.mjs && node tools/sync-roadmap.mjs --check && node tools/sync-releases.mjs --check`

## Roadmap and copy follow 1.3's locked scope; App Store creative assets (2026-10-13)

The five held commits that the two entries below don't cover:

- **1.3's public roadmap group** lists what a user would notice — iPad done
  properly, collection icons + ordering (Pro), bookmarks import, a text-only
  reading mode, listen (Pro). Its lede used to say *"One release, one job"*, which
  stopped being true when the parity audit showed iPad had no search; it now
  says what the release actually is. Offline archive and highlights (agreed for
  1.4) join *Exploring* with no version number.
- **"Reader typography" is gone from the roadmap.** It promised "choose the
  typeface, size and spacing" — a misread of the plan; the user never wanted
  typography customization anywhere. 1.3 has a text-only reading mode instead.
- **1.2's chip reads "with Apple for review"** — `NEXT.stage` set to
  `submitted`, as Phase 8 of the release process requires.
- **The merge copy** on the roadmap and press kit now says the user chooses
  which of the two names the merged collection keeps.
- **`make-social-banners.mjs --appstore`** renders the two App Store creative
  assets (Header, Search Results) at 5244×2950 into
  `App Launch/Screenshots/creative/`. Not the social set resized: Apple's asset
  rules forbid website URLs in a creative asset (so the Link chip shows a
  publication name, not a domain) and want the focal point centred (tighter safe
  box; the search asset drops the chips because it is shown small). Both are
  uploaded to the 1.2 version in App Store Connect.

## The roadmap is generated now, and it was wrong in both directions (2026-10-13)

**New tool: `tools/sync-roadmap.mjs`.** It owns `/roadmap`'s **Upcoming** and
**Not planned** panels; `sync-releases.mjs` already owned the Released tab.
Between them, nothing on that page is typed by hand any more.

It was fixed because it was wrong, and wrong in two directions at the same
time. "Next release" promised **"Collection icons and ordering"** — neither
built nor in 1.2's agreed scope — and omitted **every Pro collection feature**
plus the social-post cleanup. A public roadmap that overpromises and undersells
the same release is the Featurebase failure again, in our own HTML.

What the page says now: nine items under *Next release* matching
`ReleaseNotes.all` one for one, a new **"The one after"** group carrying 1.3 ·
iPad (the only other thing with a version number on it), and *Exploring*, which
is where icons-and-ordering actually belongs.

**The chip is derived, not typed.** `NEXT.stage` takes one of five values —
`planning`, `locked`, `building`, `testing`, `submitted` — which are the phase
names in `docs/RELEASE_PROCESS.md`, and the chip renders from it. So the public
page cannot claim a release is "in planning" while the build is with Apple. It
currently reads **1.2 · in test**.

```bash
node tools/sync-roadmap.mjs --check && node tools/sync-releases.mjs --check
```

Run that before any push that touches the roadmap.

🚫 **Still not pushed** — this commit and the press-kit commit (`2e72bcc`) go up
together on release day. The press kit describes a version the App Store has not
released yet, and they share a branch.

## The seven social banners are generated now, and the press kit is 1.2 (2026-10-13)

**New tool: `tools/make-social-banners.mjs`.** It renders all seven files in
`Branding/Social Header Image/` — X, Bluesky, Mastodon, LinkedIn, Threads,
Facebook, YouTube — at the dimensions they already had, so they drop straight
back into each network.

The banners were the **last hand-made logo surface**, exempted by
`make-logo-assets.mjs` on the grounds that they were designed artwork and
"need a human." That exemption is the whole reason they carried the previous
mark for four and a half months after the icon changed. Anything that cannot be
re-run is something that will be wrong again next time.

What it derives rather than chooses:

| | |
|---|---|
| the mark | `Branding/Logo Export/plainmind-mark.svg`, itself generated from `PlainMind/AppIcon.icon` |
| every colour | the `--app-*` tokens in `public/styles.css`, which `sync-app-tokens.mjs` generates from the app's asset catalog — so the type chips are the app's real colours, `--app-type-location` included |
| the wordmark face | New York, which is what the press kit says the wordmark is set in |

Two things worth knowing about the implementation:

- **The lockup is measured, not computed.** Node cannot measure New York's
  rendered width, and two attempts at guessing ran "PlainMind" off the right
  edge. A small script in the page measures the lockup after layout and scales
  it to fit the platform's safe box, clamped to 1 so it only ever shrinks. The
  chips take the same factor, which is what stops the 16:9 YouTube plate ending
  up with decoration larger than the brand.
- **Chips may never enter the safe box.** They are anchored to its edges and
  allowed to run off the frame with a mask fade, so the clipping reads as "more
  library beyond the frame" rather than as a broken export.

⚠️ **The May 2026 originals were overwritten in place.** They exist only in
Google Drive's version history now (right-click → *Version history*). They had a
blurred 1.0-era Library screenshot behind the cards and real third-party cover
art in the thumbnails — a film still, podcast artwork, an identifiable map pin.
The rebuild uses the app's own type chips instead, which is one fewer licensing
question to answer about a brand asset.

**`public/press/index.html` rewritten for 1.2** — the Collections section now
covers both ways a collection is born (suggested, or a pinned search; both
free) and what Pro adds (several phrases, merge, archive), and a new "What else
is new in 1.2" block covers source consolidation, renaming a source, the social
post cleanup and the search speedup.

🚫 **This press-kit change is committed and deliberately NOT pushed.** Pushing
publishes, and the page would then describe a version the App Store has not
released. On release day: push, and set the version line — it is marked with an
HTML comment at `public/press/index.html` where the date goes.

Still outstanding for the release-day website pass: a 1.2 entry in
`tools/sync-releases.mjs` (which stamps `/releases/` and the roadmap's Past
tab), and the roadmap's **"Next release"** group, which currently promises
"Collection icons and ordering" — neither built nor in 1.2's agreed scope — and
omits every Pro collection feature.

## Pro stops being "iCloud sync and a backup" (2026-10-13)

`/help`'s billing section said, in full: *"Pro adds iCloud sync across your
devices and automatic backup."* That was true in 1.1 and is the weakest possible
description of what 1.2 sells. Both of those are **infrastructure** — what Pro
runs on, not what it is for — and a reader comparing them against a free tier
that already does everything could only conclude Pro was Free plus a backup.

Rewritten to lead with what Pro actually does in 1.2: pin a search as a
collection, match more than one phrase, merge two collections that have drifted
into holding the same saves, archive one you're done with, rename a source.
iCloud backup is still there, last, where it belongs.

Two deliberate additions:

- **It names what stays free**, including collections that suggest themselves
  and one-site-one-source. Hiding those to make Pro look better would be selling
  against the product, and the free tier is the reason people trust it.
- **A new "Do I lose anything if I don't pay?" answer**, because that is the
  question the billing section was actually raising and never answered. No:
  everything saved stays on the device, searchable and exportable.

**Corrected the same day:** the first version of this put *pin a search* under
Pro, following the agreed 1.2 split. That was wrong in a way only visible from
the free side — a collection comes into existence exactly two ways, the engine
offering one or pinning a search, so gating the second left a free user able to
*receive* collections and never make one. The engine also ships off by default
and needs a phrase across three separate notes before it says anything. "Collections
are free" described something a free user could not reach. Pinning is free now,
and `/help` says so in its own paragraph; Pro keeps the shaping verbs.

Prices were already correct site-wide ($2.99/mo, $24.99/yr) and did not change —
confirmed on device 2026-10-13. Added the 7-day trial, which is annual-only and
was unmentioned. The landing page is untouched: it does not sell Pro at all,
which is a separate decision rather than a stale page.

## The logo was four months stale everywhere but the home screen (2026-10-12)

The shipping app icon has been the **circle-backed mark** since 2026-06-15
(`PlainMind/AppIcon.icon`, Icon Composer, iOS 26). Nothing else moved with it.
Keegan noticed the old mark on the iPad onboarding screen; the sweep found it in
eleven places, and the site was most of them: the header and footer logo on
every page, the favicon, the apple-touch icon, both press-kit icon downloads,
and — because `make-og-cards.mjs` embeds `plainmind-light.png` — all three
link-preview cards. Four months, and nothing caught it, because a PNG cannot be
diffed by eye and no one surface owned the others.

**So the rasters are generated now**, by `tools/make-logo-assets.mjs`, from the
icon itself: the geometry is lifted out of `AppIcon.icon/Assets/*.svg` and the
group transforms out of its `icon.json`. `--check` re-reads that source and
fails if it has moved, so the next icon change cannot silently orphan the site
again. `--ios` writes the app's asset catalog in the same run, which is the
whole point — one command, every surface.

- `plainmind-{light,dark}.{png,webp}` · `apple-touch-icon.png` · `favicon-32.png`
  · `source/*` · `press/plainmind-icon-{light,dark}.png`, plus a new
  `plainmind-mark.svg` (the canonical vector, in the repo, readable by a human).
- **Much smaller:** the header logo went 101kB → 14.3kB PNG / 3.5kB WebP, and
  the two press icons 1.4MB → 88kB each. The old ones were photographic renders
  of what is, underneath, four flat shapes.
- **No markup changed.** Every consumer already rounded the tile for itself
  (`.header-icon { border-radius: 22% }`, iOS masking the touch icon), so the
  files are still full-bleed squares at the same paths and dimensions.
- Re-ran `make-og-cards.mjs` after; the cards do not watch their input.

**What it deliberately does not do** is reproduce Liquid Glass. The home-screen
icon's gloss and specular are applied by iOS at render time from `icon.json` and
exist nowhere as pixels. What ships here is the same mark, flat, with a
restrained shadow and top-light — which is the right treatment for a 32px
favicon anyway, and is what the icon reduces to. Checked against the OS render
side by side before replacing anything.

**For the 1.2 rebuild:** the pricing/help pass must not hand-place a logo PNG.
Point at `/assets/plainmind-mark.svg` or re-run the generator.

### The deploy was correct and still would not have shown

Caught while verifying the push: `_headers` had `/assets/*` on
`public, max-age=31536000, immutable`, under a comment reading *"long-cache
fingerprintable static assets"* — but **nothing in `/assets/` is
fingerprinted.** The names are plain (`plainmind-light.png`,
`favicon-32.png`). `immutable` tells a browser not to revalidate at all, so
every returning visitor would have kept the old mark for up to a year while the
file on the origin was correct the whole time. Exactly the same shape of bug as
the logo itself: an assumption written in a comment that the files never met.

Changed to `no-cache` in `50fb59e` — and then **measuring the live site proved
the whole `_headers` cache story has never been true in production.**

```
/styles.css              cache-control: max-age=14400   (_headers says no-cache)
/js/main.js              cache-control: max-age=14400   (_headers says no-cache)
/assets/plainmind-mark.svg   max-age=14400              (new file, _headers says no-cache)
/assets/plainmind-light.png  public, max-age=31536000, immutable   cf-cache-status: HIT
```

Two separate things:

1. **A zone-level Browser Cache TTL of 4 hours is overriding `Cache-Control`
   from `_headers`.** 14400s is exactly that Cloudflare setting. It is not
   coming from this repo — every freshly-served file gets it regardless of what
   `_headers` says, which means `/js/*` and `/styles.css` were never `no-cache`
   either, and the comment claiming they were has been wrong since it was
   written. The `_headers` rules only take effect once the dashboard setting is
   **Respect Existing Headers**.
2. **The edge still holds the pre-2026-10-12 entries** for the old asset paths
   (`cf-cache-status: HIT`, replaying the stored `immutable`). Those need a
   cache purge; the new `plainmind-mark.svg` has no stale entry and shows the
   14400 override cleanly, which is what isolated cause 1 from cause 2.

Both fixes are in the Cloudflare dashboard, not in this repo. Until the TTL
setting changes, the real browser cache life is 4 hours — so the practical
exposure from the `immutable` header is much smaller than it first looked, but
the repo's cache configuration is decorative.

**Neither reaches a browser whose cache was already warm.** Only a URL change
does that. The durable fix is content-hashed filenames
(`plainmind-light.<hash>.png`), which would also let a long cache come back
honestly — not done here, because it touches every page's `<head>` and both
layout partials. Flagged, not assumed.

## Press screenshots finally current (2026-10-11)

The press kit had been shipping **2026-05-30 screenshots since launch** —
flagged four times, never done, because the assumption was that it needed new
device captures. It didn't: `App Launch/Screenshots/1.1-6.9inch/` already holds
real 1.1 captures at 1320×2868.

Both old shots were worse than merely stale:

- `screenshot-library-full.png` showed **1.0-era chrome** — filter pills always
  visible (1.1 hides them behind the filter button) and a centred month header.
- `screenshot-sharesheet-full.png` wasn't an app screenshot at all. It was the
  **marketing site** under an iOS share sheet, and the address bar read
  **`plainmind.pages.dev`** — the old Cloudflare preview domain. We were handing
  journalists a dead URL.

Replaced with three real 1.1 device captures — Library, a saved article, and a
Collection — with alt text that describes what is actually on screen instead of
restating the filename. The share-sheet shot is gone rather than re-staged; a
screenshot of our own website belongs in a press kit less than a screenshot of
the app.

## Roadmap tabs, and one source for the release history (2026-10-11)

The roadmap is now three tabs — **Upcoming**, **Released**, **Not planned** —
because those are three different questions and stacking them made the page a
scroll.

**Progressive enhancement, deliberately.** The markup ships with every panel
visible, each carrying its own `<h2>`. Nothing hides until `tabs.js` adds
`.rm-tabs--ready`, which is the only thing the CSS keys its hiding on. A
roadmap that renders blank without JavaScript would be a worse failure than
having no tabs. Full ARIA tabs pattern: roving `tabindex`, arrow keys,
Home/End, and readable deep links (`/roadmap/#released`) set with
`replaceState` so switching a tab doesn't jump the viewport.

**`tools/sync-releases.mjs` — the release history now has one source.** It was
about to exist twice: in full on `/releases/`, and as the Released tab. That is
exactly how the Featurebase board died — a second copy nobody remembered to
update. The data lives in the script; both surfaces are stamped between
markers; `--check` fails when either drifts.

The two renderings are deliberately different, which is the point of
generating them: `/releases/` gets the full notes, the tab gets a scannable
index — version, date, headline, and "12 changes in 1.1 →" into the full entry.
A reader on the roadmap wants to know *what* shipped and *when*; the detail has
a page of its own.

Adding a release is now one edit at the top of `RELEASES`, then re-run. Keep it
saying the same thing as `ReleaseNotes.all` in the iOS app — that is the copy a
user reads in What's New.

## Roadmap and help move onto the site; Featurebase retired (2026-10-11)

Featurebase was the public roadmap **and** the help centre. It had gone stale,
so it is abandoned. Both now live on plainmind.app.

**`/roadmap/`** was a doorway — a hero and a "View the live roadmap →" button,
no content of its own. It is now grouped **by release**, because "what's in the
next one" is the question people arrive with:

- **Next release** — the 1.2 candidates, chipped `1.2 · in planning`
- **Exploring** — real candidates, no release attached
- **Not planned** — tags/folders, sending the library to an AI, a feed, and
  another voting board

That last group is the point of the page as much as the first. For a product
whose pitch is partly what it refuses to do, the decisions *against* carry as
much as the ones for — and they stop the same requests coming back. The copy
is deliberately non-committal on dates, matching the page's own standing
promise: *"No promises with dates we can't keep — just direction."*

**`/help/`** had no content at all — it pointed at Featurebase, which (per the
user) never really had help docs either. It is now a real help page: nine
sections covering saving, the library, collections, search, sync, privacy and
locking, backup and export, billing, and troubleshooting.

**Every answer is drawn from the app's own copy**, not invented —
`BrandCopy.Settings`, `BrandCopy.Sync`, `BrandCopy.Storage`,
`BrandCopy.Collections` and `ContentType`. So the documented setting paths,
the exact wording of "Sync paused", what Clear cache deletes, and the fact that
**a purchase enables sync on the next launch** are all the product's own truth
rather than a plausible guess.

One page with deep-linkable sections rather than a page per topic: at this
volume it loads once, Ctrl-F covers everything, and there is a single file to
keep true to the app. Split it when a section outgrows the page.

`/welcome/` carried five more Featurebase links across four cards that were all
already marked "shipped" — those now point at `/releases/`, which is the public
record of shipped work, and its CTA goes to `/roadmap/`.

**Internal source of truth is `~/Developer/plainMind-ios/docs/ROADMAP.md`.**
The site renders a public view of it; that file stays the superset and carries
the parked and measured items that are not worth publishing.

## Link-preview cards are generated now (2026-10-11)

The three cards in `public/assets/og/` were drawn by hand in May 2026 and then
quietly rotted. The home card still read **"iOS · OPEN BETA SOON"** — eighteen
days after 1.0 shipped and two days after 1.1 — and the `/beta/` card still
said "Open Beta · TestFlight" even though that page's own `<h1>` had long since
become "PlainMind is on the App Store". Nothing caught it, because a PNG cannot
be `--check`ed.

`tools/make-og-cards.mjs` renders all three from the generated token block, the
same way the phone mockups and the detail asset do. Copy lives in one `CARDS`
array at the top of the file; a brand-colour change moves every card without
anyone touching copy at all.

```
node tools/make-og-cards.mjs            # write all three
node tools/make-og-cards.mjs --check    # fail if a card is missing
```

The design is the original's, matched against it band by band (brand lockup,
eyebrow, two headline lines, hairline, domain all land within a few pixels).
One deliberate change: the hand-drawn cards used `#6CA0A1` for the teal, which
is not a token and predates the design system. The generated cards use
`--app-accent-readable` (`#4A7475`), which is what `.accent` resolves to on the
page each card represents.

**What changed beyond the artwork**

- `/beta/` still had `og:title` "Open Beta — PlainMind for iOS" and was missing
  `twitter:title` and `twitter:description` entirely, so X fell back to the raw
  `<title>` and showed no description. Both added, title corrected.
- `og-beta.png` is deleted; that page's card is now `og-download.png`, named
  for what the page actually is.
- `og-home.png` and `og-press.png` keep their filenames but their **content**
  changed, and social scrapers cache by URL — so those references carry `?v=2`.
  Without it, every platform that has already scraped plainmind.app would keep
  serving "OPEN BETA SOON" from its own cache.

**Already-posted shares keep the old card** — their platform holds its own copy
and nothing we do reaches it. To refresh the common ones by hand:
Facebook `developers.facebook.com/tools/debug/`, LinkedIn
`www.linkedin.com/post-inspector/`, X `cards-dev.twitter.com/validator`.

## Mockups rebuilt to app geometry; the detail record is Redefined Creative (2026-10-10)

The phone mockups already took their **colours** from the app (see *App design
tokens are generated, not copied*, below). Their **geometry** was still
hand-copied, and it had drifted badly:

| element | app | the mock had | out by |
|---|---|---|---|
| `--mock-scale` | 260px ÷ 402pt = **0.6468** | `0.34` | 1.9× |
| row thumbnail | `Metrics.rowThumbnail` 44pt | 38px | +33% |
| row card radius | `CornerRadius.sheet` 16pt | ~8px | −50% |
| screen margin | `Spacing.lg` 16pt | 14px | +35% |

`--mock-scale` being roughly half the true ratio is why the single rule that
used it carried a magic `* 2.4` to cancel the error; every other rule was an
eyeballed pixel. The **type** scale, oddly, was nearly right — 11.5px against a
true 11.0px — which is how the drift stayed invisible.

### What changed

**`tools/sync-app-tokens.mjs` now generates layout and typography too.**

- `--mock-scale` is **derived**, not chosen: `(frame − 2×bezel) ÷ device width`.
  Change the frame width at the top of the generator; never at a use site.
- `--app-row-*` from `Metrics` (DeviceClass.swift), `--app-detail-*` from
  `D7Metrics`, `--app-bar-*` from `BottomBarMetrics`.
- `--app-text-*` — the SwiftUI TextStyle size table, the large end read out of
  `displayUIFont`'s own switch.
- `--app-tier-*` — **parsed out of the tier table in `BrandTypography.swift`'s
  own header comment**, which is the app's statement of record. Each tier emits
  a size, weight, family and colour, so a mock can wear a tier whole instead of
  re-deciding its three parts.

`--check` still fails the build when any of it goes stale.

**Every mock is now app points through `--mock-scale`.** The aliases on
`.phone-mock__screen` (`--sp-lg`, `--t-item`, `--row-h`, …) carry the app's own
names. A bare pixel in the mock CSS is now a bug unless it describes the
plastic — bezel, notch, handset radius — which the app has no opinion about.

**The item-detail mock was rebuilt to `DetailViewD7`.** It was a 112px gradient
band over a skeleton card; it is now the real hierarchy — in-flow hero artwork
with a gradient-masked blur band carrying the title and the type/source pill,
then one solid `D7GlassCard` holding three `detailSectionZone`s (Full text,
Details, Note), a glass action bar at the tab bar's width, and the tab bar.
`--d7-scroll` holds the page a little way down its own scroll: far enough that
all three zones clear the floating action bar, near enough that the title
clears the nav chrome.

**The hero share-sheet demo** got the same treatment — its library row was on
`CornerRadius.card` where the app uses `.sheet`, and it had no tab bar at all.

**Settings section headers** were uppercase and tracked; the app's are brand
serif subheadline, medium, primary, sentence case. The app tried uppercase and
abandoned it — the headers stopped working as scan anchors at eight sections.

### Corrected against the device, not the Simulator (2026-10-10, same day)

The first pass drew the tab bar as a capsule of tabs plus a **detached search
circle** — the iOS 26 reading of the `.search` tab role, and what the Simulator
still renders (`1.1-framed/02-menu.png`, a 9:41 capture, shows exactly that).

The **device** disagrees. `1.1-6.9inch/01-library.png` and `03-reader.png` are
real captures (4:44, 36% battery) and both show **one centred pill holding all
three tabs**, Search included.

That mismatch was also why the Open Link bar looked wrong.
`DetailViewD7.actionBarWidth` is `min(width * 0.68, 340) + Spacing.lg * 2`,
sized to match the tab bar's **centred** pill — against a full-width tab row it
read as too narrow for no reason. Both now derive from the same `0.68`, so they
line up by construction: measured in the browser, 176.8px wide and the same
centre, to the pixel.

Fixed in the four site mocks, the hero share-sheet demo and
`make-detail-mockup.mjs`.

While the device captures were open, one more gap: the **library toolbar** was
bare text and bare glyphs. On device, Select is its own glass pill and the
filter + ⋯ are one glass capsule — the same grouping rule as the detail page's
Share + ⋯ (adjacent trailing bar items with no spacer between them).

Then three more, all measured off `03-reader.png` rather than eyeballed:

| | device | mock had | now |
|---|---|---|---|
| gap, action bar → tab bar | 9.0pt | 3.7pt | 9.0pt |
| tab bar capsule height | 66.7pt | 58.3pt | 66.3pt |
| tab bar → screen bottom | 23.7pt | 26.0pt | 24.3pt |

The gap is `DetailBottomActionBar`'s `.padding(.bottom, Spacing.sm)`; at 3.7pt
the two pieces of floating chrome collided. The capsule was short because the
tab label inherited the page's global `line-height`, which inflated it to ~20pt
— pinned to 1.2.

**The selected tab is a lens, not a tint.** Sampled on device: the bar reads
`rgb(54,56,60)` over a `rgb(26,30,33)` page, and the selected tab falls back to
`rgb(28,32,35)` — the page showing back through the glass. The mock had a teal
wash, i.e. the selected tab *lighter* than the bar, which is backwards. The
glass itself is now mixed off the page colour through `--app-secondary`, which
flips with the theme: lighter in dark, darker in light, as the captures show.

**The Library glyph** was a single open book; the app uses SF Symbol
`books.vertical` — three spines, label ticks, the third leaning. Redrawn, and
the tab icon box went 22pt → 28pt because the device glyph draws ~24pt tall.

The small detail mock had to lose its "View more" row and the Saved detail row
to fit all three zones between the nav and the action bar without clipping —
the card was 64pt taller than the space available. The hi-res asset keeps both;
it has a whole screen to work with.

**Lesson for next time:** `App Launch/Screenshots/1.1-6.9inch/` holds real
device captures. Check a mock against those before trusting a code comment
about how a system control renders — the comment describes intent, the capture
describes iOS.

### The hand-picked record

The detail screen — in the mock and in `tools/make-detail-mockup.mjs` — is a
real save of **redefinedcreative.com**, Keegan's own business. Title and
description are the page's own `og:` tags; the body is its own copy; the hero
is its `og:image`; the favicon is real.

The source reads **"Redefined Creative"**, not the hostname, and that is what
the app would actually show: `DomainDisplayName` misses the curated table, then
`SiteNameResolver` route B matches the title's trailing segment letter-for-letter
against the domain label (`redefinedcreative`) — self-verifying, so one save is
enough.

The saved **title drops the `| Redefined Creative` suffix** the page serves.
Titles are tap-to-edit in the app and the source pill directly beneath already
carries the site name, so the suffix was duplicated. Pass `--record` to use the
raw `og:title` instead.

**The hero image is the weak link.** It is the real `og:image`, which is a busy
multi-coloured stock photo at 1100×733 — it fights the calm palette, and it
upscales ~2.2× to fill a 1320px-wide hero. `--art path.png` swaps it without
touching anything else.

### `tools/make-detail-mockup.mjs`

Rewritten to lay out at **440×956 — the device's size in points** — and render
at a device scale factor of 3, exactly as the phone does. `font-size: 34px` in
that file now *is* `.largeTitle`; `padding: 24px` *is* `Spacing.xl`. The old
version drew on a 1320px canvas and treated points as device pixels, so every
value carried a hidden ×3 (`118px` for a 34pt title) that could not be checked
against anything.

```
node tools/sync-app-tokens.mjs                      # after any app design change
node tools/make-detail-mockup.mjs --scale 1         # 1320×2868, dark
node tools/make-detail-mockup.mjs --light --scale 1
node tools/make-detail-mockup.mjs --scroll 430      # the sections, hero scrolled off
node tools/make-detail-mockup.mjs --record r.json --art hero.png
```

Outputs land in `App Launch/Screenshots/detail-*.png`. The record is data, not
markup — `--record` swaps the saved item without touching the layout.

## Hi-res saved-item detail mockup (2026-10-09)

`tools/make-detail-mockup.mjs` renders the item detail screen at **true device
resolution** — 1320×2868, the 6.9" iPhone — with no `--mock-scale` anywhere:
every value is the app's own point value at 1:1, so the output can sit beside a
real screenshot. Colours come from the generated token block, so it follows the
app the way the site does.

```
node tools/make-detail-mockup.mjs                      # dark @2x
node tools/make-detail-mockup.mjs --light --scale 1
node tools/make-detail-mockup.mjs --out some/path.png
```

Output lands in `App Launch/Screenshots/detail-{dark,light}@{1,2}x.png`
(@2x = 2640×5736).

**HTML rather than a screenshot** because a screenshot is one theme, one
article, one moment — it cannot be recut for a new size or headline, and it
goes stale silently. This re-renders correctly whenever the tokens change.

Layout was measured against a real device capture rather than eyeballed, which
corrected four things in sequence: the artwork runs to ~59% of the screen
height, the title sits low over it, the chip sits tight above the card, and the
card runs **off the bottom edge** — the page scrolls, it does not end in empty
space. The app also nests a lighter reader card inside a dimmer shell; a single
flat card loses that depth.

**The title colour follows the theme.** White over dark artwork, `--app-primary`
graphite over light — a white title on a pale hero is close to illegible, and
graphite is what the app's own token says in light mode.

The hero artwork is generated (layered gradients, blurred), not a photograph.
Swap in a real image by replacing `.art__img`'s background if a specific
article is ever needed.

## App design tokens are generated, not copied (2026-10-09)

The mockups kept going stale because every colour, radius and metric in them
was a **hand-copy** of a value living in the iOS app, and nothing caught drift.
They are now **derived**: `tools/sync-app-tokens.mjs` reads the app's own
sources and stamps the result into `public/styles.css` between
`/* app-tokens:start */` and `/* app-tokens:end */`.

```
node tools/sync-app-tokens.mjs           # regenerate
node tools/sync-app-tokens.mjs --check   # exit 1 if stale — wire into CI
```

Sources (override the app path with `PLAINMIND_APP`):

| Source | Gives |
|---|---|
| `Assets.xcassets/*.colorset` | 16 semantic colours with **light + dark** pairs |
| `Models/ContentType.swift` | the 8 content-type colours |
| `Utilities/Constants.swift` | `Spacing`, `CornerRadius`, `ShadowStyle` |
| `Utilities/Theme.swift` | `Stroke`, `Opacity`, `Hero`, `Layout` |

**The asset catalog is the right colour source, not `BrandPalette.swift`** —
the Swift file holds flat literals, the catalog holds the light/dark pairs the
app actually renders.

**Alpha is load-bearing.** `BrandSecondary` is `BrandPrimary` at 60%,
`BrandTertiary` at 40%, dark `BrandPrimary` is white at 90% and dark
`BrandDivider` is stone at 20%. A first cut dropped alpha and collapsed three
distinct text tokens onto one colour.

**Sizes are emitted as the app's raw point values**, scaled at the use site:

```css
border-radius: calc(var(--app-radius-card) * 1px * var(--hero-scale));
```

`--mock-scale` (feature mocks) and `--hero-scale` (the larger hero phone) are
**ours**, not the app's, so they live in the site's own `:root` — putting one
inside the generated block made `--check` fail, correctly.

**What the hand-copies had wrong:** mock meta text was `0.5` where the app's
`BrandSecondary` is `0.6`; dark body text was `0.92` against the app's `0.9`;
and only five of the eight content-type colours existed, so a music, podcast or
video row could not be drawn in its real colour at all.

**Still raw numbers:** typography sizes in the mocks, and most padding. The
tokens exist (`--app-space-*`) — wiring the rest is mechanical.

## App mockups rebuilt for 1.1 (2026-10-09)

The site's phone mockups are **hand-coded HTML/CSS**, not video — five of
them, and all five were behind the shipped app. The giveaway was a standalone
type pill (`Link`, `Place`) above each row title: that control was removed in
the row density pass, so the site was advertising something the app no longer
has.

**The animation was never the problem.** `share-demo.js` drives the hero
through nine phases with CSS doing the motion, handles `prefers-reduced-motion`
and pauses off-screen and on hidden tabs. It is untouched. Only the markup it
animates was stale.

| Mockup | Change |
|---|---|
| Hero (`demo-phone`) | two-line rows, `Select · Library · filter + more` toolbar, month marker with hairline |
| `phone-mock--library` | same row treatment; **the permanent type-chip row is gone** — 1.1 hides the filter row until asked, and it no longer holds collections or sources |
| `phone-mock--detail` | **rebuilt**, not re-skinned: 1.1 replaced the card stack with one scrolling page under full-bleed artwork |
| `phone-mock--search` | Type/Source/When facets card (Power search folded in), quick searches now week/month/**year**, suggested searches added |
| `phone-mock--settings` | Collections row under Your Library |
| `phone-mock--collections` | **new** — see below |

Two details worth keeping in mind when editing these:

- **Entrance stagger.** The library mock used to stagger chips (0.16–0.41s)
  then rows (from 0.46s). With the chips gone the rows start at 0.16s, or the
  animation opens on half a second of nothing.
- **Screen overflow.** The search mock's facets card plus the keyboard
  overflowed the phone; facet padding is deliberately tight and the suggested
  list is two rows, not three.

**New Collections section** (`phone-mock--collections`), placed after the
library block since collections are a property of the library. Two beats on one
scroll-in, using the existing `.anim-host` / `.in-view` trigger rather than a
loop — the suggestion card sits **above a populated library** (which is where
the app puts it), then collapses as the chip appears and the non-matching rows
fold away. An earlier cut faded the list in from nothing, which implied the
library was empty until a collection existed. Reduced motion holds beat one and
hides the chip, because showing the applied chip beside the offer would put a
collection on screen the user is simultaneously being asked whether to create.

Landing copy gains a "New in 1.1 / Collections that make themselves" block —
the page previously mentioned Collections **zero times**.

All mock content is now neutral; the mocks previously named real places and a
real video platform, and the hero used a real publication's domain.

## Release history page + stale roadmap cards (2026-10-09)

**New `/releases/`** — a public changelog, one entry per App Store version,
newest first. Built from the app's own `ReleaseNotes.all` so the in-app
"What's new" sheet and the site say the same thing; keep them in step when a
version ships. Dates are the **Ready for Distribution** timestamps from App
Store Connect, not submission or approval dates:

| Version | Released |
|---|---|
| 1.1 | 2026-10-09 (approved 2026-10-05) |
| 1.0 | 2026-09-24 |

Page follows the standard scaffolding (theme bootstrap, `styles.css`, partial
markers) and is registered in `tools/sync-layout.mjs` `PAGES`, so it gets the
shared header and footer. **Footer gained a `Releases` link** — edited in
`_partials/footer.html` and synced to all nine pages. Added to `sitemap.xml`.
Styles are a `.release*` block appended to `styles.css` (existing tokens only;
two-column on desktop, stacked on phones, sticky version number dropped at
≤640px where it fought the scroll).

**Four `/welcome/` roadmap cards were wrong** and had been since launch. They
are hardcoded (no Featurebase sync — see 2026-06-14), so nothing corrected them
as features shipped:

- *A calm reading view* — "In progress" → **Shipped in 1.1**
- *Collections that make themselves* — "Building" → **Shipped in 1.1**
- *Shortcuts & automation* — "Planned" → **Shipped** (the App Intents provider
  predates 1.0, so this was wrong on launch day)
- *Bulk actions in the library* — "Planned" → **Shipped** (select → share,
  refresh, delete all exist)

The `shipped` status style already existed in `welcome-plus.css`. The section's
own copy says "planned, in progress, and shipped", so nothing else needed
rewording — but **the section now previews four shipped items and nothing
upcoming**, which defeats its "help decide what we build next" purpose. Pick
the next items from Featurebase and swap them in.

**Press kit corrected (2026-10-09).** All three verified against primary
sources, not PROJECT.md:

- **Launch date** — was `September 29, 2026` in both the facts block and the
  About paragraph. App Store Connect's version history has 1.0 going *Ready for
  Distribution* on **September 24**. Fixed, and the About paragraph moved out of
  the pre-launch future tense ("launches on…" → "has been on the App Store
  since…"). Added a `Current version` line.
- **Pricing** — was `Pro $3.99/mo or $29.99/yr · Max $9.99/mo or $79.99/yr`.
  The live App Store listing reads "Pro is **$2.99 per month or $24.99 per
  year**", so Pro was a dollar over on both plans. **Max was removed entirely:
  it is not sold.** `Monetization.proEntitlement` is annotated "all 5 products",
  nothing in `Views/` references `maxEntitlement`, and the paywall and Compare
  Plans screens offer Free and Pro only.
- **Collections** — new "Collections, and why they make themselves" block,
  placed after About. Written from the app's own teaching copy, so every claim
  is checkable in `BrandCopy.Collections`: notes only (never titles or saved
  contents), on-device matching, suggestions off by default, deleting a
  collection destroys nothing, dismissed suggestions are not re-offered.

A site-wide sweep confirms no stale price or launch date remains.

**Still stale, not changed (needs a decision):**
- **Press kit screenshots** (`assets/press/screenshot-library.*`,
  `screenshot-sharesheet.*`) are dated **2026-05-30** — they predate 1.0's
  shipped design, never mind 1.1. A 1.1 library capture exists at
  `App Launch/Screenshots/1.1-6.9inch/`; there is no 1.1 equivalent of the
  share-sheet shot, which needs a fresh device capture.
- **Landing page never mentions Collections**, the headline 1.1 feature. Its
  feature set is still 1.0's.

## Welcome page — the tagging contradiction, resolved (2026-09-30)

The site promised two opposite things. The landing page and the press kit both
say **"No tagging, no folders"**; `/welcome/` had three roadmap cards promising
tags — "Tags you can nest — folders within folders, as deep as you like",
"Save, **tag**, and file from your own Shortcuts", and "Select many, then
**tag**, move, or clear them".

**No tags is the decision**, and the app now has the thing that replaces them:
automatic, note-derived Collections, shipping in 1.1. So:

- The nesting-tags card is now **"Collections that make themselves"**, status
  changed from Planned to **Building**, describing what was actually built —
  you write a note, and when a phrase turns up across a few saves PlainMind
  offers to group them. It is the opposite of folders, which is why it can sit
  beside "no tagging, no folders" without contradicting it.
- The Shortcuts card drops "tag": "Save straight from your own Shortcuts".
- The bulk-actions card drops "tag" for verbs the app actually has:
  "refresh, export, or clear them".

**Worth a separate pass:** Featurebase is the source of truth for the public
roadmap, and these welcome cards are **hardcoded with no sync to it**. They
drifted once and will drift again.

## 1.0 launch conversion — beta signup removed (2026-09-24)

**PlainMind 1.0 was approved by App Review on 2026-09-24.** The site no longer recruits beta testers; every
conversion point is now a link to the App Store (`https://apps.apple.com/app/id6780289082`).

What changed:

- `_partials/header.html` — the header CTA went from "Join the Open Beta" (`/beta/#beta-form`) to **"Get the app"**,
  and from `.btn-outline` to `.btn-primary` since it is now the primary action. Propagated to all 7 in-sync pages
  with `node tools/sync-layout.mjs`.
- **CTA label is "Get PlainMind"** on every download button, including the header. The label deliberately does not
  name the destination, so the supporting note under each button carries it: "Free on the App Store. …".
- `public/index.html` — hero pill "Upcoming Open Beta" → "Now on the App Store"; **both signup forms replaced with
  the new `.store-cta` block**; final-CTA heading → "PlainMind is here. / Save what matters."; trust signals →
  Free to use / No account needed / Private by default; `og:description` no longer says "Open beta opening soon";
  schema.org gained `downloadUrl` + `installUrl`; the dead `#beta-signup` anchor id became `#get-the-app`;
  `signup.js`, `founders.js` and the Turnstile script tag were dropped (nothing on the page uses them now).
- `public/beta/index.html` — **kept at the same URL on purpose** (old emails and the sitemap point at it) and
  repurposed into "PlainMind is on the App Store" plus a thank-you to everyone who signed up.
- `public/welcome/index.html` — it promised "we'll email your TestFlight invite the moment the beta opens", which
  would never arrive. Now reflects a shipped app: the pass reads "Founding Member" (was "Beta Member") and step 3
  is "Claim your badge" with a download button.
- `public/claim/index.html` — **fixed a live broken link**: the fallback still pointed at the literal placeholder
  `idAPP_STORE_ID`. Same bug that was in the iOS app's `Constants.swift`.
- `public/styles.css` — added the `.store-cta` block, sized to keep the hero/final-CTA rhythm the forms had.

`js/signup.js`, `js/founders.js` and `functions/api/subscribe.js` are **left in place, unused**. Both scripts bail
early when their elements are absent, and the Function is harmless. Keeping them means the signup flow can be
restored for a future beta without rebuilding it.

**Deploy ordering matters:** the repo auto-deploys to Cloudflare Pages on push, and the App Store link 404s for
users until the app is actually *released* (approved ≠ released; release is Manual). Do not push this until
**Release This Version** has been clicked in App Store Connect.

## Beta signup → SureContact (Cloudflare Function)

The signup no longer uses SureContact's JS embed. The on-brand form posts to a **Cloudflare Pages Function** that talks to the SureContact REST API server-side (so the API key is never exposed in the browser).

**Updated 2026-06-09 — LIVE & verified.** Signups now flow into a SureContact **Workflow** (Automations → Workflows → "PlainMind Signup") via **list membership**, not a direct sequence enroll. The Function adds each signup to the **"PlainMind Beta" list**; the workflow triggers on "contact added to that list" and runs the emails (welcome + enroll in the beta sequence). Rationale: this makes list membership the first, *guaranteed* step (independent of whether the workflow runs), which is the priority — "no matter what, the signup is on our list." End-to-end verified on `plainmind.pages.dev`.

**Flow:**
1. Hero / final-CTA form (`js/signup.js`) → `POST /api/subscribe` with `{ email, enroll: true }`.
2. `functions/api/subscribe.js` upserts the contact (`POST /api/v1/public/contacts/upsert`) and adds them to the **PlainMind Beta list** (`POST /api/v1/public/contacts/{uuid}/lists/attach` with `{ list_uuids: [SURECONTACT_LIST_UUID] }`), authing with `X-API-Key`. The list-add is what fires the workflow.
3. On success, `signup.js` stashes the email in `sessionStorage` and redirects to `/welcome/`.
4. `/welcome/` (`js/welcome.js`) shows the calm "introduce yourself" prompt, posts `{ email, first_name }` to the same `/api/subscribe` (upsert updates the existing contact), and personalizes the greeting. If no email is in `sessionStorage` (direct visit), the name step is skipped.

**Setup (one-time, in the Cloudflare Pages project):**
- Settings → Environment variables:
  - `SURECONTACT_API_KEY` — **encrypt as a Secret.** Your SureContact API key — needs **read + write** (the list-attach validates the list/contact, so a read-less key fails with `403 API_KEY_INSUFFICIENT_PERMISSIONS`).
  - `SURECONTACT_LIST_UUID` — the **"PlainMind Beta" list** UUID. Signups are added to this list, which triggers the "PlainMind Signup" workflow. (Replaced the old `SURECONTACT_SEQUENCE_UUID` — the sequence now runs *inside* the workflow.)
  - `TURNSTILE_SECRET_KEY` — **encrypt as a Secret.** The Cloudflare Turnstile secret key for this widget. The Function verifies every beta signup server-side against `siteverify`; without it, signups are rejected with "Signup is not configured yet."
- The `functions/` directory lives at the **repo root** (sibling to `public/`), which is where Pages looks for Functions when the build output dir is `public`.

**Turnstile (bot protection):**
- Each signup form (`index.html` hero + final-CTA, `beta/index.html`) embeds a `<div class="cf-turnstile" ...>` widget and loads `https://challenges.cloudflare.com/turnstile/v0/api.js`. The widget is set to `data-appearance="interaction-only"` (invisible unless a challenge is needed) and `data-theme="auto"` (follows light/dark).
- The public *site* key lives in all three forms (`data-sitekey`); the matching *secret* key is in the `TURNSTILE_SECRET_KEY` env var above. The Turnstile domain must also be allowlisted in the CSP (`public/_headers`) under `script-src`/`frame-src`/`connect-src` — and the deployed hostnames (`plainmind.app`, `plainmind.pages.dev`) added to the widget's Hostname Management in the Turnstile dashboard.
- `signup.js` posts the widget's `cf-turnstile-response` token as `turnstile_token`; the Function calls `siteverify` and only proceeds on success. The `/welcome` name update reuses the endpoint but is not gated on Turnstile (it's not a new enrollment).

**SureContact API shapes — confirmed against the live API (2026-06-09):**
- upsert wants identity fields nested under `primary_fields`: `{ primary_fields: { email, first_name } }`
- the created/updated contact's id is at `response.data.uuid`
- **add to list:** `POST /contacts/{contact_uuid}/lists/attach` with `{ list_uuids: [uuid] }`. ⚠ The path is **`/lists/attach` with a SLASH** — the hyphenated `lists-attach` (from older doc summaries) **404s** with "Resource not found". Companions: `/lists/detach`, `/tags/attach`, `/tags/detach`; list-side equivalents are `POST /lists/{uuid}/contacts/add` + `/contacts/remove`.
- the API key needs **read** permission as well as write — the attach validates the contact + list; a read-less key returns `403 API_KEY_INSUFFICIENT_PERMISSIONS` (GETs 403, and the attach 404s).
- (reference) direct workflow start exists — `POST /contacts/{uuid}/automations/{automation_uuid}/start` — but it does **not** fire a workflow whose first node is an *Incoming Webhook* trigger; that's why we switched to a **list-add trigger**. Direct sequence enroll (`POST /sequences/{uuid}/enroll` with `{ contact_uuid }`, Sequence only) now runs inside the workflow rather than from the Function.

**Local testing:** `/api/subscribe` only exists when Functions run, so a plain `python3 -m http.server` won't hit it — use `npx wrangler pages dev public` (with the env vars set locally) to exercise the full flow.

**At launch:** the same single CTA component becomes "Download on the App Store"; the `/welcome` flow can be retired or repurposed.

## Founder store (Phase 2 — `/api/founder-claim`)

The first-200 founder program needs a per-person founder **number**, which SureContact can't provide (no enrollment order). A Cloudflare **D1** database (`schema.sql`) is the authority: one row per signup, `number` (1..N) = signup order, first 200 = founders. Full design: `App Launch/PlainMind_Phase2_Monetization_Scope.md`.

- `/api/subscribe` assigns a number on signup (`INSERT OR IGNORE`, best-effort — skipped if D1 unbound).
- `/api/founder-claim` (`{email}`) → `{founder, number, of:200, token}` for the in-app numbered badge + the gated $19.99 founder SKU. `token` = HMAC(`number:email`) for anti-spoof.
- `/api/founders` reads the D1 count (falls back to the SureContact list count).

**Setup (one-time) — ✅ DONE 2026-06-14** (D1 provisioned, schema loaded via the dashboard D1 console, bound as `DB`, `FOUNDER_TOKEN_SECRET` set, validated end-to-end with a test signup → `#1`, then reset to zero):
1. `wrangler d1 create plainmind-founders`
2. `wrangler d1 execute plainmind-founders --remote --file=schema.sql`
3. Pages → Settings → Functions → **D1 bindings**: bind the database as **`DB`**.
4. Pages → Settings → **env vars**: add **`FOUNDER_TOKEN_SECRET`** (Secret; any long random string).

**No backfill needed** — there are no founders yet, so the store starts at zero and the first signup becomes **#1**.

⚠ **Pre-launch cleanup gotcha (learned 2026-06-14).** The schema uses `AUTOINCREMENT`, so SQLite remembers the highest number ever assigned in the internal `sqlite_sequence` table. **`DELETE FROM founders` alone does NOT reset the counter** — after a test signup took `#1`, the *next* signup would become **#2**, leaving no founder #1. To fully reset after *any* test signups (so real founder #1 is #1), clear **both** tables:

```sql
DELETE FROM founders;
DELETE FROM sqlite_sequence WHERE name='founders';
```
Then verify both `SELECT COUNT(*)` return 0. (This is the final step before go-live if testing happened on the live D1.)

All D1 access is **defensive**: deploying these Functions before `DB` is bound does *not* break signup or the live count — the founder features stay dormant until D1 exists.

## What to verify before launch

Visual checks (do these in a real browser after local preview or after first Cloudflare deploy):

- [ ] Landing hero shows the locked tagline: **"Save anything. Find it later."**
- [x] ~~Both signup forms render and accept submissions~~ — **removed 2026-09-24** at the 1.0 launch conversion; both are now App Store links
- [ ] Theme toggle cycles System → Light → Dark and persists across reloads on **all three pages**
- [ ] Dark mode looks correct on landing, /privacy, and /terms (footer toggle is the fastest way to flip)
- [ ] Phone mockups don't break at narrow widths (≤ 380px)
- [ ] /privacy loads the Termageddon embed; policy text inherits page typography in both themes
- [ ] /terms loads the Termageddon embed; same theme inheritance
- [ ] Footer Privacy and Terms links point at `/privacy` and `/terms` and load the right pages
- [ ] Contact link in footer opens mail to `support@plainmind.app`
- [ ] Privacy intro contact link opens mail to `privacy@plainmind.app`

If Termageddon's styles bleed through (e.g., the policy text appears in Arial on a white background while the page is in dark mode), bump CSS specificity on `.policy-embed *` selectors with `!important` declarations, or wrap each embed in an `<iframe>` to sandbox their styles entirely.

## What's still TODO (post-foundation)

`/beta`, `/press`, `/help`, and `/roadmap` now exist as pages (no longer just Launch-Schedule references). Outstanding items:

- **Policy pages — RESOLVED 2026-05-31: live Termageddon embed (option A).** User chose the embed over static markup (keeps the policy legally current automatically). Implemented: `/privacy` (`privacy/index.html`) and the new `/terms` (`terms/index.html`) each render their Termageddon embed inside `.policy-embed`; `*.termageddon.com` (+ apex) allowed in the CSP across script/style/img/font/connect/frame-src — a single host (`policies.termageddon.com`) was NOT enough: the embed script loads but then fetches the policy body from another Termageddon subdomain, which a narrow CSP blocked (symptom: "There was an error loading this policy"); stale root `privacy.html`/`terms.html` deleted; theme-aware `.policy-embed` override CSS added to `styles.css`. Privacy UUID `VEVa…`, Terms UUID `UkRR…`.
  - **⚠️ Must verify in-browser (can't be previewed here):** load `/privacy` + `/terms` in **light AND dark** after deploy — confirm the injected policy text inherits brand typography and isn't white-bg/Arial. If Termageddon bleeds through, tighten the `.policy-embed *` overrides (more `!important`) or fall back to an `<iframe>`.
  - **RESOLVED 2026-05-31:** `/terms` link added to the footer legal nav across all 7 pages.
- **Analytics — Fathom wired, ad-blocker gap accepted (2026-05-31).** `cdn.usefathom.com` script (`data-site="NCTQOJDN"`) on all 8 live pages + allowlisted in the `_headers` CSP (`script-src` + `connect-src`). **Known limitation, accepted by user:** ad blockers and **Safari** block `cdn.usefathom.com`, so Fathom undercounts — likely *materially* here since the audience is iPhone/Safari-heavy. Fathom's **custom-domain** workaround is **deprecated** (blockers catch it too), so it's not an option. Decision: accept the gap for now; use the **Cloudflare dashboard's edge traffic** for unblockable true volume, Fathom for engaged-visitor detail. **Escape hatch if the gap matters later:** reverse-proxy the Fathom script + event collection through a first-party Cloudflare Pages Function (serves from `plainmind.app`, evades most blockers) — deferred, not pre-launch.

- **`/roadmap` + `/help` → Featurebase link-outs (2026-05-31).** Per user decision, these pages no longer host content on-site. Each keeps its on-brand hero + a primary button that links out: `/roadmap` → `https://plainmind.featurebase.app/roadmap`, `/help` → `https://plainmind.featurebase.app/en/help` (both `target="_blank" rel="noopener noreferrer"`). Featurebase is the single source of truth for the public roadmap + help docs. (Embed wasn't viable: Featurebase exposes no roadmap embed snippet, and its `featurebase-js` SDK is React-only with no roadmap surface — wrong tool for a static site.) **Dead code removed:** the old `.roadmap-*`, `.help-search/layout/toc/empty`, `.faq*`, and `.placeholder-note` CSS plus `js/help.js` were deleted (all recoverable in git if a hosted version is rebuilt later). **Note:** both `/roadmap` and `/help` are now in the footer nav (the nav's `aria-label` was changed from "Legal" to "More" since it now mixes legal + resource links: Privacy · Terms · Help · Roadmap · Contact).

The favicon is currently the 192×192 PNG, which works but isn't ideal. A proper multi-size `.ico` file or modern SVG favicon could be added at any point.

## Notes for next iteration

User feedback after the first animation pass (2026-05-27):

**Animations land as "stale pulses" rather than calm-but-noticeable.** The current scale-up/scale-down loops are mechanically subtle but emotionally dead — they oscillate forever with no narrative. Next pass: replace pulsing with **directional motion that has intention and resolves**. Concrete direction per section:

- **Save from Any App** — PlainMind icon should *arrive* into the share sheet (slide in from off-canvas right with a slight settle) once per hover/in-view, not pulse. Optionally, a single subtle ambient glow that fades in over ~2s and stays steady — no oscillation.
- **Auto-Organize** — filter chip cycle is the animation; remove any pulsing on individual items. The chip slide between filters needs more visible motion (longer travel distance, slightly slower easing) and item reflow should be more noticeable (stagger items in/out over ~400ms with translateY + opacity, not just opacity).
- **Powerful Search** — replace pulsing tap indicator with **one** ripple that emanates and fades once, then the quick-search row lifts/highlights and stays in that state. One-shot, no loop.
- **Calm Private Space** — replace pulsing cloud icon with a single sync arc (one dot traces a 270° path around the cloud over ~1.5s, then settles into a checkmark or sync indicator). Stats badge count-up is already directional and probably feels right.

General principle: **calm ≠ rhythmic loop. Calm = slow build + intentional resolve.** Cubic-bezier(0.16, 1, 0.3, 1) for entrance, but extend durations to 800ms–1.5s where motion is the message. Avoid any `animation-iteration-count: infinite` on visible motion.

Other things noted but not changed in the first pass:
- (None at the time of this writing)
