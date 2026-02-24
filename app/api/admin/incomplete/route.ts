import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const COMPLETENESS_FIELDS = [
  'name', 'city', 'date', 'category', 'latitude', 'longitude',
  'description', 'price_euros', 'swim_distance', 'bike_distance',
  'run_distance', 'image_url', 'website_url', 'formats', 'region',
  // Premium fields
  'total_elevation', 'bike_elevation', 'avg_water_temp_celsius',
  'qualification_for', 'registration_deadline', 'finishers_count',
  'time_limit_hours', 'max_participants', 'swim_type', 'record_men', 'record_women',
] as const

type RaceRow = {
  id: number
  slug: string
  name: string | null
  city: string | null
  country: string
  date: string | null
  category: string | null
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
  formats: unknown[] | null
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
}

function computeScore(race: RaceRow): number {
  let filled = 0
  for (const field of COMPLETENESS_FIELDS) {
    const value = race[field as keyof RaceRow]
    if (value !== null && value !== undefined) filled++
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '24')))
  const missingField = searchParams.get('missing_field')
  const maxScore = Number(searchParams.get('max_score') ?? '80')
  const category = searchParams.get('category')

  let query = supabase
    .from('races')
    .select('id, slug, name, city, country, date, category, sync_source, finishers_url, latitude, longitude, description, price_euros, swim_distance, bike_distance, run_distance, image_url, website_url, formats, region, total_elevation, bike_elevation, avg_water_temp_celsius, qualification_for, registration_deadline, finishers_count, time_limit_hours, max_participants, swim_type, record_men, record_women')
    .eq('needs_review', false)
    .is('deleted_at', null)

  if (missingField === 'image') {
    query = query.is('image_url', null)
  } else if (missingField === 'gps') {
    query = query.is('latitude', null)
  } else if (missingField === 'description') {
    query = query.is('description', null)
  } else if (missingField === 'price') {
    query = query.is('price_euros', null)
  } else if (missingField === 'distances') {
    query = query.is('swim_distance', null)
  } else if (missingField === 'region') {
    query = query.is('region', null)
  } else if (missingField === 'website') {
    query = query.is('website_url', null)
  } else if (missingField === 'elevation') {
    query = query.is('total_elevation', null)
  } else if (missingField === 'water_temp') {
    query = query.is('avg_water_temp_celsius', null)
  } else if (missingField === 'qualification') {
    query = query.is('qualification_for', null)
  } else if (missingField === 'registration_deadline') {
    query = query.is('registration_deadline', null)
  } else if (missingField === 'finishers_count') {
    query = query.is('finishers_count', null)
  } else if (missingField === 'time_limit') {
    query = query.is('time_limit_hours', null)
  } else if (missingField === 'max_participants') {
    query = query.is('max_participants', null)
  } else if (missingField === 'swim_type') {
    query = query.is('swim_type', null)
  } else if (missingField === 'records') {
    query = query.is('record_men', null)
  }

  if (category === 'sprint') {
    query = query.in('category', ['XS', 'S'])
  } else if (category === 'olympic') {
    query = query.eq('category', 'M')
  } else if (category === 'half') {
    query = query.in('category', ['L', '70.3'])
  } else if (category === 'full') {
    query = query.in('category', ['XL', 'Ironman'])
  } else if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.order('id', { ascending: true })

  if (error) {
    console.error('[GET /api/admin/incomplete]', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }

  const rows = (data ?? []) as RaceRow[]
  const filtered = rows
    .map((race) => ({ ...race, completeness_score: computeScore(race) }))
    .filter((race) => race.completeness_score <= maxScore)

  const total = filtered.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  const pageData = filtered.slice(start, start + limit)

  return NextResponse.json({ data: pageData, total, page, totalPages })
}
