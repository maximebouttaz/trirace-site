-- Per-discipline cutoff times (in minutes)
ALTER TABLE races ADD COLUMN IF NOT EXISTS swim_cutoff_minutes integer;
ALTER TABLE races ADD COLUMN IF NOT EXISTS bike_cutoff_minutes integer;
ALTER TABLE races ADD COLUMN IF NOT EXISTS run_cutoff_minutes integer;
