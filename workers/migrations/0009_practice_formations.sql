-- Store the formation placements (answer key) submitted with each practice run.
ALTER TABLE practice_runs ADD COLUMN formations_json TEXT;

-- Also add a nickname column as an alias for display_name submitted from the practice client.
-- display_name remains the canonical column; this migration is a no-op for nickname since
-- the worker already maps nickname → display_name before insert.
