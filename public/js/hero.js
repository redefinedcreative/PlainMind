/* hero.js — kinetic type reveal for the hero headline.
   (The hero visual is now the share-sheet save animation, driven by share-demo.js.) */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var title = document.getElementById("hero-title");
  function playReveal() {
    if (!title || reduce) return;
    root.classList.add("hero-anim");
    root.classList.remove("hero-play");
    void title.offsetWidth; // force reflow so re-adding restarts the animation
    root.classList.add("hero-play");
  }
  if (!reduce && title) {
    requestAnimationFrame(playReveal);
  }
  window.pmHero = { replay: playReveal };
})();
