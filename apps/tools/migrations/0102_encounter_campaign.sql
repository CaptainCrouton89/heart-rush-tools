-- The play.heartrush.party campaign whose characters an encounter's runs read instead of the typed party line (spec §7.2).
-- NULL = the GM's typed party. The id is play's; tools keeps no copy of the campaign and play checks the GM role on every read.
ALTER TABLE encounter ADD COLUMN campaign_id TEXT;
