import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { toNumberOrNull } from '@/lib/validators'
import type { ScrapedFields } from '@/lib/scrape-fields'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST /api/admin/catalog/add
// Body: { url: string, name?: string, city?: string, country?: string, format?: string }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
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

  let body: { url: string; name?: string; city?: string; country?: string; format?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const { url, name, city, country, format } = body

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return NextResponse.json({ error: 'URL manquante ou invalide.' }, { status: 400 })
  }

  // 1. Forward cookies to preserve auth session for the internal scrape call
  const cookieHeader = req.headers.get('cookie') ?? ''
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const scrapeRes = await fetch(`${baseUrl}/api/admin/scrape-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ url }),
  })

  if (!scrapeRes.ok) {
    const err = await scrapeRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err?.error ?? `Scraping echoue (${scrapeRes.status}).` },
      { status: 502 }
    )
  }

  const scraped: ScrapedFields = await scrapeRes.json()

  // 2. Resolve final field values — scraped data takes priority, fallback to body params
  const finalName = scraped.name ?? name
  const finalCity = scraped.city ?? city
  const finalCountry = scraped.country ?? country ?? 'France'
  const finalDate = scraped.date

  if (!finalName) {
    return NextResponse.json({ error: 'Nom de la course introuvable (scraping + body).' }, { status: 422 })
  }
  if (!finalCity) {
    return NextResponse.json({ error: 'Ville introuvable (scraping + body).' }, { status: 422 })
  }
  if (!finalDate) {
    return NextResponse.json({ error: 'Date introuvable (scraping).' }, { status: 422 })
  }

  // 3. Determine category: scraped > format param > null
  const finalCategory = scraped.category ?? format ?? null
  if (!finalCategory) {
    return NextResponse.json({ error: 'Categorie introuvable (scraping + format).' }, { status: 422 })
  }

  // 4. Generate unique slug
  const year = new Date(finalDate).getFullYear()
  const baseSlug = makeSlug(finalName, finalCity, year)

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

  // 5. Calculate total_distance
  const swimDist = toNumberOrNull(scraped.swim_distance)
  const bikeDist = toNumberOrNull(scraped.bike_distance)
  const runDist = toNumberOrNull(scraped.run_distance)
  const totalDistance =
    swimDist != null || bikeDist != null || runDist != null
      ? (swimDist ?? 0) + (bikeDist ?? 0) + (runDist ?? 0)
      : null

  // 6. Insert race with needs_review: true
  const { data: race, error } = await supabase
    .from('races')
    .insert({
      name: finalName.trim(),
      date: finalDate,
      city: finalCity.trim(),
      country: finalCountry.trim(),
      location: `${finalCity.trim()}, ${finalCountry.trim()}`,
      category: finalCategory,
      discipline: 'triathlon',
      slug,

      // Distances
      swim_distance: swimDist,
      bike_distance: bikeDist,
      run_distance: runDist,
      total_distance: totalDistance,

      // Elevation
      bike_elevation: toNumberOrNull(scraped.bike_elevation),
      run_elevation: toNumberOrNull(scraped.run_elevation),

      // Geo
      latitude: toNumberOrNull(scraped.latitude),
      longitude: toNumberOrNull(scraped.longitude),
      region: scraped.region ?? null,
      department: scraped.department ?? null,

      // Pricing & logistics
      price_euros: toNumberOrNull(scraped.price_euros),
      max_participants: toNumberOrNull(scraped.max_participants),
      time_limit_hours: toNumberOrNull(scraped.time_limit_hours),

      // Content
      description: scraped.description ?? null,
      tagline: scraped.tagline ?? null,
      image_url: scraped.image_url ?? null,
      tags: scraped.tags ?? null,
      organizer_name: scraped.organizer_name ?? null,

      // Links
      website_url: scraped.website_url ?? url,
      finishers_url: scraped.finishers_url ?? null,

      // Race characteristics
      swim_type: scraped.swim_type ?? null,
      bike_type: scraped.bike_type ?? null,
      is_wetsuit_allowed: scraped.is_wetsuit_allowed ?? null,
      is_draft_legal: scraped.is_draft_legal ?? null,

      // Cutoffs
      swim_cutoff_minutes: toNumberOrNull(scraped.swim_cutoff_minutes),
      bike_cutoff_minutes: toNumberOrNull(scraped.bike_cutoff_minutes),
      run_cutoff_minutes: toNumberOrNull(scraped.run_cutoff_minutes),

      // Registration
      registration_status: scraped.registration_status ?? null,
      registration_deadline: scraped.registration_deadline ?? null,

      // Records
      record_men: scraped.record_men ?? null,
      record_women: scraped.record_women ?? null,

      // Qualification
      qualification_for: scraped.qualification_for ?? null,

      // Weather
      avg_temp_high_celsius: toNumberOrNull(scraped.avg_temp_high_celsius),
      avg_temp_low_celsius: toNumberOrNull(scraped.avg_temp_low_celsius),
      avg_water_temp_celsius: toNumberOrNull(scraped.avg_water_temp_celsius),
      avg_wind_kmh: toNumberOrNull(scraped.avg_wind_kmh),

      // GPX
      gpx_url: scraped.gpx_url ?? null,
      swim_gpx_url: scraped.swim_gpx_url ?? null,
      bike_gpx_url: scraped.bike_gpx_url ?? null,
      run_gpx_url: scraped.run_gpx_url ?? null,
      track_geojson: scraped.track_geojson ?? null,
      elevation_profile: scraped.elevation_profile ?? null,

      // Status
      status: 'published',
      needs_review: true,
      sync_source: 'catalog:ironman',
      organizer_id: session.user.id,
    })
    .select('id, slug, name')
    .single()

  if (error) {
    console.error('[POST /api/admin/catalog/add]', error)
    return NextResponse.json(
      { error: `Erreur lors de la creation: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, race }, { status: 201 })
}
