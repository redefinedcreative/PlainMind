// Cloudflare Pages Function — GET /api/founders
//
// Live founding-member count for the website. Reads the "PlainMind Beta" SureContact LIST total
// (the same list /api/subscribe adds signups to) and reports progress toward the 200-founder cap.
//
// Reuses the existing env vars — no new setup:
//   SURECONTACT_API_KEY   (Secret, needs READ)        — same key the signup Function uses
//   SURECONTACT_LIST_UUID (plaintext)                  — the "PlainMind Beta" list UUID
//
// Privacy/optics: we always return a stage so the program is visible from day one, but a thin
// early number never leaks — below NUMBER_AT (50) the response is just { ok, stage:"invite" }
// (an open invite, no count); at/above it we add the live "remaining"; at the cap, stage:"full".
// Edge-cached for CACHE_TTL so page loads don't call SureContact every time.

const API_BASE = "https://api.surecontact.com/api/v1/public";
const CAP = 200;        // founding-member ceiling
const NUMBER_AT = 50;   // below this, show an open invite (no raw number); above, show the live count
const CACHE_TTL = 120;  // seconds to edge-cache the upstream count

function json(data, status, cacheSeconds) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

// Pull the total list size from SureContact, edge-cached so we don't hit the API per pageview.
async function getListCount(env) {
  // Phase 2: D1 is the authority for the founder count once bound. Fall back to the SureContact
  // list count (the original source) if D1 isn't bound or errors.
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM founders").first();
      if (row && typeof row.n === "number") return row.n;
    } catch (e) { /* fall through to the SureContact count */ }
  }

  const cache = caches.default;
  const cacheKey = new Request("https://founders.cache/plainmind-beta-count");
  const hit = await cache.match(cacheKey);
  if (hit) return Number(await hit.text());

  const res = await fetch(
    `${API_BASE}/lists/${env.SURECONTACT_LIST_UUID}/contacts?per_page=1`,
    { headers: { "X-API-Key": env.SURECONTACT_API_KEY } }
  );
  if (!res.ok) throw new Error("list fetch failed");
  const data = await res.json().catch(() => ({}));

  // VERIFY: the list endpoint returns the total in pagination metadata — exact field unconfirmed,
  // so read it defensively across the common shapes.
  const count =
    data.total ?? data.total_count ??
    (data.meta && (data.meta.total ?? data.meta.total_count)) ??
    (data.pagination && (data.pagination.total ?? data.pagination.total_count)) ??
    (Array.isArray(data.data) ? data.data.length : null);

  if (typeof count !== "number") throw new Error("count not found in response");

  await cache.put(
    cacheKey,
    new Response(String(count), { headers: { "cache-control": `max-age=${CACHE_TTL}` } })
  );
  return count;
}

export async function onRequestGet({ env }) {
  if (!env.DB && (!env.SURECONTACT_API_KEY || !env.SURECONTACT_LIST_UUID)) {
    return json({ ok: false, error: "not configured" }, 500, 0);
  }

  let count;
  try {
    count = await getListCount(env);
  } catch (e) {
    return json({ ok: false, error: "unavailable" }, 502, 0);
  }

  // Stage the response so a thin early number is never exposed: below NUMBER_AT we return only
  // an "invite" stage (no raw count); above it, the live "remaining"; at the cap, "full".
  const claimed = Math.min(count, CAP);
  let stage = "invite";
  if (count >= CAP) stage = "full";
  else if (claimed >= NUMBER_AT) stage = "counting";

  const payload = { ok: true, stage, cap: CAP };
  if (stage === "counting") payload.remaining = Math.max(0, CAP - claimed);
  return json(payload, 200, CACHE_TTL);
}
