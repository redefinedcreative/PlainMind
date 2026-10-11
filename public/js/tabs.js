/* Roadmap tabs.
 *
 * Progressive enhancement, deliberately: the markup ships with every panel
 * visible and each carrying its own <h2>, so with JS blocked — or before this
 * file runs — the page is a plain, complete, scrollable document. Nothing is
 * hidden until `rm-tabs--ready` is set below, which is the only thing the CSS
 * keys its hiding on. A roadmap that renders empty without JavaScript would be
 * a worse failure than having no tabs at all.
 *
 * Follows the ARIA tabs pattern: one tab in the tab order at a time, arrows
 * move between them, Home/End jump to the ends.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-tabs]");
  if (!root) return;

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
  if (!tabs.length || panels.indexOf(null) !== -1) return;   // markup changed — leave the page alone

  /* Readable deep links: /roadmap/#released rather than #panel-past. */
  var SLUGS = { "tab-next": "upcoming", "tab-past": "released", "tab-no": "not-planned" };

  function indexForHash(hash) {
    var slug = (hash || "").replace(/^#/, "");
    if (!slug) return -1;
    for (var i = 0; i < tabs.length; i++) {
      if (SLUGS[tabs[i].id] === slug || tabs[i].getAttribute("aria-controls") === slug) return i;
    }
    return -1;
  }

  function select(i, opts) {
    opts = opts || {};
    tabs.forEach(function (tab, n) {
      var on = n === i;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("tabindex", on ? "0" : "-1");
      panels[n].hidden = !on;
    });
    if (opts.focus) tabs[i].focus();
    if (opts.hash) {
      // replaceState, not a hash assignment: setting location.hash would jump
      // the viewport to the panel and undo the reading position.
      try { history.replaceState(null, "", "#" + SLUGS[tabs[i].id]); } catch (e) {}
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { select(i, { hash: true }); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(next, { focus: true, hash: true });
    });
  });

  // Hiding only becomes legal once the behaviour that reveals is in place.
  root.classList.add("rm-tabs--ready");
  var fromHash = indexForHash(window.location.hash);
  select(fromHash === -1 ? 0 : fromHash, {});

  window.addEventListener("hashchange", function () {
    var i = indexForHash(window.location.hash);
    if (i !== -1) select(i, {});
  });
})();
