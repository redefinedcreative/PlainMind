#!/usr/bin/env node
// sync-layout.mjs — stamp the shared header + footer into every in-sync page.
//
// The PlainMind site is static HTML with no build step (kept that way for SEO — every nav/footer
// link is real markup in the page, no JS injection). The header/footer therefore live as copies in
// each page. This script keeps those copies in sync from a single source of truth so they can never
// drift: edit _partials/header.html or _partials/footer.html, run `node tools/sync-layout.mjs`, and
// every in-sync page is rewritten. Links in the partials are root-relative (/…) so the block is
// identical on every page regardless of folder depth.
//
// Idempotent: re-running with no partial changes rewrites identical bytes. Run it before committing
// any header/footer change. Pages NOT in PAGES (e.g. welcome/) are intentionally unique and skipped.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); // PlainMind-Website/

// In-sync pages (relative to public/). welcome/ is deliberately excluded — minimal unique header.
const PAGES = [
  "index.html",
  "beta/index.html",
  "press/index.html",
  "roadmap/index.html",
  "help/index.html",
  "privacy/index.html",
  "terms/index.html",
];

// Each region: the regex matches an existing marker block OR the bare element (first run), so the
// script both installs markers and keeps them updated. `[ \t]*` swallows the line's leading indent
// so the replacement controls all indentation.
const REGIONS = [
  {
    name: "header",
    file: "_partials/header.html",
    re: /[ \t]*(?:<!-- partial:header:start -->[\s\S]*?<!-- partial:header:end -->|<header class="site-header"[\s\S]*?<\/header>)/,
  },
  {
    name: "footer",
    file: "_partials/footer.html",
    re: /[ \t]*(?:<!-- partial:footer:start -->[\s\S]*?<!-- partial:footer:end -->|<footer class="site-footer"[\s\S]*?<\/footer>)/,
  },
];

function block(name, body) {
  // body already carries its natural 2-space indentation and a trailing newline; trim it so we
  // control spacing exactly, then wrap in indented markers.
  const inner = body.replace(/\n+$/, "");
  return `  <!-- partial:${name}:start -->\n${inner}\n  <!-- partial:${name}:end -->`;
}

let changed = 0;
let failed = 0;

for (const page of PAGES) {
  const pagePath = join(ROOT, "public", page);
  let html;
  try {
    html = await readFile(pagePath, "utf8");
  } catch {
    console.error(`✗ ${page} — cannot read, skipped`);
    failed++;
    continue;
  }

  const before = html;
  for (const region of REGIONS) {
    const body = await readFile(join(ROOT, region.file), "utf8");
    const replacement = block(region.name, body);
    if (!region.re.test(html)) {
      console.error(`✗ ${page} — no ${region.name} region found`);
      failed++;
      continue;
    }
    html = html.replace(region.re, () => replacement);
  }

  if (html !== before) {
    await writeFile(pagePath, html, "utf8");
    console.log(`✓ ${page} — updated`);
    changed++;
  } else {
    console.log(`· ${page} — already in sync`);
  }
}

console.log(`\nDone: ${changed} updated, ${PAGES.length - changed} unchanged${failed ? `, ${failed} problems` : ""}.`);
if (failed) process.exit(1);
