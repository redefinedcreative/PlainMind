# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: iPhone savers.** People whose links, screenshots, PDFs, places and notes are scattered across tabs, bookmarks and the camera roll, and who keep losing the things they meant to keep. Most arrive on an iPhone, from social posts or App Store search. Their job on this site is to decide whether PlainMind is the calm place for those things. **Success is a tap through to the App Store.** (Confirmed 2026-10-19.)

The site also has pages for other audiences. They exist in the repo but were not ranked against the primary visitor:
- founding members (`/welcome/`, `/claim/`)
- press and reviewers (`/press/`)
- people following releases (`/releases/`, `/roadmap/`)
- existing users looking for help (`/help/`)

## Product Purpose

PlainMind is an iOS app for saving and finding everything that matters: links, images, PDFs, podcasts, music, places and plain text. Things are captured through the iOS share sheet. It is local-first, with optional iCloud sync. Smart search and collections mean things can be found later without filing them.

This site exists to explain PlainMind honestly and send the right people to the App Store. It also hosts the founder claim flow, the press kit, release notes, the roadmap, help, and the legal pages.

## Positioning

- **It sorts itself.** Saves are grouped by what they are. Collections are suggested from the words the user writes in their own notes, on their device. No tagging, no folders and no decisions in the moment.
- **Never describe this as AI.** It groups by the user's own words. Overclaiming loses exactly the people who love it. AI over the library is permanently decided against (`docs/ROADMAP.md` in the iOS repo).
- **A quieter alternative** to bookmark managers, read-later apps and notes apps. There is no feed, no algorithm and no social layer.
- **Free is complete on one device.** It has no item limit. The only thing Pro adds is iCloud sync, automatic backup and the organisation layer. The governing rule is "the right is free, the convenience is paid".

## Operating Context

- **What the site may describe.** It describes only released versions of the app. Copy for a new version ships on the day Apple approves or releases it, never at submission. Today the site reflects 1.3; 1.4 is in review.
- **Deployment.**
  - The site is a static repo in Google Drive.
  - A push to `main` publishes it through Cloudflare Pages.
  - The user pushes, via GitHub Desktop.
  - Every change is logged in this repo's `README.md`.
- **Shared header and footer.** These are per-page static copies, kept that way for SEO. A change to either goes to every page except intentionally unique ones (`/welcome/`).
- **Who builds it.** Claude Code builds and maintains the site. Any user-facing change needs the user's approval before it ships.

## Capabilities and Constraints

- **Pricing**, which must always match App Store Connect:

  | Tier | Price |
  |---|---|
  | Free | Everything, unlimited, on one device |
  | Pro | $2.99 per month or $24.99 per year |
  | Founder (first 200) | $19.99 per year, locked for life, with a numbered badge |

- **The phone mockups** on the site reproduce the shipping app. They are built from app tokens that `tools/sync-app-tokens.mjs` generates. They are measured against simulator captures with `tools/capture-mocks.mjs`, so sizes, spacing and type match the app as closely as a browser allows. (User requirement, 2026-10-19.)
- **Content Security Policy.** The CSP in `public/_headers` only allows fonts, scripts and styles from the site itself, plus the few named vendors. Any web font must be self-hosted.
- **Fonts on non-Apple browsers.** Apple's fonts (New York, SF Pro) can't be embedded. Safari shows them; other browsers fall back. Choosing a lookalike for those browsers is an open decision.
- **Services in use:**
  - SureContact for signup
  - Turnstile for bot checks
  - Fathom for analytics
  - Termageddon for the legal pages
  - Cloudflare Pages Functions under `functions/api/`

## Brand Commitments

- **Name:** PlainMind. The App Store subtitle and social tagline is "Save anything. Find it later." The homepage hero is "Save anything. It sorts itself."
- **Voice:** calm, private, anti-feed, restrained but confident.
- **No em dashes in any visible copy** (user, 2026-10-19: they read as AI-written).
- **Colour:** the app's asset catalog is the single source of truth for colour, for the app and the site alike.

## Evidence on Hand

- **App Store rating** is approved for use, but only once there are enough reviews for it to be credible. (Confirmed 2026-10-19.)
- **Real assets:**
  - app screenshots
  - the press kit (`public/press/`, `public/assets/press/`)
  - Open Graph images (`public/assets/og/`)
  - logo and app-icon files (`public/assets/`)
- **Do not fabricate:**
  - testimonials or quotes, including tester feedback (not approved for public use)
  - user or download counts
  - benchmarks
  - press mentions
- **Open decision:** `/welcome/` already shows the live founding-member count from `/api/founders`. The user did not select that count as public evidence. Ask before using it anywhere else.

## Product Principles

1. **Honest about what ships.** The site never runs ahead of the released app, and never says more about a feature than it does.
2. **The right is free, the convenience is paid.** Never imply a paywall on something free. Never charge to fix a defect.
3. **Private and local-first is a promise, not a slogan.** Every privacy claim must stay literally true, including what the site itself loads and measures.
4. **Calm over attention.** Earn the App Store tap through clarity, not urgency, counters or hype.
5. **Show the real app.** Every screen depicted is the shipping app, measured, not an idealised concept.
