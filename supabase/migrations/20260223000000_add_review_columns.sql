-- Colonnes pour le workflow de validation des nouvelles courses
ALTER TABLE races ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE races ADD COLUMN IF NOT EXISTS sync_source TEXT;
UPDATE races SET needs_review = FALSE WHERE needs_review IS NULL;
