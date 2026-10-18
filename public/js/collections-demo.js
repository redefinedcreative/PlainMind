/* collections-demo.js — the hero's collection story, on a calm loop.
   Collections are the lead feature (2026-10-18), so the hero shows one forming:
   the suggestion is offered, accepted, and the library narrows to it. The
   feature-block mocks play once (reveal.js); the hero replays, like the share
   demo did when it lived here — a long pause, never while out of view or with
   the tab hidden. Reduced motion: the static first beat (styles.css). */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mock = document.querySelector(".hero-visual .phone-mock--collections");
  if (!mock || reduce) return;

  var CYCLE = 9000;   // ms between replays
  var OFFER = 3000;   // ms the suggestion sits before the beat plays — outlasts
                      // the phone's own entrance fade, so it is read, not glimpsed
  var timers = [];
  var visible = !document.hidden;
  var inView = true;

  function clear() { timers.forEach(clearTimeout); timers = []; }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function play() {
    clear();
    if (!visible || !inView) return;
    mock.classList.add("coll-offer");      // the library, the suggestion offered
    at(OFFER, function () { mock.classList.remove("coll-offer"); });   // accepted → narrows
    at(CYCLE, play);
  }

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    visible ? play() : clear();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      inView ? play() : clear();
    }, { threshold: 0.2 }).observe(mock);
  } else {
    play();
  }
})();
