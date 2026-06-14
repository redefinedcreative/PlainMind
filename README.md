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

## What to verify before launch

Visual checks (do these in a real browser after local preview or after first Cloudflare deploy):

- [ ] Landing hero shows the locked tagline: **"Save anything. Find it later."**
- [x] Both signup forms render and accept submissions; the email lands in SureContact (verified 2026-06-09 — contact created → added to PlainMind Beta list → "PlainMind Signup" workflow fires → welcome email)
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
