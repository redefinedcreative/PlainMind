/* welcome.js — the calm "introduce yourself" flow on the beta success page.
   Reads the signup email from sessionStorage (set by signup.js), asks for a first name,
   updates the SureContact contact via /api/subscribe, and personalizes the greeting.
   If we don't know the email (e.g. someone opened /welcome directly), the name step is
   skipped and the page just shows the beta info. */
(function () {
  var email = null;
  try { email = sessionStorage.getItem("pm-signup-email"); } catch (e) {}

  var overlay = document.querySelector("[data-intro]");
  var form = document.querySelector("[data-intro-form]");
  var input = form ? form.querySelector('input[type="text"]') : null;
  var skip = document.querySelector("[data-intro-skip]");
  var greeting = document.getElementById("welcome-greeting");

  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute("hidden", "");
    document.documentElement.classList.remove("intro-open");
  }

  function personalize(name) {
    if (name && greeting) {
      greeting.textContent = "Thanks for your interest in PlainMind, " + name + ".";
    }
  }

  // Only run the name flow if we actually know who just signed up.
  if (email && overlay) {
    overlay.removeAttribute("hidden");
    document.documentElement.classList.add("intro-open");
    if (input) setTimeout(function () { input.focus(); }, 400);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (input.value || "").trim();
      if (!name) { input.focus(); return; }

      // Optimistic + calm: greet and dismiss immediately, save in the background.
      personalize(name);
      closeOverlay();

      if (email) {
        fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email, first_name: name })
        }).catch(function () { /* contact already exists; name save can be retried */ });
      }
      // The email was single-use for this handoff.
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }

  if (skip) {
    skip.addEventListener("click", function () {
      closeOverlay();
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }
})();
