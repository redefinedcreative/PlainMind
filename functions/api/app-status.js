// Cloudflare Pages Function — GET /api/app-status
//
// The homepage hero pill (see functions/_lib/release-pill.js for the rule).
// Fetched here, not in the browser: the site's CSP allows only same-origin
// connections, and a visitor's browser should not call Apple just by loading
// the homepage. Apple's answer is edge-cached; so is ours.

import { pillFor } from "../_lib/release-pill.js";

const LOOKUP = "https://itunes.apple.com/lookup?id=6780289082&country=us";
const UPSTREAM_TTL = 900;  // seconds to edge-cache Apple's answer
const CACHE_TTL = 300;     // seconds browsers may keep ours

function json(data, cacheSeconds) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

export async function onRequestGet({ request, env }) {
  let live = null;
  // Why there is no pill, when there is none — no secrets, just the upstream
  // status, so a silent fallback can be diagnosed from the outside.
  let why = null;
  try {
    const res = await fetch(LOOKUP, {
      headers: { "user-agent": "PlainMind-Website/1.0 (+https://plainmind.app)", "accept": "application/json" },
      cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true },
    });
    if (res.ok) {
      const r = (await res.json()).results?.[0];
      if (r?.version) live = { version: r.version, releaseDate: r.currentVersionReleaseDate || null };
      else why = "lookup: no result";
    } else {
      why = `lookup: HTTP ${res.status}`;
    }
  } catch (e) { why = `lookup: ${e && e.name ? e.name : "error"}`; }

  let status = null;
  try {
    const res = await env.ASSETS.fetch(new URL("/data/release-status.json", request.url));
    if (res.ok) status = await res.json();
  } catch (e) { /* status stays null → the plain pill */ }

  // Apple refused Cloudflare's requests (HTTP 403, measured 2026-10-18). The
  // release we published ourselves on release day is the fallback — written by
  // Phase 9 with the App Store Connect release date, so it is still a fact, not
  // a guess. Apple's answer wins whenever it gets through.
  if (!live && status && status.live && status.live.version) {
    live = status.live;
    why = why ? `${why}; used published release` : null;
  }

  const pill = pillFor(live, status);
  return json(pill ? { ok: true, pill } : { ok: false, pill, why: why || (status ? "no live version" : "no status") },
              pill ? CACHE_TTL : 0);
}
