// What the homepage hero pill says — one pure function, shared by the
// /api/app-status Function and its test, so the rule lives in one place.
//
// The pill used to be a hand-typed "Now on the App Store". The user wanted the
// hero to say when an update is in review (2026-10-16) — in a visitor's words,
// not Apple's: "Coming soon in 1.3: …", then "New in 1.3: …" for two weeks
// after it ships, then back to the plain line with the live version.
//
// **It cannot drift.** The live version comes from Apple (iTunes Lookup), not
// from us; "coming soon" needs both our roadmap stage ("submitted") AND Apple
// still serving an older version — so a release nobody marks on the site still
// flips the pill to "New in". With no answer from Apple, this returns null and
// the page keeps its static "Now on the App Store": never an unverified claim.

export const APP_STORE_URL = "https://apps.apple.com/app/id6780289082";
export const NEW_FOR_DAYS = 14;

export function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * @param live   { version, releaseDate } from Apple, or null
 * @param status { next: { version, stage }, headlines: { [version]: string } }
 * @param now    Date
 * @returns { state, lead, rest, href } or null
 */
export function pillFor(live, status, now = new Date()) {
  if (!live || !live.version) return null;
  const next = (status && status.next) || {};
  const headlines = (status && status.headlines) || {};

  if (next.stage === "submitted" && next.version && headlines[next.version] &&
      compareVersions(next.version, live.version) > 0) {
    return { state: "coming", lead: `Coming soon in ${next.version}`, rest: headlines[next.version], href: "/roadmap/" };
  }

  // A bug-fix release (1.5.1) has no line of its own: it keeps its version's
  // (1.5), or shipping a fix would end "New in 1.5" early (2026-10-26). The
  // two weeks run from Apple's date, so from the fix's release.
  const minor = String(live.version).split(".").slice(0, 2).join(".");
  const shown = headlines[live.version] ? live.version : headlines[minor] ? minor : null;
  const released = live.releaseDate ? new Date(live.releaseDate) : null;
  const ageDays = released ? (now - released) / 86400000 : Infinity;
  if (shown && ageDays >= 0 && ageDays <= NEW_FOR_DAYS) {
    return { state: "new", lead: `New in ${shown}`, rest: headlines[shown], href: "/releases/" };
  }

  return { state: "current", lead: "Now on the App Store", rest: `v${live.version}`, href: APP_STORE_URL };
}
