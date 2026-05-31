/* reveal.js — scroll-reveal choreography + one-shot mock entrances + count-ups.
   Adds .in-view to elements as they enter the viewport (once each), tweens any
   [data-countup] number 0 → target. Calm, directional, resolves — no loops. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Signal JS is on so the reveal initial-hidden state applies.
  // (No-JS visitors never get .reveal-ready, so content stays visible.)
  root.classList.add("reveal-ready");

  var revealEls = document.querySelectorAll(".reveal, .phone-mock, .anim-host");
  var countEls = document.querySelectorAll("[data-countup]");

  function runCountUp(el) {
    var target = parseFloat(el.getAttribute("data-countup"));
    if (isNaN(target)) { return; }
    if (target === 0) { el.textContent = "0"; return; }
    var dur = 1200, startTs = null;
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (startTs === null) startTs = ts;
      var p = Math.min((ts - startTs) / dur, 1);
      el.textContent = Math.round(easeOutCubic(p) * target).toString();
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toString();
    }
    requestAnimationFrame(frame);
  }

  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
    countEls.forEach(function (el) {
      var t = el.getAttribute("data-countup");
      if (t !== null && t !== "") el.textContent = parseFloat(t).toString();
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in-view");
      if (e.target.hasAttribute("data-countup")) runCountUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  revealEls.forEach(function (el) { io.observe(el); });
  // Reset count-ups to 0 up front so the tween reads as a build, then observe.
  countEls.forEach(function (el) { el.textContent = "0"; io.observe(el); });
})();
