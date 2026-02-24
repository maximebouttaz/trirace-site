import { createClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import IncompleteRacesClient from './IncompleteRacesClient'

export interface IncompleteRace {
  id: number
  slug: string
  name: string
  city: string
  country: string
  date: string | null
  category: string
  sync_source: string | null
  finishers_url: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  price_euros: number | null
  swim_distance: number | null
  bike_distance: number | null
  run_distance: number | null
  image_url: string | null
  website_url: string | null
  formats: Array<{ name: string }> | null
  region: string | null
  // Premium fields
  total_elevation: number | null
  bike_elevation: number | null
  avg_water_temp_celsius: number | null
  qualification_for: string | null
  registration_deadline: string | null
  finishers_count: number | null
  time_limit_hours: number | null
  max_participants: number | null
  swim_type: string | null
  record_men: string | null
  record_women: string | null
  completeness_score?: number
}

export interface CompletenessStats {
  total_published: number
  by_field: {
    image: number
    gps: number
    description: number
    price: number
    distances: number
    region: number
    website: number
    // Premium fields
    elevation: number
    water_temp: number
    qualification: number
    registration_deadline: number
    finishers_count: number
    time_limit: number
    max_participants: number
    swim_type: number
    records: number
  }
}

const COMPLETENESS_FIELDS = [
  'name', 'city', 'date', 'category', 'latitude', 'longitude',
  'description', 'price_euros', 'swim_distance', 'bike_distance',
  'run_distance', 'image_url', 'website_url', 'formats', 'region',
  // Premium fields
  'total_elevation', 'bike_elevation', 'avg_water_temp_celsius',
  'qualification_for', 'registration_deadline', 'finishers_count',
  'time_limit_hours', 'max_participants', 'swim_type', 'record_men', 'record_women',
] as const

function computeScore(race: IncompleteRace): number {
  let filled = 0
  for (const field of COMPLETENESS_FIELDS) {
    const value = race[field as keyof IncompleteRace]
    if (value !== null && value !== undefined) filled++
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

const PAGE_SIZE = 24

export default async function AdminIncompletePage() {
  const supabaseServer = await createClient()

  // Fetch races et stats en parallèle via Supabase (pas de fetch HTTP)
  const baseCount = () =>
    supabase.from('races').select('id', { count: 'exact', head: true }).eq('needs_review', false).is('deleted_at', null)

  const [racesResult, ...countResults] = await Promise.all([
    supabaseServer
      .from('races')
      .select('id, slug, name, city, country, date, category, sync_source, finishers_url, latitude, longitude, description, price_euros, swim_distance, bike_distance, run_distance, image_url, website_url, formats, region, total_elevation, bike_elevation, avg_water_temp_celsius, qualification_for, registration_deadline, finishers_count, time_limit_hours, max_participants, swim_type, record_men, record_women')
      .eq('needs_review', false)
      .is('deleted_at', null)
      .order('id', { ascending: true }),
    baseCount(),
    baseCount().is('image_url', null),
    baseCount().is('latitude', null),
    baseCount().is('description', null),
    baseCount().is('price_euros', null),
    baseCount().is('swim_distance', null),
    baseCount().is('region', null),
    baseCount().is('website_url', null),
    // Premium field counts
    baseCount().is('total_elevation', null),
    baseCount().is('avg_water_temp_celsius', null),
    baseCount().is('qualification_for', null),
    baseCount().is('registration_deadline', null),
    baseCount().is('finishers_count', null),
    baseCount().is('time_limit_hours', null),
    baseCount().is('max_participants', null),
    baseCount().is('swim_type', null),
    baseCount().is('record_men', null),
  ])

  const [total, image, gps, description, price, distances, region, website, elevation, water_temp, qualification, registration_deadline, finishers_count, time_limit, max_participants, swim_type, records] = countResults.map(r => r.count ?? 0)

  const stats: CompletenessStats = {
    total_published: total,
    by_field: { image, gps, description, price, distances, region, website, elevation, water_temp, qualification, registration_deadline, finishers_count, time_limit, max_participants, swim_type, records },
  }

  // Calculer les scores et filtrer < 80%
  const allRaces = (racesResult.data ?? []) as IncompleteRace[]
  const withScores = allRaces
    .map(r => ({ ...r, completeness_score: computeScore(r) }))
    .filter(r => (r.completeness_score ?? 100) < 80)

  const initialRaces = withScores.slice(0, PAGE_SIZE)
  const initialTotal = withScores.length
  const initialTotalPages = Math.ceil(initialTotal / PAGE_SIZE)

  // Compute global completeness stats
  let totalScore = 0
  let perfectCount = 0
  for (const race of allRaces) {
    const score = computeScore(race)
    totalScore += score
    if (score === 100) perfectCount++
  }
  const avgScore = allRaces.length > 0 ? Math.round(totalScore / allRaces.length) : 0

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Courses incomplètes</h1>
        <p className="text-zinc-500 mt-1">
          {initialTotal} course{initialTotal > 1 ? 's' : ''} avec des données manquantes.
        </p>
      </div>
      <IncompleteRacesClient
        initialRaces={initialRaces}
        initialTotal={initialTotal}
        initialTotalPages={initialTotalPages}
        stats={stats}
        avgScore={avgScore}
        perfectCount={perfectCount}
        totalPublished={allRaces.length}
      />
    </div>
  )
}
