-- Repair migration for environments where 0013 was partially applied
-- and auth_email_approvals is missing.
CREATE TABLE IF NOT EXISTS auth_email_approvals (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  return_url TEXT,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  approval_consumed_at TEXT,
  session_consumed_at TEXT,
  request_ip_hash TEXT,
  approved_ip_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_email_approvals_token_hash
  ON auth_email_approvals (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_email_approvals_challenge_id
  ON auth_email_approvals (challenge_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_email_approvals_flow_id
  ON auth_email_approvals (flow_id);

CREATE INDEX IF NOT EXISTS idx_auth_email_approvals_email_created
  ON auth_email_approvals (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_email_approvals_expires
  ON auth_email_approvals (expires_at);
