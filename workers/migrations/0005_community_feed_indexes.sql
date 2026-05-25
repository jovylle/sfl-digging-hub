-- Cursor-paginated, newest-first feeds for /v1/community and /v1/practice/victories.
CREATE INDEX IF NOT EXISTS idx_snapshots_visibility_created
  ON snapshots (visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_victory_created
  ON practice_runs (pattern_source, victory, created_at DESC);
