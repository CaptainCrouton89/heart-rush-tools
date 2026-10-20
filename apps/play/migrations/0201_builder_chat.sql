-- The creation assistant's chat: one row per draft that has had a message. Ownership is the character's (read through a join),
-- so there is no owner column. Finish sets `archived`; every chat query requires archived = 0.
CREATE TABLE builder_chat (
  character_id TEXT PRIMARY KEY REFERENCES character(id) ON DELETE CASCADE,
  messages TEXT NOT NULL DEFAULT '[]',          -- JSON array of stored messages, oldest first
  claim TEXT,                                   -- a fresh ULID while a send/run holds the row
  claimed_at TEXT,                              -- when the claim was taken (the 60 s stale rule)
  active_run_id TEXT,
  stop_requested INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,                              -- JSON ChatError for the last run that gave no result
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
