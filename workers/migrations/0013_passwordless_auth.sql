-- Passwordless auth support: provider links, OTPs, JWT revocation, and dig attribution.
CREATE TABLE IF NOT EXISTS auth_providers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google')),
  provider_subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_providers_user ON auth_providers (user_id);

CREATE TABLE IF NOT EXISTS auth_email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_email_otps_lookup
  ON auth_email_otps (email, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  scope TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, rate_key, window_start)
);

CREATE TABLE IF NOT EXISTS auth_revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_revoked_tokens_expires
  ON auth_revoked_tokens (expires_at);

ALTER TABLE snapshots ADD COLUMN user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
  ON snapshots (user_id, utc_date DESC);
