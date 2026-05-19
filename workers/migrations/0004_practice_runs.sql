CREATE TABLE IF NOT EXISTS practice_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  display_name TEXT,
  pattern_source TEXT NOT NULL CHECK (pattern_source IN ('daily', 'random')),
  pattern_date TEXT,
  pattern_keys_json TEXT NOT NULL DEFAULT '[]',
  dig_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  victory INTEGER NOT NULL DEFAULT 0,
  treasure_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_practice_daily_score
  ON practice_runs (pattern_source, pattern_date, score ASC);

CREATE INDEX IF NOT EXISTS idx_practice_random_created
  ON practice_runs (pattern_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_user_created
  ON practice_runs (user_id, created_at DESC);
