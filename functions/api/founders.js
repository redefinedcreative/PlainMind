// Cloudflare Pages Function — GET /api/founders
//
// Live founding-member count for the website. Reads the "PlainMind Beta" SureContact LIST total
// (the same list /api/subscribe adds signups to) and reports progress toward the 200-founder cap.
//
// Reuses the existing env vars — no new setup:
//   SURECONTACT_API_KEY   (Secret, needs READ)        — same key the signup Function uses
//   SURECONTACT_LIST_UUID (plaintext)                  — the "PlainMind Beta" list UUID
//
// Privacy/optics: the exact count is withheld until we cross REVEAL_AT (100) — below that the
// response is just { ok, reveal:false } so a thin early number never leaks. Edge-cached for
// CACHE_TTL so page loads don't call SureContact every time.

const API_BASE = "https://api.surecontact.com/api/v1/public";
const CAP = 200;        // founding-member ceiling
const REVEAL_AT = 100;  // only surface the count publicly once we've crossed this
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
  if (!env.SURECONTACT_API_KEY || !env.SURECONTACT_LIST_UUID) {
    return json({ ok: false, error: "not configured" }, 500, 0);
  }

  let count;
  try {
    count = await getListCount(env);
  } catch (e) {
    return json({ ok: false, error: "unavailable" }, 502, 0);
  }

  // Below the reveal threshold: don't expose the thin early number.
  if (count < REVEAL_AT) {
    return json({ ok: true, reveal: false }, 200, CACHE_TTL);
  }

  const claimed = Math.min(count, CAP);
  return json(
    {
      ok: true,
      reveal: true,
      claimed,
      cap: CAP,
      remaining: Math.max(0, CAP - claimed),
      full: count >= CAP,
    },
    200,
    CACHE_TTL
  );
}
