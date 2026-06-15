// Cloudflare Pages Function — POST /api/revenuecat-webhook
//
// Founder-price integrity (Phase 2, Phase B). RevenueCat posts subscription
// lifecycle events here; we record whether each founder's `founder_annual`
// subscription is active and when it expires, so `/api/founder-claim` can decide
// if the $19.99 founding price is still on offer (§13 #3 — lost after a real
// lapse, with a grace window). The badge/number always persist; only the price
// is gated.
//
// Bindings / secrets (Pages → Settings → Functions):
//   DB                       — the D1 database (see schema.sql). Required.
//   REVENUECAT_WEBHOOK_AUTH  — Secret. Must equal the Authorization header value
//                              configured on the RevenueCat webhook. Required.
//
// RevenueCat setup: Project → Integrations → Webhooks → add
//   URL: https://plainmind.app/api/revenuecat-webhook
//   Authorization header: <same value as REVENUECAT_WEBHOOK_AUTH>
//
// We key the founder row by the `founder_number` subscriber attribute that the
// app sets at claim time (FounderService.ingest), and only act on the gated
// `founder_annual` product — other tiers (pro/max) are ignored here.

const FOUNDER_PRODUCT = "founder_annual";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function msToISO(ms) {
  if (ms == null) return null;
  const n = Number(ms);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}

export async function onRequestPost({ request, env }) {
  // Auth: RevenueCat sends the configured value in the Authorization header.
  if (!env.REVENUECAT_WEBHOOK_AUTH || request.headers.get("Authorization") !== env.REVENUECAT_WEBHOOK_AUTH) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.DB) return json({ ok: false, error: "not configured" }, 503);

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ ok: false, error: "invalid body" }, 400); }

  const event = body && body.event;
  if (!event) return json({ ok: true, ignored: "no event" });

  // Only the gated founder product matters here.
  const isFounderProduct =
    event.product_id === FOUNDER_PRODUCT ||
    (Array.isArray(event.entitlement_ids) && event.entitlement_ids.includes("founder"));
  if (!isFounderProduct) return json({ ok: true, ignored: "not founder product" });

  // Map back to the founder row via the subscriber attribute the app sets.
  const number = Number(
    event.subscriber_attributes &&
    event.subscriber_attributes.founder_number &&
    event.subscriber_attributes.founder_number.value
  );
  if (!Number.isFinite(number) || number <= 0) return json({ ok: true, ignored: "no founder_number" });

  // Decide the new status from the event type.
  // - entitled events → active, with the current expiry
  // - EXPIRATION → lapsed (grace counts from this expiry)
  // - CANCELLATION → auto-renew-off keeps access (no change); a refund revokes now
  const t = event.type;
  let active = null;            // null = leave unchanged
  let expiresAt = null;
  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(t)) {
    active = 1;
    expiresAt = msToISO(event.expiration_at_ms);
  } else if (t === "EXPIRATION") {
    active = 0;
    expiresAt = msToISO(event.expiration_at_ms);
  } else if (t === "CANCELLATION") {
    const refund = event.cancel_reason && event.cancel_reason !== "UNSUBSCRIBE";
    if (refund) { active = 0; expiresAt = new Date().toISOString(); }
    // else: user turned off auto-renew but still has access → no change.
  }
  // Other events (BILLING_ISSUE, SUBSCRIPTION_PAUSED, TRANSFER, …) → no change.

  if (active === null) return json({ ok: true, ignored: `no-op for ${t}` });

  try {
    if (expiresAt) {
      await env.DB
        .prepare("UPDATE founders SET founder_active = ?, founder_expires_at = ? WHERE number = ?")
        .bind(active, expiresAt, number)
        .run();
    } else {
      await env.DB
        .prepare("UPDATE founders SET founder_active = ? WHERE number = ?")
        .bind(active, number)
        .run();
    }
  } catch (e) {
    return json({ ok: false, error: "db error" }, 502);
  }

  return json({ ok: true, number, active, expiresAt });
}
