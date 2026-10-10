#!/usr/bin/env node
/**
 * sync-app-tokens.mjs — derive the site's app-mockup tokens from the iOS app.
 *
 * The phone mockups on this site are hand-built HTML/CSS. That is the right
 * call — they theme, animate, scale and stay selectable in a way screenshots
 * do not — but it means every colour, radius and metric in them is a *copy* of
 * a value that lives in the app. Copies drift, and nothing was catching it:
 * the mockups were two design generations behind before anyone noticed.
 *
 * So the values are generated instead. This reads the app's own sources and
 * writes `public/app-tokens.css`. The mock CSS consumes those variables; no
 * mock should contain a raw hex or a magic radius again.
 *
 * Sources, in the app repo:
 *   Assets.xcassets/<Name>.colorset/Contents.json  semantic colours, light+dark
 *   Models/ContentType.swift                       the eight content-type colours
 *   Utilities/Constants.swift                      Spacing, CornerRadius, ShadowStyle
 *   Utilities/Theme.swift                          Stroke, Opacity, Hero, Layout
 *
 * Usage:
 *   node tools/sync-app-tokens.mjs            # write public/app-tokens.css
 *   node tools/sync-app-tokens.mjs --check    # exit 1 if it would change
 *
 * `--check` is the point. Run it the way `sync-layout.mjs` is run and the
 * build fails when the app moves, instead of the site quietly going stale.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.PLAINMIND_APP ?? "/Users/keeganlanier/Developer/plainMind-ios/PlainMind";
const OUT = join(ROOT, "public", "styles.css");
const START = "/* app-tokens:start — generated, do not edit */";
const END = "/* app-tokens:end */";

if (!existsSync(APP)) {
  console.error(`✗ app sources not found at ${APP}\n  Set PLAINMIND_APP to the PlainMind/ directory.`);
  process.exit(2);
}

const read = (p) => readFileSync(join(APP, p), "utf8");
const kebab = (s) => s.replace(/^Brand/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/* ── colours: the asset catalog carries light AND dark, which is why it beats
      BrandPalette.swift as a source — the Swift file only has flat literals. */
function channel(raw) {
  const v = String(raw).trim();
  if (v.startsWith("0x")) return parseInt(v, 16);
  const n = Number(v);
  return n <= 1 ? Math.round(n * 255) : Math.round(n);
}
/* Alpha is not decoration here: BrandSecondary is BrandPrimary at 60%,
   BrandTertiary at 40%, dark BrandPrimary is white at 90% and dark
   BrandDivider is stone at 20%. Dropping it collapsed three distinct text
   tokens onto one colour. */
function cssColor(c) {
  const [r, g, b] = ["red", "green", "blue"].map((k) => channel(c.components[k]));
  const a = c.components.alpha === undefined ? 1 : Number(c.components.alpha);
  if (a >= 0.999) {
    return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("");
  }
  return `rgb(${r} ${g} ${b} / ${Number(a.toFixed(3))})`;
}

function colorsets() {
  const dir = join(APP, "Assets.xcassets");
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".colorset")) continue;
    const name = basename(entry, ".colorset");
    if (name === "AccentColor") continue;             // Apple's slot, not ours
    const json = JSON.parse(readFileSync(join(dir, entry, "Contents.json"), "utf8"));
    let light = null, dark = null;
    for (const c of json.colors ?? []) {
      if (!c.color?.components) continue;
      const isDark = (c.appearances ?? []).some((a) => a.value === "dark");
      try { isDark ? (dark = cssColor(c.color)) : (light = cssColor(c.color)); } catch {}
    }
    if (light || dark) out.push({ name: kebab(name), light, dark: dark ?? light });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ── the eight content-type colours, which live on the enum, not the palette */
