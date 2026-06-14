/* founders.js — live founding-member count near the signup forms.
   Fetches /api/founders and reveals "Only X of 200 founding spots left" once the count
   crosses the reveal threshold (server-decided), with a "full" state at the cap.
   Stays hidden below the threshold or on any error. */
(function () {
  var els = document.querySelectorAll("[data-founders]");
  if (!els.length) return;

  fetch("/api/founders", { headers: { accept: "application/json" } })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      if (!d || !d.ok || !d.reveal) return; // below threshold / unavailable → stay hidden
      var full = !!d.full;
      var msg = full
        ? "Founding spots are full — join the waitlist for launch."
        : "Only <strong>" + d.remaining + "</strong> of " + d.cap + " founding spots left.";
      els.forEach(function (el) {
        el.innerHTML = msg;                       // values come from our own API, not user input
        el.classList.toggle("founders-status--full", full);
        el.removeAttribute("hidden");
      });
    })
    .catch(function () { /* leave hidden */ });
})();
