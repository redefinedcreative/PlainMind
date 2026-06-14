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

// Pages that share the FULL header + footer (relative to public/).
const PAGES = [
  "index.html",
  "beta/index.html",
  "press/index.html",
  "roadmap/index.html",
  "help/index.html",
  "privacy/index.html",
  "terms/index.html",
];

// Pages that share ONLY the footer — their header is intentionally unique, so it's left untouched.
// welcome/ has a minimal brand-only header (post-signup arrival) but still gets the shared footer
// (brand, theme toggle, legal links) so legal/links stay consistent + in sync everywhere.
const FOOTER_ONLY = [
  "welcome/index.html",
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

const footerOnly = REGIONS.filter((r) => r.name === "footer");
const TARGETS = [
  ...PAGES.map((page) => ({ page, regions: REGIONS })),
  ...FOOTER_ONLY.map((page) => ({ page, regions: footerOnly })),
];

let changed = 0;
let failed = 0;

for (const { page, regions } of TARGETS) {
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
  for (const region of regions) {
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

console.log(`\nDone: ${changed} updated, ${TARGETS.length - changed} unchanged${failed ? `, ${failed} problems` : ""}.`);
if (failed) process.exit(1);
