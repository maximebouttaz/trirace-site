import type { ScrapedFields } from '@/lib/scrape-fields'

// ---------------------------------------------------------------------------
// Types internes — structure réelle de __NEXT_DATA__ sur finishers.com
//
// Structure : props.pageProps.event  (infos de l'événement)
//           + props.pageProps.races  (tableau des formats/éditions)
// ---------------------------------------------------------------------------

interface FinishersActivity {
  activity: string          // 'swimming' | 'cycling' | 'road' | 'running' | ...
  distance: number
  distanceUnit: string      // 'meters' | 'kilometers'
  cutoffs?: unknown
}

interface FinishersRaceFormat {
  discipline?: string       // 'triathlon' | 'running' | ...
  name?: unknown
  date?: unknown            // 'YYYY-MM-DD'
  activities?: unknown[]
  elevationGain?: unknown   // D+ total en mètres
  minPrice?: unknown
  status?: unknown          // valeurs propriétaires finishers
  registrationUrl?: unknown
  lastEditionFinisherCount?: unknown
}

interface FinishersBreadcrumbItem {
  label?: string
  type?: string             // 'country' | 'level1AdminArea' | 'level2AdminArea' | 'city' | 'event'
  code?: string             // code ISO pays (ex: 'FR')
}

interface FinishersEvent {
  name?: unknown
  slug?: unknown
  subtitle?: unknown
  longDescription?: unknown
  coordinates?: unknown     // { lat, lng }
  breadcrumb?: unknown[]
  links?: unknown           // { website, facebook, registration, ... }
  tags?: unknown[]
  bannerImage?: unknown
}

