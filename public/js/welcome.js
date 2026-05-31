/* welcome.js — the calm "introduce yourself" flow on the beta success page.
   Reads the signup email from sessionStorage (set by signup.js), asks for a first name,
   updates the SureContact contact via /api/subscribe, personalizes the greeting (with a
   soft name reveal), and fires a one-shot brand celebration. If we don't know the email
   (someone opened /welcome directly), the name step is skipped and we still celebrate. */
(function () {
  var email = null;
  try { email = sessionStorage.getItem("pm-signup-email"); } catch (e) {}

  var overlay = document.querySelector("[data-intro]");
  var form = document.querySelector("[data-intro-form]");
  var input = form ? form.querySelector('input[type="text"]') : null;
  var skip = document.querySelector("[data-intro-skip]");
  var greeting = document.getElementById("welcome-greeting");

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute("hidden", "");
    document.documentElement.classList.remove("intro-open");
    // Release the hero freeze — the seal now draws and the reveals animate in.
    document.documentElement.classList.remove("intro-pending");
  }

  // Rebuild the greeting so the name can animate in on its own (CSS handles the reveal).
  function personalize(name) {
    if (!name || !greeting) return;
    greeting.textContent = "You're in";
    var span = document.createElement("span");
    span.className = "welcome-name";
    span.textContent = ", " + name;
    greeting.appendChild(span);
    greeting.appendChild(document.createTextNode("."));
  }

  // Theme-aware brand palette pulled from CSS custom properties.
  function brandColors() {
    var cs = getComputedStyle(document.documentElement);
    var pick = function (n, fb) { var v = (cs.getPropertyValue(n) || "").trim(); return v || fb; };
    return [pick("--accent", "#7BAFB0"), pick("--accent-readable", "#4A7475"), pick("--sage-success", "#6FA776"), "#D9D2C7"];
  }

  // One-shot celebration burst from the confirmation seal. Skipped under reduced motion.
  function celebrate() {
    if (prefersReducedMotion()) return;
    var seal = document.querySelector(".welcome-seal");
    var rect = seal ? seal.getBoundingClientRect() : null;
    var ox = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    var oy = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.3;
    var colors = brandColors();

    var layer = document.createElement("div");
    layer.className = "pm-confetti";
    document.body.appendChild(layer);

    var N = 22;
    for (var i = 0; i < N; i++) {
      var piece = document.createElement("span");
      piece.className = "pm-confetti__piece";
      var angle = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.5;
      var dist = 80 + Math.random() * 110;
      piece.style.left = ox + "px";
      piece.style.top = oy + "px";
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--dx", (Math.cos(angle) * dist).toFixed(1) + "px");
      piece.style.setProperty("--dy", (Math.sin(angle) * dist).toFixed(1) + "px");
      piece.style.setProperty("--rot", (Math.random() * 540 - 270).toFixed(0) + "deg");
      piece.style.animationDelay = (Math.random() * 0.06).toFixed(3) + "s";
      layer.appendChild(piece);
    }
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1500);
  }

  // Only run the name flow if we actually know who just signed up.
  if (email && overlay) {
    overlay.removeAttribute("hidden");
    document.documentElement.classList.add("intro-open");
    if (input) setTimeout(function () { input.focus(); }, 400);
  } else {
    // Direct visit (no overlay): make sure nothing stays frozen, then celebrate
    // once the seal has finished drawing.
    document.documentElement.classList.remove("intro-pending");
    setTimeout(celebrate, 1300);
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (input.value || "").trim();
      if (!name) { input.focus(); return; }

      // Optimistic + calm: greet and dismiss now; the seal redraws once the overlay is
      // gone, then the celebration lands as the check finishes. Save in the background.
      personalize(name);
      closeOverlay();
      setTimeout(celebrate, 1300);

      if (email) {
        fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email, first_name: name })
        }).catch(function () { /* contact already exists; name save can be retried */ });
      }
      // The email was single-use for this handoff.
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }

  if (skip) {
    skip.addEventListener("click", function () {
      closeOverlay();
      setTimeout(celebrate, 1300);
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }
})();
