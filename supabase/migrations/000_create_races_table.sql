-- =============================================================================
-- Migration: 000_create_races_table
-- Description: Initial races table creation.
-- Run this BEFORE 001_organizer_dashboard.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.races (
  id                    BIGSERIAL PRIMARY KEY,
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  date                  DATE,
  location              TEXT,
  city                  TEXT,
  department            TEXT,
  region                TEXT,
  country               TEXT DEFAULT 'France',
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  discipline            TEXT DEFAULT 'triathlon',
  category              TEXT,
  swim_distance         INTEGER,
  bike_distance         INTEGER,
  run_distance          INTEGER,
  total_distance        INTEGER,
  bike_elevation        INTEGER,
  run_elevation         INTEGER,
  total_elevation       INTEGER,
  price_euros           NUMERIC(8,2),
  max_participants      INTEGER,
  time_limit_hours      NUMERIC(4,1),
  description           TEXT,
  tagline               TEXT,
  image_gradient        TEXT,
  avg_temp_celsius      NUMERIC(4,1),
  avg_water_temp_celsius NUMERIC(4,1),
  avg_wind_kmh          NUMERIC(5,1),
  record_men            TEXT,
  record_women          TEXT,
  tags                  TEXT[],
  website_url           TEXT,
  finishers_url         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS races_slug_idx    ON public.races (slug);
CREATE INDEX IF NOT EXISTS races_date_idx    ON public.races (date);
CREATE INDEX IF NOT EXISTS races_city_idx    ON public.races (city);
CREATE INDEX IF NOT EXISTS races_category_idx ON public.races (category);
