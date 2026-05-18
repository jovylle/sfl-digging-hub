CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  utc_date TEXT NOT NULL,
  land_id_hash TEXT NOT NULL,
  display_name TEXT,
  patterns_json TEXT NOT NULL DEFAULT '[]',
  digs_json TEXT NOT NULL,
  stats_json TEXT NOT NULL DEFAULT '{}',
  marks_json TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  screenshot_key TEXT,
  edit_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (land_id_hash, utc_date)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  dig_ref INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_visibility_date ON snapshots (visibility, utc_date DESC);
CREATE INDEX IF NOT EXISTS idx_comments_snapshot ON comments (snapshot_id, created_at ASC);

CREATE TABLE IF NOT EXISTS comment_rate (
  ip_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);
