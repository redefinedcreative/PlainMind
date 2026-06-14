/* welcome-plus.js — arrival choreography + interactions for the PlainMind
   beta welcome page (Direction B: Founding Pass). Vanilla, matches the site's
   existing JS style and pairs with welcome-plus.css.

   What it does:
   - Plays a calm one-shot arrival on load (seal draws, hero rises, the
     founding-member pass assembles, founder number ticks, gentle celebration).
   - If the visitor arrived from a signup (sessionStorage "pm-signup-email",
     set by signup.js), it asks for a first name, personalizes the headline +
     pass + credit chip, and saves the name to the contact via /api/subscribe —
     mirroring the original welcome.js handoff. Direct visits skip the prompt.
   - Calm scroll choreography for the steps + credit wall.
   - Roadmap items the tester can nudge with a vote (optimistic UI; wire to a
     real endpoint if you want votes to persist — see VOTE ENDPOINT below).
   - Subtle scroll parallax on the ambient hero glow (no infinite loops).
   - Respects prefers-reduced-motion and resolves to a static end-state. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var email = null;
  try { email = sessionStorage.getItem("pm-signup-email"); } catch (e) {}

  var overlay = document.querySelector("[data-intro]");
  var form = document.querySelector("[data-intro-form]");
  var input = form ? form.querySelector('input[type="text"]') : null;
  var skip = document.querySelector("[data-intro-skip]");
  var hero = document.querySelector(".w2-hero");

  /* ---------- name plumbing ---------- */
  function firstName(raw) {
    var n = (raw || "").trim().split(/\s+/)[0] || "";
    if (!n) return "";
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  function applyName(name) {
    var nm = firstName(name);
    document.querySelectorAll("[data-greeting]").forEach(function (el) {
      el.innerHTML = "";
      el.appendChild(document.createTextNode("You're in"));
      var span = document.createElement("span");
      span.className = "w2-name" + (nm ? " w2-name-in" : "");
      span.textContent = nm ? (", " + nm) : "";
      el.appendChild(span);
      el.appendChild(document.createTextNode("."));
    });
    document.querySelectorAll("[data-name-slot]").forEach(function (el) {
      el.textContent = nm || el.getAttribute("data-fallback") || "Beta Member";
    });
    document.querySelectorAll("[data-name-chip]").forEach(function (el) {
      el.textContent = nm ? nm : "You";
    });
  }

  /* ---------- founder number tick ---------- */
  function tickNumber(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    if (reduce) { el.textContent = target; return; }
    var dur = 1100, start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(ease(p) * target);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  /* ---------- one-shot brand celebration ---------- */
  function brandColors() {
    var cs = getComputedStyle(root);
    var pick = function (n, fb) { var v = (cs.getPropertyValue(n) || "").trim(); return v || fb; };
    return [pick("--accent", "#7BAFB0"), pick("--accent-readable", "#4A7475"), pick("--sage-success", "#6FA776"), pick("--soft-amber", "#E5B24E"), "#D9D2C7"];
  }
  function celebrate() {
    if (reduce) return;
    var seal = document.querySelector(".w2-seal") || document.querySelector(".welcome-seal");
    var rect = seal ? seal.getBoundingClientRect() : null;
    var ox = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    var oy = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.28;
    var colors = brandColors();
    var layer = document.createElement("div");
    layer.className = "pm-confetti";
    document.body.appendChild(layer);
    var N = 26;
    for (var i = 0; i < N; i++) {
      var piece = document.createElement("span");
      piece.className = "pm-confetti__piece";
      var angle = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.5;
      var dist = 90 + Math.random() * 130;
      piece.style.left = ox + "px";
      piece.style.top = oy + "px";
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--dx", (Math.cos(angle) * dist).toFixed(1) + "px");
      piece.style.setProperty("--dy", (Math.sin(angle) * dist - 30).toFixed(1) + "px");
      piece.style.setProperty("--rot", (Math.random() * 540 - 270).toFixed(0) + "deg");
      piece.style.animationDelay = (Math.random() * 0.07).toFixed(3) + "s";
      layer.appendChild(piece);
    }
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1600);
  }

  /* ---------- the arrival (plays on load; never leaves the hero blank) ---------- */
  function playArrival() {
    applyName("");
    if (hero) { hero.classList.add("w2-ready"); }
    setTimeout(function () { if (hero) hero.classList.add("w2-revealed"); }, 40);
    var num = document.querySelector("[data-count]");
    setTimeout(function () { if (num) tickNumber(num); }, reduce ? 0 : 650);
    var pass = document.querySelector(".w2-pass-anim");
    if (pass) setTimeout(function () { pass.classList.add("w2-pass-in"); }, reduce ? 0 : 350);
    setTimeout(celebrate, reduce ? 0 : 1250);
    // lock the resolved state once the entrance has had time to play, so content
    // is guaranteed visible even in non-painting contexts.
    setTimeout(function () { if (hero) hero.classList.add("w2-settled"); }, reduce ? 0 : 1500);
  }

  // The typed name lands into the already-revealed headline / pass / credit chip.
  function landName(name) {
    applyName(name);
    if (firstName(name) && !reduce) setTimeout(celebrate, 120);
  }

  function openOverlay() {
    if (!overlay) return;
    overlay.removeAttribute("hidden");
    root.classList.add("intro-open");
    if (input) { input.value = ""; setTimeout(function () { input.focus(); }, 420); }
  }
  function closeOverlay() {
    if (overlay) overlay.setAttribute("hidden", "");
    root.classList.remove("intro-open");
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (input.value || "").trim();
      if (!name) { input.focus(); return; }
      // Optimistic + calm: greet and dismiss now, save in the background.
      landName(name);
      closeOverlay();
      if (email) {
        fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email, first_name: name })
        }).catch(function () { /* contact already exists; name save can be retried */ });
      }
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }
  if (skip) {
    skip.addEventListener("click", function () {
      closeOverlay();
      try { sessionStorage.removeItem("pm-signup-email"); } catch (e) {}
    });
  }

  /* ---------- scroll choreography for w2 elements ---------- */
  var observeEls = document.querySelectorAll("[data-observe]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in-view");
        io.unobserve(en.target);
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    observeEls.forEach(function (el) { io.observe(el); });
  } else {
    observeEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- roadmap voting ----------
     Optimistic UI only. To persist votes, POST to your own endpoint here, e.g.
     fetch("/api/roadmap/vote", { method:"POST", body: JSON.stringify({ id, voted }) }).
     The data-road-id attribute on each .w2-road is a convenient key to send. */
  document.querySelectorAll(".w2-road__vote").forEach(function (btn) {
    var countEl = btn.querySelector(".w2-road__count");
    var base = parseInt(countEl.textContent, 10) || 0;
    btn.addEventListener("click", function () {
      var voted = btn.classList.toggle("is-voted");
      countEl.textContent = base + (voted ? 1 : 0);
      btn.setAttribute("aria-pressed", voted ? "true" : "false");
      if (voted && !reduce) {
        var fly = document.createElement("span");
        fly.className = "w2-vote-fly"; fly.textContent = "+1";
        var r = btn.getBoundingClientRect();
        fly.style.left = (r.left + r.width / 2 - 8 + window.scrollX) + "px";
        fly.style.top = (r.top - 6 + window.scrollY) + "px";
        document.body.appendChild(fly);
        setTimeout(function () { if (fly.parentNode) fly.parentNode.removeChild(fly); }, 800);
      }
    });
  });

  /* ---------- subtle hero parallax (scroll-driven, not looped) ---------- */
  if (hero && !reduce) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        hero.style.setProperty("--w2-par", Math.min(y / 600, 1.2).toFixed(3));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- live founder count ----------
     Pulls the staged count from /api/founders (same source as the home page):
     under 50 signups it stays the honest "one of the first 200 founders"; from 50
     it shows live cohort progress; at 200 it reads as full. This is the COHORT
     count, never a personal position number (per-tester numbering is Phase 2). */
  function setFounders(stage, claimed, cap) {
    var text = "You're one of the first 200 founders.";
    var eyebrow = "You're one of the first 200 founders";
    if (stage === "counting" && typeof claimed === "number") {
      text = "Founder — " + claimed + " of " + cap + " claimed so far.";
      eyebrow = claimed + " of " + cap + " founders so far";
    } else if (stage === "full") {
      text = "All " + cap + " founding spots are claimed.";
      eyebrow = "Thanks for joining the list";
    }
    document.querySelectorAll("[data-founders-text]").forEach(function (el) { el.textContent = text; });
    document.querySelectorAll("[data-founders-introeyebrow]").forEach(function (el) { el.textContent = eyebrow; });
  }
  function loadFounders() {
    if (!window.fetch) return;
    fetch("/api/founders", { headers: { accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (!d || !d.ok || !d.stage) return; // keep the honest fallback already in the HTML
        var cap = d.cap || 200;
        var claimed = d.stage === "full" ? cap
          : (typeof d.remaining === "number" ? Math.max(0, cap - d.remaining) : null);
        setFounders(d.stage, claimed, cap);
      })
      .catch(function () { /* keep fallback */ });
  }

  /* ---------- kick off ---------- */
  // The arrival plays right away. Only when we know who just signed up do we
  // invite a name a beat later; it lands into the headline already on screen.
  playArrival();
  loadFounders();
  if (!reduce && overlay && email) setTimeout(openOverlay, 1500);
})();
