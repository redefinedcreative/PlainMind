// Cloudflare Pages Function — POST /api/subscribe
//
// One endpoint, used twice:
//   • Hero / final-CTA form  → { email, enroll: true }            (create contact + enroll in beta sequence)
//   • /welcome "introduce yourself" → { email, first_name: "..." } (update the same contact's name)
// Both are upserts keyed on email, so calling it again just updates the existing contact.
//
// Config comes from Cloudflare Pages environment variables (Project → Settings → Environment variables):
//   SURECONTACT_API_KEY    (encrypt as a Secret) — your SureContact API key (needs READ + WRITE)
//   SURECONTACT_LIST_UUID  (plaintext ok)         — the "PlainMind Beta" list UUID to add signups to
//   TURNSTILE_SECRET_KEY   (encrypt as a Secret) — Cloudflare Turnstile secret for the signup widget
//
// SureContact API shapes (confirmed against the live API + docs):
//   • upsert wants identity fields nested under `primary_fields` ({ primary_fields: { email, first_name } })
//   • the created/updated contact's id is at response.data.uuid
//   • add to a list: POST /contacts/{contact_uuid}/lists/attach  body { list_uuids: [uuid] }
//     (path uses /lists/attach with a SLASH — "lists-attach" 404s). Adding the contact to the
//     "PlainMind Beta" list both (a) GUARANTEES list membership and (b) fires the SureContact
//     workflow whose trigger is "contact added to that list" (welcome email, sequence enroll, etc.).
//     The API key needs READ permission as well as write (the attach validates the list/contact).

const API_BASE = "https://api.surecontact.com/api/v1/public";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

// Verify a Cloudflare Turnstile token server-side.
async function verifyTurnstile(token, secret, ip) {
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch (e) {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.SURECONTACT_API_KEY) {
    return json({ ok: false, error: "Signup is not configured yet." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const firstName = String(body.first_name || "").trim();
  const enroll = body.enroll === true;
  const turnstileToken = String(body.turnstile_token || "").trim();

  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 422);
  }

  // Bot protection on the public signup (enroll == first touch from the marketing form).
  // The /welcome name update reuses this endpoint but isn't enroll, so it skips the challenge.
  if (enroll) {
    if (!env.TURNSTILE_SECRET_KEY) {
      return json({ ok: false, error: "Signup is not configured yet." }, 500);
    }
    if (!turnstileToken) {
      return json({ ok: false, error: "Please complete the verification and try again." }, 400);
    }
    const human = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP")
    );
    if (!human) {
      return json({ ok: false, error: "Verification failed — please try again." }, 403);
    }
  }

  const headers = {
    "content-type": "application/json",
    "X-API-Key": env.SURECONTACT_API_KEY,
  };

  // 1) Create or update the contact (upsert by email).
  const payload = { primary_fields: { email } };
  if (firstName) payload.primary_fields.first_name = firstName;

  let contact = {};
  try {
    const res = await fetch(`${API_BASE}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return json({ ok: false, error: "Couldn't save your details — please try again." }, 502);
    }
    contact = await res.json().catch(() => ({}));
  } catch (e) {
    return json({ ok: false, error: "Couldn't reach the signup service." }, 502);
  }

  const contactUuid = contact.data && contact.data.uuid;

  // 2) On first signup, add the contact to the "PlainMind Beta" list. This both (a) GUARANTEES
  //    list membership no matter what happens downstream, and (b) fires the SureContact workflow
  //    whose trigger is "contact added to that list" (welcome email, sequence enroll, etc.).
  //    Endpoint is /lists/attach (SLASH, not "lists-attach") with body { list_uuids: [...] } —
  //    confirmed against the live API docs. Best-effort: a saved contact is the win, so don't fail
  //    the signup if this hiccups.
  if (enroll && env.SURECONTACT_LIST_UUID && contactUuid) {
    try {
      await fetch(`${API_BASE}/contacts/${contactUuid}/lists/attach`, {
        method: "POST",
        headers,
        body: JSON.stringify({ list_uuids: [env.SURECONTACT_LIST_UUID] }),
      });
    } catch (e) {
      /* swallow — contact is saved */
    }
  }

  // 3) Phase 2 — assign a founder number in our own store (D1), by signup order. Best-effort and
  //    fully optional: if D1 isn't bound yet this is skipped, and a D1 hiccup never fails a signup
  //    (the saved contact + list membership are the win). UNIQUE(email) makes it idempotent.
  if (enroll && env.DB) {
    try {
      await env.DB
        .prepare("INSERT OR IGNORE INTO founders (email, created_at) VALUES (?, ?)")
        .bind(email, new Date().toISOString())
        .run();
    } catch (e) {
      /* swallow — contact is already saved on the list */
    }
  }

  return json({ ok: true, first_name: firstName || null });
}
