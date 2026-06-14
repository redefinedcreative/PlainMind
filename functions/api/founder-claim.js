// Cloudflare Pages Function — POST /api/founder-claim
//
// The in-app founder claim (Phase 2, Option Y). The account-less iOS app sends the beta-signup
// email; if that email is one of the first 200 on the founder store, we return the founder number
// plus a signed token. The app caches it, shows the numbered badge, and unlocks the gated $19.99
// "Founder Pro Annual" offering. Status (badge/number) is granted here; the actual purchase price
// should be re-validated server-side against this token before it's honored.
//
// Bindings / secrets (Pages → Settings → Functions):
//   DB                   — the D1 database (see schema.sql). Required.
//   FOUNDER_TOKEN_SECRET — Secret. HMAC key for the anti-spoof token. Required to issue tokens.

const CAP = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// HMAC-SHA256(value) -> base64url. Lets us later verify "this device really claimed founder #N"
// without a session: the app returns the token, the server re-derives and compares.
async function sign(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return b64url(new Uint8Array(sig));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "not configured" }, 503);

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ ok: false, error: "Invalid request." }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "Please enter a valid email." }, 422);

  let row;
  try {
    row = await env.DB.prepare("SELECT number FROM founders WHERE email = ?").bind(email).first();
  } catch (e) {
    return json({ ok: false, error: "Couldn't reach the founder service." }, 502);
  }

  // Not on the list, or past the first 200 → not a founder (still a valid beta member).
  if (!row || row.number > CAP) return json({ ok: true, founder: false });

  const number = row.number;
  const token = env.FOUNDER_TOKEN_SECRET
    ? await sign(`${number}:${email}`, env.FOUNDER_TOKEN_SECRET)
    : null;

  return json({ ok: true, founder: true, number, of: CAP, token });
}
