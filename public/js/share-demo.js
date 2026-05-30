/* share-demo.js — Cooks moment 2: the share-sheet → Saved. sequence (plays once on scroll-in) */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector("[data-demo-stage]");
  if (!stage) return;
  var phone = stage.querySelector(".demo-phone");
  var replayBtn = stage.querySelector("[data-demo-replay]");
  if (!phone) return;

  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function phase(p) { phone.setAttribute("data-phase", p); }

  if (reduce) {
    // Static end-state: sheet gone, Saved. visible.
    root.setAttribute("data-demo-static", "");
    if (replayBtn) replayBtn.setAttribute("hidden", "");
    return;
  }

  function play() {
    clearTimers();
    root.removeAttribute("data-demo-static");
    phase("idle");
    // small beat, then the tap
    at(350, function () { phase("press"); });        // finger presses tile (~150ms feel)
    at(550, function () { phase("dismiss"); });       // sheet dismisses downward (300ms)
    at(900, function () { phase("saved"); });         // Saved. pill rises (easeOutBack)
    at(2600, function () { phase("done"); });         // pill rests then fades
    at(3300, function () { phase("idle"); });         // reset, ready to replay
  }
  window.pmDemo = { play: play };

  if (replayBtn) replayBtn.addEventListener("click", play);

  // Play once when scrolled into view
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { play(); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    io.observe(stage);
  } else {
    play();
  }
})();
