#!/usr/bin/env node
/**
 * capture-mocks.mjs: screenshot every phone mock at APP scale, for comparing
 * with real app captures.
 *
 * Each `.phone-mock__screen` is captured with a device scale chosen so the
 * screen is exactly `--mock-device-width` pixels wide (402 for the 6.3"
 * iPhone), i.e. one pixel per app point. A simulator screenshot of the app
 * divided by 3 is then the same size, so the two can sit side by side and be
 * measured. Animations are switched off and every mock is forced in view, so
 * a capture never catches a fade half-way.
 *
 * Lazy images are switched to eager and awaited, so artwork is in the shot.
 * MOCK_CSS, if set, is appended as a stylesheet: a way to hold a mock in a
 * comparison state (e.g. MOCK_CSS='.phone-mock--detail .phone-mock__screen
 * { --d7-scroll: 0px }') without editing the page.
 *
 * Usage:
 *   node tools/capture-mocks.mjs <url> <out-dir> [light|dark]
 * Drives Chrome over the DevTools protocol; no npm dependencies.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [url = "http://localhost:8790/", out = "mock-captures", theme = "light"] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
mkdirSync(out, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), "pm-capture-" + process.pid)}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(2500);

const mocks = await evaluate(`(async () => {
  document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
  const st = document.createElement('style');
  st.textContent = '*,*::before,*::after{transition:none!important;animation-play-state:paused!important}' +
    'html{scroll-behavior:auto!important}' +
    '.phone-mock,.lib-anim,.coll-row{opacity:1!important}.phone-mock{transform:none!important}';
  st.textContent += ${JSON.stringify(process.env.MOCK_CSS || "")};
  document.head.appendChild(st);
  document.querySelectorAll('.phone-mock,.anim-host').forEach((e) => e.classList.add('in-view'));
  const imgs = [...document.querySelectorAll('.phone-mock img')];
  imgs.forEach((i) => { i.loading = 'eager'; });
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  await new Promise((r) => setTimeout(r, 400));
  const deviceW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mock-device-width')) || 402;
  return [...document.querySelectorAll('.phone-mock')].map((m, i) => {
    const r = m.querySelector('.phone-mock__screen').getBoundingClientRect();
    const name = (m.className.match(/phone-mock--([\\w-]+)/) || [, 'mock' + i])[1];
    return { name, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, deviceW };
  });
})()`);

for (const m of mocks) {
  const scale = m.deviceW / m.w;
  const shot = await send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: true,
    clip: { x: m.x, y: m.y, width: m.w, height: m.h, scale },
  });
  const file = join(out, `site-${m.name}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log(`${file}  ${Math.round(m.w * scale)}×${Math.round(m.h * scale)}`);
}
ws.close();
chrome.kill();
