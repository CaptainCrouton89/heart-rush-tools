-- Combat encounter builder: the GM's remembered party line and their saved encounters.
-- Timestamps are ISO-8601 UTC strings (they sort lexicographically).

CREATE TABLE party (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  characters INTEGER NOT NULL DEFAULT 4,
  bloodmarks INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE encounter (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                 -- first message truncated, replaced by encounter.title once one exists
  messages TEXT NOT NULL,              -- JSON array: { role: 'gm'|'agent', text, step?, at }
  document TEXT,                       -- JSON encounter, the current version; null until generated
  active_run_id TEXT,                  -- set while a run is in flight
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX encounter_user_updated ON encounter(user_id, updated_at);
