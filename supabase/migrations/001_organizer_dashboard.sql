-- =============================================================================
-- Migration: 001_organizer_dashboard
-- Description: Adds organizer dashboard support to the triathlon race platform.
--              Creates the profiles table, extends the races table with ownership
--              and status columns, sets up RLS policies, triggers, and indexes.
-- =============================================================================


-- =============================================================================
-- SECTION 1: profiles table
-- Extends auth.users with organizer-specific metadata.
-- Each row is linked 1-to-1 with an auth.users row via the id foreign key.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name         TEXT,
  organization_name TEXT,
  email             TEXT,
  role              TEXT DEFAULT 'organizer' CHECK (role IN ('organizer', 'admin')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
  'Organizer and admin profiles that extend auth.users. Created automatically on signup via trigger.';

COMMENT ON COLUMN public.profiles.role IS
  'User role: "organizer" for race organizers, "admin" for platform administrators.';


-- =============================================================================
-- SECTION 2: Extend the races table
-- - organizer_id links a race to its owning profile (NULL for scraped races).
-- - status controls visibility: existing scraped races default to "published".
-- =============================================================================

ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'pending', 'draft'));

-- Back-fill: all pre-existing scraped races are already public.
-- organizer_id remains NULL (no owner) and status defaults to 'published',
-- so no explicit UPDATE is required here.

COMMENT ON COLUMN public.races.organizer_id IS
  'Foreign key to profiles.id. NULL for races imported by the scraper; set for organizer-submitted races.';

COMMENT ON COLUMN public.races.status IS
  '"published" = visible to everyone; "pending" = awaiting admin review; "draft" = not yet submitted.';


-- =============================================================================
-- SECTION 3: Profile insert policy
-- Profile creation is handled in the Next.js signup flow (not via trigger
-- because the SQL Editor cannot create triggers on auth.users).
-- We need an INSERT policy so the signup code can create the profile.
-- =============================================================================

-- Allow authenticated users to insert their own profile (used at signup).
CREATE POLICY "profiles: users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());


-- =============================================================================
-- SECTION 4: updated_at trigger for profiles
-- Automatically keeps profiles.updated_at current whenever a row is changed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Generic trigger function that sets updated_at to the current timestamp on every UPDATE.';

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- =============================================================================
-- SECTION 5: Row-Level Security (RLS)
-- =============================================================================

-- ----- profiles -----

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile.
CREATE POLICY "profiles: users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile.
CREATE POLICY "profiles: users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ----- races -----

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read published races.
CREATE POLICY "races: public can read published races"
  ON public.races
  FOR SELECT
  USING (status = 'published');

-- Authenticated organizers can read ALL of their own races regardless of status.
-- This lets them see their drafts and pending submissions in the dashboard.
CREATE POLICY "races: organizers can read own races"
  ON public.races
  FOR SELECT
  USING (organizer_id = auth.uid());

-- Organizers can create new races that they own.
CREATE POLICY "races: organizers can insert own races"
  ON public.races
  FOR INSERT
  WITH CHECK (organizer_id = auth.uid());

-- Organizers can update only their own races.
CREATE POLICY "races: organizers can update own races"
  ON public.races
  FOR UPDATE
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Organizers can delete only their own races.
CREATE POLICY "races: organizers can delete own races"
  ON public.races
  FOR DELETE
  USING (organizer_id = auth.uid());

-- Note: The Supabase service role key bypasses RLS entirely by design.
-- Server-side operations (scraper, admin scripts) should use the service role key.


-- =============================================================================
-- SECTION 6: Indexes
-- Improve query performance for organizer dashboard lookups and status filters.
-- =============================================================================

-- Speeds up "show me all races for organizer X" queries in the dashboard.
CREATE INDEX IF NOT EXISTS races_organizer_id_idx ON public.races (organizer_id);

-- Speeds up "show all published races" queries on the public listing pages.
CREATE INDEX IF NOT EXISTS races_status_idx ON public.races (status);

-- Speeds up profile lookup by email (e.g., admin search, deduplication checks).
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
