-- PlainMind founder store (Phase 2 monetization).
-- One row per beta signup, in signup order. `number` (1..N) IS the founder number;
-- the first 200 are founders (see CAP in the Functions). UNIQUE(email) makes the
-- assignment idempotent — re-running /api/subscribe for the same email never double-assigns.
--
-- Provision once:
--   wrangler d1 create plainmind-founders
--   wrangler d1 execute plainmind-founders --remote --file=schema.sql
-- Then bind it to the Pages project as `DB` (dashboard → Settings → Functions → D1 bindings).

CREATE TABLE IF NOT EXISTS founders (
  number             INTEGER PRIMARY KEY AUTOINCREMENT,  -- 1..N, by signup order; <=200 = founder
  email              TEXT UNIQUE NOT NULL,               -- lower-cased
  created_at         TEXT NOT NULL,                       -- ISO 8601, set at first signup
  name               TEXT,                                -- first name (from /welcome); shown on the in-app founder pass
  -- Phase B founder-price integrity (updated by /api/revenuecat-webhook):
  founder_active     INTEGER NOT NULL DEFAULT 0,          -- 1 while the founder_annual entitlement is active
  founder_expires_at TEXT                                 -- ISO 8601 expiry of the last founder term (for the grace check)
);

-- Migrations for an EXISTING founder store, run once against the live DB
-- (harmless to skip on a fresh DB — the CREATE above already includes them):
--   ALTER TABLE founders ADD COLUMN name TEXT;
--   ALTER TABLE founders ADD COLUMN founder_active INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE founders ADD COLUMN founder_expires_at TEXT;