interface FinishersNextData {
  props?: {
    pageProps?: {
      event?: unknown
      races?: unknown[]
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers génériques
// ---------------------------------------------------------------------------

function toStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (!isNaN(n) && isFinite(n)) return n
  }
  return null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

// ---------------------------------------------------------------------------
// Helper : normaliser registration_status
// Finishers utilise des valeurs comme 'open', 'closed', 'full', 'sold_out',
// 'registration_closed', 'registration_open', etc.
// ---------------------------------------------------------------------------

function normalizeStatus(v: unknown): ScrapedFields['registration_status'] {
  const s = toStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower.includes('open') || lower.includes('ouvert')) return 'open'
  if (lower.includes('full') || lower.includes('sold') || lower.includes('complet')) return 'sold_out'
  if (lower.includes('close') || lower.includes('ferm') || lower.includes('end')) return 'closed'
  // 'tba' (To Be Announced) = inscriptions pas encore ouvertes → closed
  if (lower === 'tba' || lower.includes('soon') || lower.includes('bientot')) return 'closed'
  return null
}

// ---------------------------------------------------------------------------
// Helper : décoder le website_url depuis le redirect finishers
// Format : /external?url=https%3A%2F%2F...&event=slug&...
// ---------------------------------------------------------------------------

function decodeFinishersWebsite(redirect: string): string | null {
  try {
    const base = redirect.startsWith('http') ? redirect : `https://www.finishers.com${redirect}`
    const u = new URL(base)
    const urlParam = u.searchParams.get('url')
    return urlParam || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Helper : calculer la distance totale depuis un tableau activities
// ---------------------------------------------------------------------------

function calcTotalDistance(activities: unknown): number {
  if (!isArray(activities)) return 0
  let total = 0
  for (const act of activities) {
    if (!isRecord(act)) continue
    const dist = toNum(act['distance'])
    if (dist === null) continue
    const unit = toStr(act['distanceUnit']) ?? 'meters'
    total += unit === 'kilometers' ? dist * 1000 : dist
  }
  return total
}

// ---------------------------------------------------------------------------
// Helper : extraire swim/bike/run depuis activities
// ---------------------------------------------------------------------------

function extractDistancesFromActivities(activities: unknown[]): {
  swim: number | null
  bike: number | null
  run: number | null
} {
  const result = { swim: null as number | null, bike: null as number | null, run: null as number | null }

  for (const act of activities) {
    if (!isRecord(act)) continue
    const dist = toNum(act['distance'])
    if (dist === null) continue
    const unit = toStr(act['distanceUnit']) ?? 'meters'
    const meters = unit === 'kilometers' ? dist * 1000 : dist
    const type = toStr(act['activity'])

    if (type === 'swimming') result.swim = meters
    else if (type === 'cycling') result.bike = meters
    else if (type === 'road' || type === 'running' || type === 'trail') result.run = meters
  }

  return result
}

// ---------------------------------------------------------------------------
// Inférence de catégorie depuis les distances (en mètres)
// ---------------------------------------------------------------------------

function inferCategory(swimM: number, bikeM: number, runM: number): string | null {
  const total = swimM + bikeM + runM
  if (total < 15000) return 'XS'
  if (total < 35000) return 'S'
  if (total < 80000) return 'M'
  if (total < 130000) return 'L'
  if (total < 200000) return 'XL'
  return 'Ironman'
}

// ---------------------------------------------------------------------------
// Objet vide retourné en cas d'erreur
// ---------------------------------------------------------------------------

function emptyFields(url: string): ScrapedFields {
  return {
    name: null,
    date: null,
    description: null,
    image_url: null,
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    price_euros: null,
    website_url: null,
    organizer_name: null,
    swim_distance: null,
    bike_distance: null,
    run_distance: null,
    category: null,
    region: null,
    department: null,
    bike_elevation: null,
    run_elevation: null,
    max_participants: null,
    time_limit_hours: null,
    registration_url: null,
    finishers_url: url,
    tagline: null,
    source: 'finishers',
    swim_cutoff_minutes: null,
    bike_cutoff_minutes: null,
    run_cutoff_minutes: null,
    swim_type: null,
    bike_type: null,
    is_wetsuit_allowed: null,
    is_draft_legal: null,
    registration_deadline: null,
    record_men: null,
    record_women: null,
    qualification_for: null,
    tags: null,
    finishers_count: null,
    gpx_url: null,
    swim_gpx_url: null,
    bike_gpx_url: null,
    run_gpx_url: null,
    avg_water_temp_celsius: null,
    avg_temp_celsius: null,
    avg_wind_kmh: null,
    registration_status: null,
    run_laps: null,
    track_geojson: null,
    elevation_profile: null,
  }
}

// ---------------------------------------------------------------------------
// Scraper principal
// ---------------------------------------------------------------------------

export function scrapeFinishers(url: string, html: string): ScrapedFields {
  // 1. Extraire le bloc __NEXT_DATA__
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (!match) return emptyFields(url)

  let nextData: FinishersNextData
  try {
    nextData = JSON.parse(match[1]) as FinishersNextData
  } catch {
    return emptyFields(url)
  }

  const pageProps = nextData?.props?.pageProps
  if (!pageProps) return emptyFields(url)

  // 2. Extraire event + races
  const rawEvent = pageProps.event
  const rawRaces = pageProps.races

  if (!isRecord(rawEvent)) return emptyFields(url)

  const event = rawEvent as FinishersEvent

  // 3. Champs simples depuis event
  const name = toStr(event.name)
  const tagline = toStr(event.subtitle)
  const description = toStr(event.longDescription)

  // 4. Coordonnées GPS
  let latitude: number | null = null
  let longitude: number | null = null
  if (isRecord(event.coordinates)) {
    latitude = toNum(event.coordinates['lat'])
    longitude = toNum(event.coordinates['lng'])
  }

  // 5. City / country / region / department depuis breadcrumb
  let city: string | null = null
  let country: string | null = null
  let region: string | null = null
  let department: string | null = null

  if (isArray(event.breadcrumb)) {
    for (const item of event.breadcrumb) {
      if (!isRecord(item)) continue
      const crumb = item as FinishersBreadcrumbItem
      const label = crumb.label?.trim() || null
      if (!label) continue
      switch (crumb.type) {
        case 'city': city = label; break
        case 'country': country = label; break
        case 'level1AdminArea': region = label; break
        case 'level2AdminArea': department = label; break
      }
    }
  }

  // 6. Website URL — décodage du redirect finishers
  let website_url: string | null = null
  if (isRecord(event.links)) {
    const websiteRedirect = toStr(event.links['website'])
    if (websiteRedirect) {
      website_url = decodeFinishersWebsite(websiteRedirect)
    }
  }

  // 7. Tags
  let tags: string[] | null = null
  if (isArray(event.tags)) {
    const filtered = event.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    if (filtered.length > 0) tags = filtered
  }

  // 8. Format principal — race triathlon avec la plus grande distance totale
  let swim_distance: number | null = null
  let bike_distance: number | null = null
  let run_distance: number | null = null
  let bike_elevation: number | null = null
  let price_euros: number | null = null
  let date: string | null = null
  let registration_url: string | null = null
  let registration_status: ScrapedFields['registration_status'] = null
  let finishers_count: number | null = null
  let category: string | null = null
  let swim_cutoff_minutes: number | null = null
  let bike_cutoff_minutes: number | null = null
  let run_cutoff_minutes: number | null = null

  if (isArray(rawRaces)) {
    // Filtrer les triathlons et trier par distance totale décroissante
    const triathlons = rawRaces
      .filter((r): r is Record<string, unknown> => {
        if (!isRecord(r)) return false
        const discipline = toStr(r['discipline'])
        return discipline === 'triathlon' || discipline === null // inclure si discipline absente
      })
      .sort((a, b) => calcTotalDistance(b['activities']) - calcTotalDistance(a['activities']))

    const primary = triathlons[0] as FinishersRaceFormat | undefined

    if (primary) {
      date = toStr(primary.date)
      bike_elevation = toNum(primary.elevationGain)
      price_euros = toNum(primary.minPrice)
      registration_url = toStr(primary.registrationUrl)
      registration_status = normalizeStatus(primary.status)
      finishers_count = toNum(primary.lastEditionFinisherCount)

      // Distances depuis activities
      if (isArray(primary.activities)) {
        const acts = primary.activities as FinishersActivity[]
        const distances = extractDistancesFromActivities(acts)
        swim_distance = distances.swim
        bike_distance = distances.bike
        run_distance = distances.run

        // Barrières horaires depuis activities.cutoffs si présent
        for (const act of acts) {
          if (!isRecord(act) || !isRecord(act['cutoffs'])) continue
          const cutoffs = act['cutoffs'] as Record<string, unknown>
          if (act['activity'] === 'swimming' && swim_cutoff_minutes === null)
            swim_cutoff_minutes = toNum(cutoffs['minutes']) ?? toNum(cutoffs['cutoffMinutes'])
          if (act['activity'] === 'cycling' && bike_cutoff_minutes === null)
            bike_cutoff_minutes = toNum(cutoffs['minutes']) ?? toNum(cutoffs['cutoffMinutes'])
          if ((act['activity'] === 'road' || act['activity'] === 'running') && run_cutoff_minutes === null)
            run_cutoff_minutes = toNum(cutoffs['minutes']) ?? toNum(cutoffs['cutoffMinutes'])
        }
      }

      if (swim_distance !== null && bike_distance !== null && run_distance !== null) {
        category = inferCategory(swim_distance, bike_distance, run_distance)
      }
    }
  }

  return {
    name,
    date,
    description,
    image_url: null,
    city,
    country,
    latitude,
    longitude,
    price_euros,
    website_url,
    organizer_name: null,
    swim_distance,
    bike_distance,
    run_distance,
    category,
    region,
    department,
    bike_elevation,
    run_elevation: null,
    max_participants: null,
    time_limit_hours: null,
    registration_url,
    finishers_url: url,
    tagline,
    source: 'finishers',
    swim_cutoff_minutes,
    bike_cutoff_minutes,
    run_cutoff_minutes,
    swim_type: null,
    bike_type: null,
    is_wetsuit_allowed: null,
    is_draft_legal: null,
    registration_deadline: null,
    record_men: null,
    record_women: null,
    qualification_for: null,
    tags,
    finishers_count,
    gpx_url: null,
    swim_gpx_url: null,
    bike_gpx_url: null,
    run_gpx_url: null,
    avg_water_temp_celsius: null,
    avg_temp_celsius: null,
    avg_wind_kmh: null,
    registration_status,
    run_laps: null,
    track_geojson: null,
    elevation_profile: null,
  }
}
