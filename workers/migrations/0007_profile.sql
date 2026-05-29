ALTER TABLE users ADD COLUMN nickname TEXT;

CREATE TABLE user_saved_lands (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  land_id   TEXT NOT NULL,
  saved_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, land_id)
);
CREATE INDEX user_saved_lands_user_idx ON user_saved_lands(user_id);
