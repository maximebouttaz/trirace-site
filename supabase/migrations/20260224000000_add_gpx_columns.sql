ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS track_geojson     JSONB,
  ADD COLUMN IF NOT EXISTS elevation_profile JSONB,
  ADD COLUMN IF NOT EXISTS gpx_url           TEXT;