function contentTypes() {
  const src = read("Models/ContentType.swift");
  return [...src.matchAll(/case \.(\w+):\s*return Color\(red:[^)]*\)\s*\/\/\s*#([0-9A-Fa-f]{6})/g)]
    .map(([, name, h]) => ({ name, hex: "#" + h.toUpperCase() }));
}

/* ── numeric scales. Mockup phones are a fraction of real size, so these are
      emitted raw and scaled at use site by --mock-scale; that keeps the
      proportions honest instead of re-guessing each number small. */
function scale(file, enumName, names) {
  const src = read(file);
  const block = src.slice(src.indexOf(`enum ${enumName}`));
  const end = block.indexOf("\n}");
  const body = block.slice(0, end === -1 ? undefined : end);
  const found = [...body.matchAll(/static let (\w+)\s*:\s*CGFloat\s*=\s*([0-9.]+)/g)];
  return found.filter(([, n]) => !names || names.includes(n)).map(([, n, v]) => ({ name: n, value: Number(v) }));
}

const colours = colorsets();
const types = contentTypes();
const spacing = scale("Utilities/Constants.swift", "Spacing");
const radius = scale("Utilities/Constants.swift", "CornerRadius");
const stroke = scale("Utilities/Theme.swift", "Stroke");
const opacity = scale("Utilities/Theme.swift", "Opacity");
const hero = scale("Utilities/Theme.swift", "Hero");
const layout = scale("Utilities/Theme.swift", "Layout");

const lines = [];
lines.push("/* GENERATED by tools/sync-app-tokens.mjs — do not edit by hand.");
lines.push(" *");
lines.push(" * Every value below is read out of the iOS app so the phone mockups are");
lines.push(" * derived from the product rather than imitating it. Re-run after any app");
lines.push(" * design change:  node tools/sync-app-tokens.mjs");
lines.push(" *");
lines.push(" * Sizes are the app's own point values. A mockup phone is a fraction of a");
lines.push(" * real one, so use them through --mock-scale:");
lines.push(" *     border-radius: calc(var(--app-radius-card) * var(--mock-scale));");
lines.push(" * which keeps the proportions true instead of re-guessing each number.");
lines.push(" */");
lines.push(":root {");
lines.push("  /* Mock phones render at roughly a third of device scale. */");
lines.push("  --mock-scale: 0.34;");
lines.push("");
lines.push("  /* semantic colours — light (asset catalog) */");
for (const c of colours) if (c.light) lines.push(`  --app-${c.name}: ${c.light};`);
lines.push("");
lines.push("  /* content types — ContentType.iconColor, mode-independent */");
for (const t of types) lines.push(`  --app-type-${t.name}: ${t.hex};`);
lines.push("");
lines.push("  /* spacing — Spacing (pt) */");
for (const s of spacing) lines.push(`  --app-space-${s.name}: ${s.value};`);
lines.push("");
lines.push("  /* corner radii — CornerRadius (pt) */");
for (const r of radius) lines.push(`  --app-radius-${r.name}: ${r.value};`);
lines.push("");
lines.push("  /* strokes & opacities — Theme.Stroke / Theme.Opacity */");
for (const s of stroke) lines.push(`  --app-stroke-${s.name}: ${s.value};`);
for (const o of opacity) lines.push(`  --app-opacity-${o.name}: ${o.value};`);
lines.push("");
lines.push("  /* sizes — Theme.Hero / Theme.Layout (pt) */");
for (const h of hero) lines.push(`  --app-size-${kebab(h.name)}: ${h.value};`);
for (const l of layout) lines.push(`  --app-layout-${kebab(l.name)}: ${l.value};`);
lines.push("}");
lines.push("");
lines.push(':root[data-theme="dark"] {');
lines.push("  /* semantic colours — dark (asset catalog) */");
for (const c of colours) if (c.dark) lines.push(`  --app-${c.name}: ${c.dark};`);
lines.push("}");
lines.push("");

/* Stamped into styles.css between markers rather than shipped as its own
   file: one less blocking request, and it matches how sync-layout.mjs keeps
   the header and footer in step. */
const block = [START, ...lines, END].join("\n");
const current = readFileSync(OUT, "utf8");
if (!current.includes(START) || !current.includes(END)) {
  console.error(`\u2717 markers missing in public/styles.css.\n  Add:\n${START}\n${END}`);
  process.exit(2);
}
const next =
  current.slice(0, current.indexOf(START)) + block + current.slice(current.indexOf(END) + END.length);

if (process.argv.includes("--check")) {
  if (current !== next) {
    console.error("\u2717 app tokens in public/styles.css are out of date.\n  Run: node tools/sync-app-tokens.mjs");
    process.exit(1);
  }
  console.log("\u2713 app tokens are in sync");
  process.exit(0);
}

writeFileSync(OUT, next);
console.log(
  `✓ stamped app tokens into public/styles.css — ${colours.length} semantic colours (light+dark), ` +
  `${types.length} content types, ${spacing.length} spacings, ${radius.length} radii, ` +
  `${hero.length + layout.length} sizes`
);
