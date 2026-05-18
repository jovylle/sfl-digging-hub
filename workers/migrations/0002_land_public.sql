ALTER TABLE snapshots ADD COLUMN land_id TEXT;
ALTER TABLE snapshots ADD COLUMN mark_events_json TEXT;

CREATE INDEX IF NOT EXISTS idx_snapshots_land_id ON snapshots (land_id, utc_date DESC);

-- Recreate snapshots so edit_token_hash is optional (dig-day uses public land rows)
CREATE TABLE snapshots_new (
  id TEXT PRIMARY KEY,
  utc_date TEXT NOT NULL,
  land_id TEXT,
  land_id_hash TEXT NOT NULL,
  display_name TEXT,
  patterns_json TEXT NOT NULL DEFAULT '[]',
  digs_json TEXT NOT NULL,
  stats_json TEXT NOT NULL DEFAULT '{}',
  marks_json TEXT,
  mark_events_json TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('private', 'unlisted', 'public')),
  screenshot_key TEXT,
  edit_token_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (land_id_hash, utc_date)
);

INSERT INTO snapshots_new (
  id, utc_date, land_id, land_id_hash, display_name, patterns_json, digs_json,
  stats_json, marks_json, mark_events_json, visibility, screenshot_key,
  edit_token_hash, created_at, updated_at
)
SELECT
  id, utc_date, NULL, land_id_hash, display_name, patterns_json, digs_json,
  stats_json, marks_json, NULL, visibility, screenshot_key,
  edit_token_hash, created_at, updated_at
FROM snapshots;

DROP TABLE snapshots;
ALTER TABLE snapshots_new RENAME TO snapshots;

CREATE INDEX IF NOT EXISTS idx_snapshots_visibility_date ON snapshots (visibility, utc_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_land_id ON snapshots (land_id, utc_date DESC);
