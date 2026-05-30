/* reveal.js — adds .in-view to feature mockups when they scroll into view.
   Drives the opacity/translate entrance and the mobile library-cycle play-state. */
(function () {
  var els = document.querySelectorAll(".phone-mock, .anim-host");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("in-view"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("in-view");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  els.forEach(function (el) { io.observe(el); });
})();
