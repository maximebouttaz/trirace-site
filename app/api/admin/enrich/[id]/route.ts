import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type EnrichSource = 'milesrepublic' | 'finishers' | 'website' | 'auto'

type RaceEnrichRow = {
  id: number
  slug: string
  name: string | null
  city: string | null
  country: string
  image_url: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  sync_source: string | null
  finishers_url: string | null
  website_url: string | null
}

async function fetchAndParse(url: string): Promise<{
  image_url: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
}> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TriRace/1.0; +https://trirace.fr)' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return { image_url: null, description: null, latitude: null, longitude: null }

  const html = await res.text()

  // Extract og:image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  const image_url = ogImageMatch?.[1] ?? null

  // Extract og:description
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
  let description = ogDescMatch?.[1] ?? null

  // Fallback to meta[name=description]
  if (!description) {
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
    description = metaDescMatch?.[1] ?? null
  }

  if (description && description.length > 500) {
    description = description.slice(0, 500)
  }

  // Extract lat/lon from JSON-LD
  let latitude: number | null = null
  let longitude: number | null = null

  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(match[1])
      const loc = json?.location?.geo ?? json?.geo
      if (loc?.latitude && loc?.longitude) {
        latitude = Number(loc.latitude)
        longitude = Number(loc.longitude)
        break
      }
    } catch {
      // skip invalid JSON-LD
    }
  }

  // Fallback: try __NEXT_DATA__
  if (!latitude) {
    const nextDataMatch = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const props = nextData?.props?.pageProps
        const lat = props?.event?.latitude ?? props?.race?.latitude ?? props?.latitude
        const lon = props?.event?.longitude ?? props?.race?.longitude ?? props?.longitude
        if (lat && lon) {
          latitude = Number(lat)
          longitude = Number(lon)
        }
      } catch {
        // skip
      }
    }
  }

  return { image_url, description, latitude, longitude }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const source: EnrichSource = body?.source ?? 'auto'

  const { data: race, error: fetchError } = await supabase
    .from('races')
    .select('id, slug, name, city, country, image_url, description, latitude, longitude, sync_source, finishers_url, website_url')
    .eq('id', raceId)
    .single<RaceEnrichRow>()

  if (fetchError || !race) {
    return NextResponse.json({ error: 'Course introuvable.' }, { status: 404 })
  }

  let targetUrl: string | null = null

  if (source === 'finishers') {
    targetUrl = race.finishers_url
  } else if (source === 'milesrepublic') {
    targetUrl = race.website_url
  } else if (source === 'website') {
    targetUrl = race.website_url
  } else if (source === 'auto') {
    if (race.sync_source?.startsWith('milesrepublic:')) {
      targetUrl = race.website_url
    } else if (race.sync_source?.startsWith('finishers:') || race.finishers_url) {
      targetUrl = race.finishers_url
    } else {
      targetUrl = race.website_url
    }
  }

  if (!targetUrl) {
    return NextResponse.json({ error: 'Source inconnue ou URL manquante.' }, { status: 422 })
  }

  const before = {
    image_url: race.image_url,
    description: race.description,
    latitude: race.latitude,
    longitude: race.longitude,
  }

  const extracted = await fetchAndParse(targetUrl)

  const after = {
    image_url: extracted.image_url ?? race.image_url,
    description: extracted.description ?? race.description,
    latitude: extracted.latitude ?? race.latitude,
    longitude: extracted.longitude ?? race.longitude,
  }

  const updated_fields: string[] = []
  if (after.image_url !== before.image_url) updated_fields.push('image_url')
  if (after.description !== before.description) updated_fields.push('description')
  if (after.latitude !== before.latitude) updated_fields.push('latitude')
  if (after.longitude !== before.longitude) updated_fields.push('longitude')

  return NextResponse.json({ before, after, updated_fields })
}
