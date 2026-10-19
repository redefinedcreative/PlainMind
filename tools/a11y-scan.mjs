#!/usr/bin/env node
/**
 * a11y-scan.mjs: the site's accessibility pass check (WCAG 2.2 AA, the parts a
 * machine can judge). Every page, light and dark, desktop and phone width.
 *
 *   - Text contrast: 4.5:1, or 3:1 for large text (24px, or 18.66px bold).
 *     The background is composited up the tree, so translucent cards and
 *     washes count. Text over an image or gradient can't be judged by a
 *     machine and is listed as "check by eye" rather than passed.
 *   - Images without alt, links and buttons without an accessible name, a
 *     missing <html lang>, and tap targets smaller than 24×24 (2.5.8).
 *
 * Text inside role="img" (the phone mocks) is a picture of the app, not page
 * content, and is skipped; the mock's own label is what is read.
 *
 * Usage: node tools/a11y-scan.mjs [base-url]   (default http://localhost:8790)
 * Exits 1 if anything fails. No npm dependencies; drives Chrome over CDP.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const base = (process.argv[2] || "http://localhost:8790").replace(/\/$/, "");
const PAGES = ["/", "/press/", "/releases/", "/roadmap/", "/help/", "/welcome/", "/beta/", "/claim/", "/privacy/", "/terms/", "/try/"];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9400 + (process.pid % 200);

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), "pm-a11y-" + process.pid)}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

// Runs in the page. Returns { fails: [...], eye: [...] }.
const SCAN = `(async () => {
  const st = document.createElement('style');
  st.textContent = '*{transition:none!important;animation:none!important}';
  document.head.appendChild(st);
  document.querySelectorAll('.reveal,.phone-mock,.anim-host').forEach(e => e.classList.add('in-view'));
  document.documentElement.classList.add('reveal-ready');
  await new Promise(r => setTimeout(r, 300));
  const fails = [], eye = [];
  // color-mix() computes to color(srgb r g b / a) with 0-1 channels.
  const parse = c => { const m = c.match(/[\\d.]+/g); if (!m) return null; const v = m.map(Number);
    const k = c.startsWith('color(') ? 255 : 1; return [v[0] * k, v[1] * k, v[2] * k, v.length > 3 ? v[3] : 1]; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
  const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''));
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const hiddenFromAT = el => el.closest('[aria-hidden="true"],[role="img"],.sr-only,[hidden]');
  const pageBg = parse(getComputedStyle(document.body).backgroundColor);

  // Background behind an element: composite translucent layers up the tree.
  const backdrop = el => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { image: true };
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let bg = [255, 255, 255, 1];
    if (!layers.length || layers[layers.length - 1][3] < 1) bg = pageBg && pageBg[3] >= 1 ? pageBg : bg;
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return { color: bg };
  };

  // 1. Text contrast
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t; (t = walker.nextNode());) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el) || hiddenFromAT(el) || !visible(el)) continue;
    if (el.closest('script,style,noscript,svg,iframe')) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    let opacity = 1; for (let n = el; n; n = n.parentElement) opacity *= +getComputedStyle(n).opacity;
    if (opacity < 0.05) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const b = backdrop(el);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const text = t.textContent.trim().slice(0, 50);
    if (b.image) { eye.push(name(el) + ' "' + text + '"'); continue; }
    const fgc = over([fg[0], fg[1], fg[2], fg[3] * opacity], b.color);
    const r = ratio(fgc, b.color), need = large ? 3 : 4.5;
    if (r < need) fails.push('contrast ' + r.toFixed(2) + ' < ' + need + ' ' + name(el) + ' ' + px + 'px "' + text + '"');
  }
  // 2. Images, names, lang, targets
  if (!document.documentElement.lang) fails.push('html has no lang');
  document.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt') && !hiddenFromAT(i)) fails.push('img without alt ' + i.src.split('/').pop()); });
  document.querySelectorAll('a[href],button,[role=button],input,select,textarea').forEach(el => {
    if (hiddenFromAT(el) || !visible(el)) return;
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.placeholder || '').trim()
      || [...el.querySelectorAll('img[alt]')].map(i => i.alt).join('').trim()
      || (el.id && document.querySelector('label[for="' + el.id + '"]')?.innerText.trim()) || (el.closest('label')?.innerText.trim());
    if (!label) fails.push('no accessible name ' + name(el));
    const r = el.getBoundingClientRect();
    // 2.5.8 exempts a link inside a sentence: an inline target whose parent
    // also holds text of its own.
    const inline = getComputedStyle(el).display === 'inline' && el.parentElement
      && [...el.parentElement.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!inline && (r.width < 24 || r.height < 24)) fails.push('target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' < 24 ' + name(el) + ' "' + label.slice(0, 30) + '"');
  });
  return { fails, eye };
})()`;

let total = 0;
const eyeAll = new Set();
for (const [w, mobile] of [[1440, false], [390, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile });
  for (const theme of ["light", "dark"]) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const page of PAGES) {
      await send("Page.enable");
      await send("Page.navigate", { url: base + page });
      await sleep(1800);
      const res = await send("Runtime.evaluate", { expression: SCAN, awaitPromise: true, returnByValue: true });
      const v = res.result?.result?.value;
      if (!v) { console.log(`${page} [${theme} ${w}] could not scan`); total++; continue; }
      const unique = [...new Set(v.fails)];
      unique.forEach((f) => console.log(`FAIL ${page} [${theme} ${w}] ${f}`));
      v.eye.forEach((e) => eyeAll.add(`${page} [${theme}] ${e}`));
      total += unique.length;
    }
  }
}
if (eyeAll.size) console.log(`\nCheck by eye (text over an image or gradient, ${eyeAll.size}):\n` + [...eyeAll].map((e) => "  " + e).join("\n"));
console.log(`\n${total ? "FAILED" : "PASSED"}: ${total} failure(s)`);
ws.close(); chrome.kill();
process.exit(total ? 1 : 0);
