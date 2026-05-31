// Cloudflare Pages Function — POST /api/subscribe
//
// One endpoint, used twice:
//   • Hero / final-CTA form  → { email, enroll: true }            (create contact + enroll in beta sequence)
//   • /welcome "introduce yourself" → { email, first_name: "..." } (update the same contact's name)
// Both are upserts keyed on email, so calling it again just updates the existing contact.
//
// Config comes from Cloudflare Pages environment variables (Project → Settings → Environment variables):
//   SURECONTACT_API_KEY        (encrypt as a Secret) — your SureContact public API key
//   SURECONTACT_SEQUENCE_UUID  (plaintext ok)         — the automation/sequence UUID to enroll signups into
//
// NOTE: SureContact's public API docs list the endpoints + auth header but truncate the exact
// request/response field names. The spots that need confirming once you test with a real key are
// marked `VERIFY:` — adjust the field names there if your dashboard differs.

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
  // SureContact expects identity fields nested under `primary_fields` (confirmed via 422 response).
  const payload = { primary_fields: { email } };
  if (firstName) payload.primary_fields.first_name = firstName; // VERIFY: first_name key within primary_fields

  let contact = {};
  try {
    const res = await fetch(`${API_BASE}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const rawBody = await res.text();
    // TEMP DEBUG — reveals SureContact's real field names + response shape. Remove after verifying.
    console.log("[subscribe] upsert status:", res.status, "| sent:", JSON.stringify(payload), "| response:", rawBody);
    if (!res.ok) {
      return json({ ok: false, error: "Couldn't save your details — please try again." }, 502);
    }
    try { contact = JSON.parse(rawBody); } catch (e) { contact = {}; }
  } catch (e) {
    console.log("[subscribe] upsert threw:", String(e)); // TEMP DEBUG
    return json({ ok: false, error: "Couldn't reach the signup service." }, 502);
  }

  // VERIFY: where the contact id/uuid lives in the upsert response.
  const contactUuid =
    contact.uuid || contact.id ||
    (contact.contact && (contact.contact.uuid || contact.contact.id)) ||
    (contact.data && (contact.data.uuid || contact.data.id));
  // TEMP DEBUG — did we find the contact id, and will we attempt enroll? Remove after verifying.
  console.log("[subscribe] extracted contactUuid:", contactUuid, "| enroll:", enroll, "| sequenceUuid set:", !!env.SURECONTACT_SEQUENCE_UUID);

  // 2) On first signup, enroll into the beta sequence. Best-effort: a saved contact is the
  //    win — don't fail the whole signup if enrollment hiccups (it can be automated server-side too).
  if (enroll && env.SURECONTACT_SEQUENCE_UUID && contactUuid) {
    try {
      const enrollRes = await fetch(`${API_BASE}/sequences/${env.SURECONTACT_SEQUENCE_UUID}/enroll`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contact_uuid: contactUuid }), // VERIFY: enroll body (contact_uuid vs email)
      });
      const enrollBody = await enrollRes.text();
      // TEMP DEBUG — 2xx means the enroll body shape is right. Remove after verifying.
      console.log("[subscribe] enroll status:", enrollRes.status, "| response:", enrollBody);
    } catch (e) {
      console.log("[subscribe] enroll threw:", String(e)); // TEMP DEBUG
    }
  }

  return json({ ok: true, first_name: firstName || null });
}
