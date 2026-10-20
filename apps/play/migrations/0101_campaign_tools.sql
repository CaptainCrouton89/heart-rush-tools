-- Campaign day, session log, stratagems, roll feed and character journal (spec "Data the features need").

ALTER TABLE campaign ADD COLUMN current_day INTEGER NOT NULL DEFAULT 1 CHECK (current_day >= 1);

CREATE TABLE campaign_session (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  real_date TEXT NOT NULL,             -- YYYY-MM-DD
  start_day INTEGER NOT NULL,
  end_day INTEGER,                     -- NULL while the session is open
  recap TEXT NOT NULL DEFAULT '',      -- markdown
  xp_awards TEXT NOT NULL DEFAULT '[]',-- JSON [{amount, at}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX campaign_session_number ON campaign_session(campaign_id, number);
-- At most one open session per campaign.
CREATE UNIQUE INDEX campaign_session_open ON campaign_session(campaign_id) WHERE end_day IS NULL;

CREATE TABLE session_encounter (
  session_id TEXT NOT NULL REFERENCES campaign_session(id) ON DELETE CASCADE,
  encounter_id TEXT NOT NULL,          -- the encounter's id on tools.heartrush.party
  title TEXT NOT NULL,
  attached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (session_id, encounter_id)
);

CREATE TABLE stratagem (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  time_per_roll TEXT NOT NULL,
  setup_cn INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','abandoned')),
  position INTEGER NOT NULL,
  objectives TEXT NOT NULL DEFAULT '[]',  -- JSON [{title, cn, leaderCharacterId, state}]
  assets TEXT NOT NULL DEFAULT '[]',      -- JSON [{name, kind}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX stratagem_campaign ON stratagem(campaign_id, position);

CREATE TABLE roll (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id),
  roll_type TEXT NOT NULL CHECK (roll_type IN ('check','save','attack','defense')),
  ability TEXT NOT NULL,
  dice TEXT NOT NULL,                  -- JSON [{sides, value, dropped, rerolled}]
  modifier INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  -- pending: exactly one kept 1, the roller has not chosen yet; double: two or more kept 1s (automatic failure plus complication)
  complication TEXT NOT NULL DEFAULT 'none' CHECK (complication IN ('none','pending','failed','rerolled','double')),
  objective_stratagem_id TEXT,         -- set with objective_index and objective_cn for a stratagem roll
  objective_index INTEGER,
  objective_cn INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX roll_campaign_time ON roll(campaign_id, created_at DESC);

CREATE TABLE journal_entry (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES user(id),
  body TEXT NOT NULL,                  -- markdown
  in_game_day INTEGER,                 -- the campaign's current_day at creation; NULL outside a campaign
  session_id TEXT REFERENCES campaign_session(id) ON DELETE SET NULL,
  shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX journal_character ON journal_entry(character_id, created_at DESC);
CREATE INDEX journal_session_shared ON journal_entry(session_id, shared);
