/* share-demo.js — the hero's share-sheet → "Saved." sequence.
   Plays on load, then gently auto-replays on a long calm pause while visible.
   Pauses when scrolled out of view or the tab is hidden. Reduced-motion = static. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector("[data-demo-stage]");
  if (!stage) return;
  var phone = stage.querySelector(".demo-phone");
  if (!phone) return;

  var CYCLE = 8000;     // ms — one play() start to the next (sequence + linger on the settled library)

  var seqTimers = [];
  var loopTimer = null;
  var running = false;
  var visible = true;
  var inView = false;

  function clearSeq() { seqTimers.forEach(clearTimeout); seqTimers = []; }
  function at(ms, fn) { seqTimers.push(setTimeout(fn, ms)); }
  function phase(p) { phone.setAttribute("data-phase", p); }

  if (reduce) {
    // Static end-state: sheet gone, "Saved." visible, library revealed.
    root.setAttribute("data-demo-static", "");
    return;
  }

  function play() {
    clearSeq();
    root.removeAttribute("data-demo-static");
    phase("start");                                  // article showing, finger resting on it, sheet closed
    at(150, function () { phase("glideShare"); });   // finger heads to the share icon immediately
    at(950, function () { phase("tapShare"); });     // taps it — calm outward pulse + icon depress
    at(1400, function () { phase("sheetUp"); });      // sheet slides up; finger holds near the share icon
    at(2150, function () { phase("glideTile"); });    // finger glides down to the PlainMind tile
    at(2950, function () { phase("press"); });        // taps the tile — pulse + tile depress
    at(3550, function () { phase("dismiss"); });      // sheet dismisses, library reveals
    at(3900, function () { phase("saved"); });        // lands in library + teal highlight
    at(5800, function () { phase("done"); });         // "Saved." pill fades; library settles (finger hidden) and lingers
  }

  function cycle() {
    play();
    loopTimer = setTimeout(cycle, CYCLE);
  }
  function startLoop() {
    if (running || !visible || !inView) return;
    running = true;
    cycle();
  }
  function stopLoop() {
    running = false;
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    clearSeq();
  }

  window.pmDemo = { play: play, start: startLoop, stop: stopLoop };

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    if (visible) startLoop(); else stopLoop();
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        inView = e.isIntersecting;
        if (inView) startLoop(); else stopLoop();
      });
    }, { threshold: 0.4 });
    io.observe(stage);
  } else {
    inView = true;
    startLoop();
  }
})();
