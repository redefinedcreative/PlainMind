/* help.js — client-side filter over the FAQ list (real search, not faked) */
(function () {
  var input = document.querySelector("[data-help-search]");
  var list = document.querySelector("[data-help-list]");
  if (!input || !list) return;
  var faqs = Array.prototype.slice.call(list.querySelectorAll("[data-faq]"));
  var headings = Array.prototype.slice.call(list.querySelectorAll("h2"));
  var empty = list.querySelector("[data-help-empty]");

  function norm(s) { return (s || "").toLowerCase(); }

  function apply(q) {
    q = norm(q).trim();
    var anyVisible = false;
    faqs.forEach(function (f) {
      var match = q === "" || norm(f.textContent).indexOf(q) > -1;
      f.hidden = !match;
      if (match) anyVisible = true;
      if (q !== "" && match) f.setAttribute("open", ""); // expand matches
      if (q === "") f.removeAttribute("open");
    });
    // hide a heading if all FAQs after it (until next heading) are hidden
    headings.forEach(function (h) {
      var n = h.nextElementSibling, show = false;
      while (n && n.tagName !== "H2") {
        if (n.matches("[data-faq]") && !n.hidden) show = true;
        n = n.nextElementSibling;
      }
      h.hidden = q !== "" && !show;
    });
    if (empty) empty.hidden = anyVisible;
  }

  input.addEventListener("input", function () { apply(input.value); });
})();
