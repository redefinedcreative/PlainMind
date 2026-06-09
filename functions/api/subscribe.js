// Cloudflare Pages Function — POST /api/subscribe
//
// One endpoint, used twice:
//   • Hero / final-CTA form  → { email, enroll: true }            (create contact + enroll in beta sequence)
//   • /welcome "introduce yourself" → { email, first_name: "..." } (update the same contact's name)
// Both are upserts keyed on email, so calling it again just updates the existing contact.
//
// Config comes from Cloudflare Pages environment variables (Project → Settings → Environment variables):
//   SURECONTACT_API_KEY         (encrypt as a Secret) — your SureContact API key (write scope)
//   SURECONTACT_AUTOMATION_UUID (plaintext ok)         — the *automation* (workflow) UUID to start for signups
//   TURNSTILE_SECRET_KEY        (encrypt as a Secret) — Cloudflare Turnstile secret for the signup widget
//
// SureContact API shapes below were confirmed against live responses + the public API docs:
//   • upsert wants identity fields nested under `primary_fields` ({ primary_fields: { email, first_name } })
//   • the created/updated contact's id is at response.data.uuid
//   • starting an automation is POST /contacts/{contact_uuid}/automations/{automation_uuid}/start
//     (both ids in the PATH, no body). The automation must be in `active` status in SureContact.
//     The automation owns everything downstream: tag (PlainMind Beta), list membership, and the emails.

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

  // 2) On first signup, start the beta workflow (automation) for this contact. The
  //    automation owns everything downstream: tag as PlainMind Beta, add to the
  //    PlainMind list, send the welcome + (later) the TestFlight invite. Best-effort:
  //    a saved contact is the win — don't fail the whole signup if the trigger hiccups.
  //    NOTE: the automation must be in `active` status in SureContact, or this no-ops.
  if (enroll && env.SURECONTACT_AUTOMATION_UUID && contactUuid) {
    try {
      await fetch(
        `${API_BASE}/contacts/${contactUuid}/automations/${env.SURECONTACT_AUTOMATION_UUID}/start`,
        { method: "POST", headers }
      );
    } catch (e) {
      /* swallow — contact is saved */
    }
  }

  return json({ ok: true, first_name: firstName || null });
}
