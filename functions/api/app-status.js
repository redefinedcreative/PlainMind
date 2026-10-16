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
  try {
    const res = await fetch(LOOKUP, { cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true } });
    if (res.ok) {
      const r = (await res.json()).results?.[0];
      if (r?.version) live = { version: r.version, releaseDate: r.currentVersionReleaseDate || null };
    }
  } catch (e) { /* live stays null → no pill change */ }

  let status = null;
  try {
    const res = await env.ASSETS.fetch(new URL("/data/release-status.json", request.url));
    if (res.ok) status = await res.json();
  } catch (e) { /* status stays null → the plain pill */ }

  const pill = pillFor(live, status);
  return json({ ok: !!pill, pill }, pill ? CACHE_TTL : 0);
}
