-- Legacy sync stored farm labels like "Land 178961" in display_name.
UPDATE snapshots SET display_name = NULL WHERE visibility = 'public';

UPDATE snapshots
SET display_name = NULL
WHERE display_name IS NOT NULL
  AND (
    TRIM(display_name) GLOB 'Land [0-9]*'
    OR TRIM(display_name) GLOB 'Land #[0-9]*'
    OR TRIM(display_name) GLOB 'land [0-9]*'
    OR TRIM(display_name) GLOB 'land #[0-9]*'
  );

UPDATE snapshots SET land_id = NULL WHERE visibility = 'public' AND land_id IS NOT NULL;
