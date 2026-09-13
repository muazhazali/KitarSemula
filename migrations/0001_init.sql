-- 0001_init.sql — D1 bootstrap for KitarSemula.app
--
-- Centers are still served from lib/seed-data.ts at this stage; the table and
-- votes table are provisioned here so the Phase 2/3 migration can move those
-- routes onto D1 without another schema change.

CREATE TABLE IF NOT EXISTS centers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  state TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website_url TEXT,
  google_maps_url TEXT,
  accepted_items TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  opening_hours TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_centers_state ON centers (state);
CREATE INDEX IF NOT EXISTS idx_centers_updated_at ON centers (updated_at);

CREATE TABLE IF NOT EXISTS votes (
  center_slug TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('UP', 'DOWN')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (center_slug, voter_key)
);

-- Photos: at most 1 per center, enforced by the (center_slug, slot) unique
-- constraint plus slot CHECK. Slot 0 is the center thumbnail.
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  center_slug TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 1),
  created_at TEXT NOT NULL,
  UNIQUE (center_slug, slot)
);

CREATE INDEX IF NOT EXISTS idx_photos_center ON photos (center_slug);
