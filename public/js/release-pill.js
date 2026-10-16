// Hero pill — upgrades the static "Now on the App Store" with what
// /api/app-status says (coming soon / new in / current version). Any failure
// leaves the static pill exactly as it was.
(function () {
  var pill = document.querySelector("[data-release-pill]");
  if (!pill || !window.fetch) return;
  fetch("/api/app-status", { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var p = data && data.pill;
      if (!p || !p.lead) return;
      var lead = document.createElement("strong");
      lead.textContent = p.state === "current" ? p.lead : p.lead + ":";
      pill.textContent = "";
      pill.appendChild(lead);
      pill.appendChild(document.createTextNode(p.state === "current" ? " · " + p.rest : " " + p.rest));
      pill.setAttribute("href", p.href);
      pill.setAttribute("data-state", p.state);
    })
    .catch(function () {});
})();
