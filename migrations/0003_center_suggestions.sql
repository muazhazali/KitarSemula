-- 0003_center_suggestions.sql — moderation queue for community center submissions.
--
-- Public submissions never write to `centers` directly. They land here as
-- PENDING and only become visible after an admin approves them through
-- /api/admin/suggestions.

CREATE TABLE IF NOT EXISTS center_suggestions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  state TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website_url TEXT,
  accepted_items TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  center_slug TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_center_suggestions_status
  ON center_suggestions (status, created_at);
