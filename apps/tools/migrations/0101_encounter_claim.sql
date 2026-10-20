-- Encounter run ownership: `claim` is a random token held by the one request that owns the encounter's run, so a stale request
-- cannot overwrite or release a newer claim. Idle = claim NULL; starting = claim set, active_run_id NULL; running = both set.
-- `stop_requested` records a Stop that arrived before the run id was known; whoever records the run id then cancels it.
ALTER TABLE encounter ADD COLUMN claim TEXT;
ALTER TABLE encounter ADD COLUMN stop_requested INTEGER NOT NULL DEFAULT 0;

-- Runs already in flight keep their id under a fresh token. A literal 'starting' had no run id: it becomes a claim with none,
-- which the next page load recovers once it is stale.
UPDATE encounter SET claim = lower(hex(randomblob(16))) WHERE active_run_id IS NOT NULL;
UPDATE encounter SET active_run_id = NULL WHERE active_run_id = 'starting';
