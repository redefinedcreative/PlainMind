/* signup.js — posts the beta signup to the Cloudflare Function (/api/subscribe),
   stashes the email for the welcome page, then sends the visitor to /welcome.
   Drives a small status state machine so the form always tells the user what's
   happening: idle → verifying → joining → success / error.
   Shared by the hero form, the final-CTA form, and /beta. */
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var forms = document.querySelectorAll(".signup-form");
  if (!forms.length) return;

  function getToken(form) {
    var field = form.querySelector('[name="cf-turnstile-response"]');
    return field && field.value ? field.value : "";
  }

  // Reset a form's Turnstile widget so a fresh token is issued for the next attempt.
  function resetTurnstile(form) {
    if (!window.turnstile) return;
    var widget = form.querySelector(".cf-turnstile");
    try { window.turnstile.reset(widget || undefined); } catch (e) {}
  }

  forms.forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var note = form.querySelector("[data-signup-note]");
    var submit = form.querySelector('button[type="submit"]');
    if (!input) return;

    var defaultNote = note ? note.textContent : "";
    var inflight = false;   // a request is in flight
    var waiting = false;    // user submitted, waiting on the Turnstile token
    var pollTimer = null;

    // Update the status line and replay its gentle entrance animation.
    function setStatus(state, message) {
      if (!note) return;
      note.classList.remove("is-error", "is-success", "is-pending", "status-animate");
      if (state) note.classList.add("is-" + state);
      note.textContent = message;
      // Force reflow so the animation restarts even when the class is re-applied.
      void note.offsetWidth;
      note.classList.add("status-animate");
    }

    function clearStatus() {
      if (!note) return;
      note.classList.remove("is-error", "is-success", "is-pending", "status-animate");
      note.textContent = defaultNote;
    }

    function setLoading(on) {
      if (submit) {
        submit.disabled = on;
        submit.classList.toggle("is-loading", on);
        submit.setAttribute("aria-busy", on ? "true" : "false");
      }
    }

    function fail(message) {
      inflight = false;
      waiting = false;
      clearInterval(pollTimer);
      setLoading(false);
      resetTurnstile(form);
      setStatus("error", message);
    }

    function send(email) {
      inflight = true;
      setLoading(true);
      setStatus("pending", "Joining…");

      fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, enroll: true, turnstile_token: getToken(form) })
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
        })
        .then(function (res) {
          if (!res.ok || !res.d.ok) {
            throw new Error((res.d && res.d.error) || "Something went wrong. Please try again.");
          }
          try { sessionStorage.setItem("pm-signup-email", email); } catch (e) {}
          setStatus("success", "You're in — taking you to the next step…");
          setTimeout(function () { window.location.href = "/welcome/"; }, 750);
        })
        .catch(function (err) {
          fail(err && err.message ? err.message : "Something went wrong. Please try again.");
        });
    }

    function attemptSubmit() {
      var email = (input.value || "").trim();
      if (!EMAIL_RE.test(email)) {
        input.setAttribute("aria-invalid", "true");
        setStatus("error", "Please enter a valid email address.");
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");

      // Token already issued (interaction-only usually has it on load) — go straight away.
      if (getToken(form)) { send(email); return; }

      // No token yet: show a verifying state and continue automatically once it lands.
      waiting = true;
      setLoading(true);
      setStatus("pending", "Just a moment — verifying you're human…");

      var waited = 0;
      clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        waited += 250;
        if (getToken(form)) {
          clearInterval(pollTimer);
          if (waiting) { waiting = false; send(email); }
        } else if (waited >= 12000) {
          clearInterval(pollTimer);
          fail("Couldn't verify you're human — please check your connection and try again.");
        }
      }, 250);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (inflight) return;          // request already running
      if (waiting) return;           // already waiting on the token
      attemptSubmit();
    });

    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") === "true" && EMAIL_RE.test(input.value.trim())) {
        input.removeAttribute("aria-invalid");
        clearStatus();
      }
    });
  });
})();
