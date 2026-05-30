/* parallax.js — Cooks moment 3: very gentle scroll parallax on the final-CTA background */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var stage = document.querySelector("[data-cta-stage]");
  var bg = document.querySelector("[data-cta-bg]");
  if (!stage || !bg) return;

  var RATE = 0.1, CAP = 40;
  var ticking = false;

  function update() {
    ticking = false;
    var rect = stage.getBoundingClientRect();
    var viewportCenter = window.innerHeight / 2;
    var sectionCenter = rect.top + rect.height / 2;
    var delta = (viewportCenter - sectionCenter) * RATE;
    if (delta > CAP) delta = CAP;
    if (delta < -CAP) delta = -CAP;
    bg.style.transform = "translateY(" + delta.toFixed(1) + "px)";
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();
