-- Northlight sign-in tables. Apps apply this with `wrangler d1 migrations apply`.
-- Names 0001-0099 are reserved for this package; an app's own migrations start at 0100.
-- Timestamps are ISO-8601 UTC strings (they sort lexicographically).

CREATE TABLE user (
  id TEXT PRIMARY KEY,                 -- Northlight subject, e.g. 'user:abc'
  display_name TEXT NOT NULL,
  email TEXT,                          -- only when the `email` scope was requested and approved
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,                 -- 128-bit random, base64url; the cookie value
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX session_user ON session(user_id);
CREATE INDEX session_expires ON session(expires_at);

CREATE TABLE auth_pending (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  next_path TEXT NOT NULL DEFAULT '/',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX auth_pending_created ON auth_pending(created_at);

CREATE TABLE connection (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  runtime_url TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  access_token_expires_at TEXT NOT NULL,
  id_token TEXT,
  updated_at TEXT NOT NULL,
  lock_until TEXT,                     -- NULL or the ISO time the current lease expires
  lock_token TEXT                      -- random per lease; every save is fenced on it
);
CREATE INDEX connection_updated ON connection(updated_at, user_id);
