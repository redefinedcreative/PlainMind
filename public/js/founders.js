/* founders.js — live founding-member status near the signup forms.
   Always shows something (transparent), but stages the copy so a thin early number is never
   surfaced: an open invite below the threshold → the live "X of 200 left" once it's compelling
   → a "full" state at the cap. Copy is tuned per surface via data-founders="signup" | "welcome".
   Stays hidden only on error. */
(function () {
  var els = document.querySelectorAll("[data-founders]");
  if (!els.length) return;

  var COPY = {
    invite: {
      signup: "Be one of the first 200 founders.",
      welcome: "You're one of the first 200 founders.",
    },
    counting: {
      signup: "Only <strong>{n}</strong> of 200 founding spots left.",
      welcome: "Only <strong>{n}</strong> of 200 founding spots left.",
    },
    full: {
      signup: "Founding spots are full — join the waitlist for launch.",
      welcome: "All 200 founding spots are claimed.",
    },
  };

  fetch("/api/founders", { headers: { accept: "application/json" } })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      if (!d || !d.ok || !d.stage || !COPY[d.stage]) return; // unavailable → stay hidden
      els.forEach(function (el) {
        var ctx = el.getAttribute("data-founders") === "welcome" ? "welcome" : "signup";
        var msg = COPY[d.stage][ctx].replace("{n}", d.remaining); // values from our own API
        el.innerHTML = msg;
        el.classList.toggle("founders-status--full", d.stage === "full");
        el.removeAttribute("hidden");
      });
    })
    .catch(function () { /* leave hidden */ });
})();
