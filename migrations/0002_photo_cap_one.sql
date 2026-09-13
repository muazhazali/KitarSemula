-- Tighten the per-center photo cap from 3 to 1.
--
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt.
-- The UNIQUE (center_slug, slot) constraint is what actually enforces the cap;
-- the CHECK is defence in depth. Existing rows with slot > 0 are deleted first
-- so the rebuild cannot fail on the new constraint.

DELETE FROM photos WHERE slot > 0;

CREATE TABLE photos_new (
  id TEXT PRIMARY KEY,
  center_slug TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 1),
  created_at TEXT NOT NULL,
  UNIQUE (center_slug, slot)
);

INSERT INTO photos_new (id, center_slug, r2_key, content_type, size, slot, created_at)
  SELECT id, center_slug, r2_key, content_type, size, slot, created_at FROM photos;

DROP TABLE photos;
ALTER TABLE photos_new RENAME TO photos;

CREATE INDEX IF NOT EXISTS idx_photos_center ON photos (center_slug);
