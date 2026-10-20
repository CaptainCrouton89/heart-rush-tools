-- A roll in the feed is a historical record: it keeps the label it was rolled under (finding 9), and a stratagem carries a
-- revision so a write that started from an older row is refused instead of overwriting it.

ALTER TABLE roll ADD COLUMN objective_label TEXT;  -- "<goal> — <objective title>" at roll time; set with objective_stratagem_id

-- Rolls made before this column existed take the label their stratagem shows now; one whose stratagem is gone stays NULL.
UPDATE roll SET objective_label = (
  SELECT s.goal || ' — ' || COALESCE(NULLIF(trim(json_extract(s.objectives, '$[' || roll.objective_index || '].title')), ''), 'Unknown objective')
    FROM stratagem s WHERE s.id = roll.objective_stratagem_id AND json_extract(s.objectives, '$[' || roll.objective_index || ']') IS NOT NULL
) WHERE objective_stratagem_id IS NOT NULL;

ALTER TABLE stratagem ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
