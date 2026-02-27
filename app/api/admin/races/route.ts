import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { toNumberOrNull } from '@/lib/validators'

function makeSlug(name: string, city: string, year: number): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${normalize(name)}-${normalize(city)}-${year}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const { name, date, city, category } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })
  }
  if (!date || typeof date !== 'string') {
    return NextResponse.json({ error: 'La date est requise.' }, { status: 400 })
  }
  if (!city || typeof city !== 'string' || !city.trim()) {
    return NextResponse.json({ error: 'La ville est requise.' }, { status: 400 })
  }
  if (!category || typeof category !== 'string') {
    return NextResponse.json({ error: 'La categorie est requise.' }, { status: 400 })
  }

  const year = new Date(date).getFullYear()
  const baseSlug = makeSlug(name as string, city as string, year)

  // Ensure slug uniqueness
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await supabase
      .from('races')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  // Calculate total_distance
  const swimDist = toNumberOrNull(body.swim_distance)
  const bikeDist = toNumberOrNull(body.bike_distance)
  const runDist = toNumberOrNull(body.run_distance)
  const totalDistance =
    swimDist != null || bikeDist != null || runDist != null
      ? (swimDist ?? 0) + (bikeDist ?? 0) + (runDist ?? 0)
      : null

  const cityStr = (city as string).trim()
  const countryStr = body.country ? String(body.country).trim() || 'France' : 'France'

  const insertData = {
    name: (name as string).trim(),
    date: date as string,
    city: cityStr,
    department: body.department ? String(body.department).trim() || null : null,
    region: body.region ? String(body.region).trim() || null : null,
    country: countryStr,
    category: category as string,
    discipline: body.discipline ? String(body.discipline).trim() || 'triathlon' : 'triathlon',
    swim_distance: swimDist,
    bike_distance: bikeDist,
    run_distance: runDist,
    total_distance: totalDistance,
    total_elevation: toNumberOrNull(body.total_elevation),
    bike_elevation: toNumberOrNull(body.bike_elevation),
    run_elevation: toNumberOrNull(body.run_elevation),
    price_euros: toNumberOrNull(body.price_euros),
    max_participants: toNumberOrNull(body.max_participants),
    time_limit_hours: toNumberOrNull(body.time_limit_hours),
    description: body.description ? String(body.description).trim() || null : null,
    tagline: body.tagline ? String(body.tagline).trim() || null : null,
    website_url: body.website_url ? String(body.website_url).trim() || null : null,
    finishers_url: body.finishers_url ? String(body.finishers_url).trim() || null : null,
    image_url: body.image_url ? String(body.image_url).trim() || null : null,
    image_gradient: body.image_gradient ? String(body.image_gradient).trim() || null : null,
    tags: body.tags && typeof body.tags === 'string'
      ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : Array.isArray(body.tags) ? body.tags : null,
    latitude: toNumberOrNull(body.latitude),
    longitude: toNumberOrNull(body.longitude),
    avg_temp_high_celsius: toNumberOrNull(body.avg_temp_high_celsius),
    avg_temp_low_celsius: toNumberOrNull(body.avg_temp_low_celsius),
    avg_water_temp_celsius: toNumberOrNull(body.avg_water_temp_celsius),
    avg_wind_kmh: toNumberOrNull(body.avg_wind_kmh),
    record_men: body.record_men ? String(body.record_men).trim() || null : null,
    record_women: body.record_women ? String(body.record_women).trim() || null : null,
    finishers_count: toNumberOrNull(body.finishers_count),
    swim_type: body.swim_type ? String(body.swim_type).trim() || null : null,
    bike_type: body.bike_type ? String(body.bike_type).trim() || null : null,
    is_wetsuit_allowed: body.is_wetsuit_allowed === true ? true : body.is_wetsuit_allowed === false ? false : null,
    is_draft_legal: body.is_draft_legal === true ? true : body.is_draft_legal === false ? false : null,
    registration_status: body.registration_status ? String(body.registration_status) || null : null,
    label: body.label ? String(body.label).trim() || null : null,
    organizer_name: body.organizer_name ? String(body.organizer_name).trim() || null : null,
    registration_deadline: body.registration_deadline ? String(body.registration_deadline).trim() || null : null,
    qualification_for: body.qualification_for ? String(body.qualification_for).trim() || null : null,
    swim_cutoff_minutes: toNumberOrNull(body.swim_cutoff_minutes),
    bike_cutoff_minutes: toNumberOrNull(body.bike_cutoff_minutes),
    run_cutoff_minutes: toNumberOrNull(body.run_cutoff_minutes),
    gpx_url: body.gpx_url ? String(body.gpx_url).trim() || null : null,
    swim_gpx_url: body.swim_gpx_url ? String(body.swim_gpx_url).trim() || null : null,
    bike_gpx_url: body.bike_gpx_url ? String(body.bike_gpx_url).trim() || null : null,
    run_gpx_url: body.run_gpx_url ? String(body.run_gpx_url).trim() || null : null,
    track_geojson: body.track_geojson && typeof body.track_geojson === 'object' ? body.track_geojson : null,
    elevation_profile: body.elevation_profile && typeof body.elevation_profile === 'object' ? body.elevation_profile : null,
    slug,
    location: `${cityStr}, ${countryStr}`,
    organizer_id: session.user.id,
    status: 'published',
    needs_review: false,
    sync_source: 'admin:manual',
  }

  const { data: race, error } = await supabase
    .from('races')
    .insert(insertData)
    .select('id, slug')
    .single()

  if (error) {
    console.error('[POST /api/admin/races]', error)
    return NextResponse.json(
      { error: `Erreur lors de la creation: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, race }, { status: 201 })
}
