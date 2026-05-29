-- Public digs must not expose farm display names on community or /dig/:id pages.
UPDATE snapshots SET display_name = NULL WHERE visibility = 'public' AND display_name IS NOT NULL;
