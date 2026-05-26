-- Community feed and public dig pages must not expose farm land IDs.
UPDATE snapshots SET land_id = NULL WHERE visibility = 'public' AND land_id IS NOT NULL;
