/* signup.js — SureContact embed with an accessible, working fallback form */
(function () {
  var FORM_ID = "c300f086-3fa0-4e75-ad23-bec0ac7c1b19";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var forms = document.querySelectorAll(".signup-form[data-surecontact]");

  function wireFallback(form) {
    var input = form.querySelector('input[type="email"]');
    var note = form.querySelector("[data-signup-note]");
    var defaultNote = note ? note.textContent : "";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = (input.value || "").trim();
      if (!EMAIL_RE.test(val)) {
        input.setAttribute("aria-invalid", "true");
        if (note) note.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      form.classList.add("is-done");
      if (note) {
        note.textContent = "You're on the list. We'll email you when the beta opens.";
        note.classList.add("is-success");
      }
    });
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") === "true" && EMAIL_RE.test(input.value.trim())) {
        input.removeAttribute("aria-invalid");
        if (note) note.textContent = defaultNote;
      }
    });
  }

  forms.forEach(wireFallback);

  /* SureContact production hook ----------------------------------------------
     The branded form above is the primary, accessible signup UI. The
     SureContact embed (form ID c300f086-…) and its slot containers remain in
     the markup. To activate the hosted form in production, set the field label
     to "Email" in the SureContact dashboard and flip ADOPT_SURECONTACT to true
     (or wire the branded form's submit to SureContact's endpoint). Left off so
     the calm, on-brand form is what visitors see. */
  var ADOPT_SURECONTACT = false;

  function trySureContact() {
    if (!ADOPT_SURECONTACT) return true;
    if (!window.SureContactForms || typeof window.SureContactForms.render !== "function") return false;
    var map = [
      { slot: "#surecontact-form-hero", form: "#signup-hero" },
      { slot: "#surecontact-form-bottom", form: "#signup-final" }
    ];
    map.forEach(function (pair) {
      var slot = document.querySelector(pair.slot);
      var fallback = document.querySelector(pair.form);
      if (!slot) return;
      try {
        window.SureContactForms.render({ formId: FORM_ID, container: pair.slot });
        slot.removeAttribute("hidden");
        if (fallback) fallback.setAttribute("hidden", "");
      } catch (err) { /* keep fallback */ }
    });
    return true;
  }

  if (!trySureContact()) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (trySureContact() || tries > 20) clearInterval(iv);
    }, 250);
  }
})();
