-- Store the actual digs timeline for practice runs so the hub can render the result grid.
ALTER TABLE practice_runs ADD COLUMN digs_json TEXT;
