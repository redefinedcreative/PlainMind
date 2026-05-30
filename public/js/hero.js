/* hero.js — Cooks moment 1: kinetic type reveal + ambient cross-fading saved cards */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Type reveal ----
  var title = document.getElementById("hero-title");
  function playReveal() {
    if (!title || reduce) return;
    root.classList.add("hero-anim");
    root.classList.remove("hero-play");
    // force reflow so re-adding restarts the animation
    void title.offsetWidth;
    root.classList.add("hero-play");
  }
  if (!reduce && title) {
    requestAnimationFrame(playReveal);
  }
  window.pmHero = { replay: playReveal };

  // ---- Ambient card cross-fade ----
  var phone = document.querySelector("[data-hero-phone]");
  if (!phone) return;
  var cards = phone.querySelectorAll(".hero-card");
  var dots = phone.querySelectorAll("[data-hero-dots] span");
  if (cards.length < 2 || reduce) return;

  var i = 0, timer = null, paused = false;
  var INTERVAL = 4000;

  function show(n) {
    cards.forEach(function (c, idx) { c.classList.toggle("is-active", idx === n); });
    dots.forEach(function (d, idx) { d.classList.toggle("is-active", idx === n); });
  }
  function tick() {
    if (paused) return;
    i = (i + 1) % cards.length;
    show(i);
  }
  function start() { stop(); timer = setInterval(tick, INTERVAL); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  phone.addEventListener("pointerenter", function () { paused = true; });
  phone.addEventListener("pointerleave", function () { paused = false; });
  phone.addEventListener("focusin", function () { paused = true; });
  phone.addEventListener("focusout", function () { paused = false; });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  start();
})();
