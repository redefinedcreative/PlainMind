/* theme.js — variant defaults, header scroll state, theme toggle (System → Light → Dark) */
(function () {
  var root = document.documentElement;

  // --- Cooks-moment variant defaults (review feature; safe to keep) ---
  var variants = {
    "data-hero": { key: "pm-hero", def: "words", allowed: ["words", "wipe", "settle"] },
    "data-demo": { key: "pm-demo", def: "library", allowed: ["tap", "library", "morph"] },
    "data-cta":  { key: "pm-cta",  def: "radial", allowed: ["radial", "watermark", "band"] }
  };
  Object.keys(variants).forEach(function (attr) {
    var v = variants[attr], saved;
    try { saved = localStorage.getItem(v.key); } catch (e) {}
    var val = v.allowed.indexOf(saved) > -1 ? saved : v.def;
    root.setAttribute(attr, val);
  });

  // --- Header bottom-border after scroll ---
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add("is-scrolled");
      else header.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // --- Theme toggle ---
  var btn = document.getElementById("theme-toggle");
  var label = document.getElementById("theme-toggle-label");
  if (!btn || !label) return;

  function currentMode() {
    try { return localStorage.getItem("pm-theme") || "system"; } catch (e) { return "system"; }
  }
  function applyMode(mode) {
    try {
      if (mode === "system") {
        localStorage.removeItem("pm-theme");
        var preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", preferDark ? "dark" : "light");
        root.setAttribute("data-theme-source", "system");
      } else {
        localStorage.setItem("pm-theme", mode);
        root.setAttribute("data-theme", mode);
        root.setAttribute("data-theme-source", "user");
      }
    } catch (e) {}
    updateLabel(mode);
  }
  function updateLabel(mode) {
    var labels = { system: "System", light: "Light", dark: "Dark" };
    label.textContent = labels[mode];
    btn.setAttribute("data-mode", mode);
    btn.setAttribute("aria-label", "Theme: " + labels[mode] + ". Click to switch.");
  }
  updateLabel(currentMode());

  btn.addEventListener("click", function () {
    var order = ["system", "light", "dark"];
    applyMode(order[(order.indexOf(currentMode()) + 1) % order.length]);
  });

  if (window.matchMedia) {
    var mql = window.matchMedia("(prefers-color-scheme: dark)");
    var listener = function () { if (currentMode() === "system") applyMode("system"); };
    if (mql.addEventListener) mql.addEventListener("change", listener);
    else if (mql.addListener) mql.addListener(listener);
  }
})();
