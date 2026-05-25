CREATE TABLE IF NOT EXISTS dig_reactions (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_snapshot ON dig_reactions (snapshot_id);
