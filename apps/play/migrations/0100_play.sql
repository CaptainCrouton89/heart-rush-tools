-- Play's game tables. The user table comes from 0001_northlight_auth.sql; the shared session authority is AUTH_DB, not this database.
-- Timestamps are ISO-8601 UTC strings (they sort lexicographically).

CREATE TABLE campaign (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gm_user_id TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE campaign_member (
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('gm','player')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (campaign_id, user_id)
);
CREATE INDEX campaign_member_user ON campaign_member(user_id);

CREATE TABLE campaign_invite (
  token TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id),
  expires_at TEXT NOT NULL,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX campaign_invite_campaign ON campaign_invite(campaign_id);

CREATE TABLE character (
  id TEXT PRIMARY KEY,                 -- ULID
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaign(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                  -- copy of state.identity.name for lists
  state TEXT NOT NULL,                 -- JSON Character; schemaVersion inside
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX character_owner ON character(owner_user_id);
CREATE INDEX character_campaign ON character(campaign_id);

CREATE TABLE character_event (
  id TEXT PRIMARY KEY,                 -- ULID; the action's id
  character_id TEXT NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  seq INTEGER NOT NULL,                -- the revision this event produced
  action TEXT NOT NULL,                -- JSON
  inverse TEXT NOT NULL,               -- JSON
  undone INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX character_event_seq ON character_event(character_id, seq DESC);
