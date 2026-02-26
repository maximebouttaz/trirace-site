import type { ScrapedFields } from '@/lib/scrape-fields'

// ---------------------------------------------------------------------------
// Types internes — structure __NEXT_DATA__ de MilesRepublic
// ---------------------------------------------------------------------------

interface MRProduct {
  price?: unknown
  openingDate?: unknown
  closingDate?: unknown
}

interface MRRace {
  name?: unknown
  startDate?: unknown
  swimDistance?: unknown   // en mètres
  bikeDistance?: unknown   // en kilomètres
  runDistance?: unknown    // en kilomètres
  runPositiveElevation?: unknown  // en mètres D+
  bikePositiveElevation?: unknown // en mètres D+
  products?: unknown
  // Barrières horaires (en minutes)
  swimCutoffMinutes?: unknown
  bikeCutoffMinutes?: unknown
  runCutoffMinutes?: unknown
  // GPX de la race individuelle
  gpxUrl?: unknown
  swimGpxUrl?: unknown
  bikeGpxUrl?: unknown
  runGpxUrl?: unknown
}

interface MRLocalizedContent {
  usefulInformation?: unknown
  schedule?: unknown
  review?: unknown
}

interface MREdition {
  startDate?: unknown
  races?: unknown
  localizedContents?: unknown
  mainRace?: unknown
  // Nouveaux champs édition
  registrationDeadline?: unknown
  finishersCount?: unknown
  finishers_count?: unknown
  gpxUrl?: unknown
  swimGpxUrl?: unknown
  bikeGpxUrl?: unknown
  runGpxUrl?: unknown
  recordMen?: unknown
  record_men?: unknown
  recordWomen?: unknown
  record_women?: unknown
}

interface MREvent {
  id?: unknown
  name?: unknown
  city?: unknown
  latitude?: unknown
  longitude?: unknown
  coverImage?: unknown
  images?: unknown
  localizedContents?: unknown
  currentEdition?: unknown
  // Nouveaux champs event
  swimType?: unknown
  swimLocation?: unknown
  bikeType?: unknown
  isWetsuitAllowed?: unknown
  isDraftLegal?: unknown
  tags?: unknown
  qualificationFor?: unknown
  qualification?: unknown
  // Barrières horaires fallback au niveau event
  swimCutoffMinutes?: unknown
  bikeCutoffMinutes?: unknown
  runCutoffMinutes?: unknown
  cutoffs?: unknown
}

interface MRPageProps {
  event?: unknown
  previousEditionAttendeesCount?: unknown
  attendeesFromEditionIdCount?: unknown
}

interface MRNextData {
  props?: {
    pageProps?: MRPageProps
  }
}

// ---------------------------------------------------------------------------
// Helpers
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
// Mapping swim_type
// ---------------------------------------------------------------------------

type SwimType = 'lac' | 'mer' | 'rivière' | 'piscine' | 'étang' | 'open water'

function mapSwimType(raw: unknown): SwimType | null {
  const v = toStr(raw)
  if (v === null) return null
  const lower = v.toLowerCase()
  if (/\blac\b/.test(lower) || lower === 'lake') return 'lac'
  if (/\b(mer|sea|ocean|oc[eé]an)\b/.test(lower)) return 'mer'
  if (/\b(rivi[eè]re|river)\b/.test(lower)) return 'rivière'
  if (/\b(piscine|pool)\b/.test(lower)) return 'piscine'
  if (/\b[eé]tang\b/.test(lower)) return 'étang'
  if (/open\s*water/.test(lower)) return 'open water'
  return null
}

// ---------------------------------------------------------------------------
// Mapping bike_type
// ---------------------------------------------------------------------------

type BikeType = 'route' | 'gravel' | 'mixte' | 'vtt'

function mapBikeType(raw: unknown): BikeType | null {
  const v = toStr(raw)
  if (v === null) return null
  const lower = v.toLowerCase()
  if (/\b(route|road)\b/.test(lower)) return 'route'
  if (/\bgravel\b/.test(lower)) return 'gravel'
  if (/\b(vtt|mountain)\b/.test(lower)) return 'vtt'
  if (/\b(mixte|mixed)\b/.test(lower)) return 'mixte'
  return null
}

// ---------------------------------------------------------------------------
// Normalisation d'une date vers YYYY-MM-DD
// ---------------------------------------------------------------------------

function toDateString(raw: unknown): string | null {
  const s = toStr(raw)
  if (s === null) return null
  // Déjà au bon format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Tente une conversion via Date
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {
    // ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Inférence de catégorie depuis les distances (en mètres)
// Logique identique à finishers.ts
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
// Nettoyage HTML basique (strip balises, normalise espaces)
// ---------------------------------------------------------------------------

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Extraction description depuis localizedContents
// ---------------------------------------------------------------------------

function parseDescription(event: MREvent): string | null {
  // 1. Priorité : currentEdition.localizedContents[].usefulInformation
  const ce = event.currentEdition
  if (isRecord(ce)) {
    const edition = ce as MREdition
    const lc = edition.localizedContents
    if (isArray(lc)) {
      for (const item of lc) {
        if (!isRecord(item)) continue
        const content = item as MRLocalizedContent
        const text = toStr(content.usefulInformation) ?? toStr(content.schedule)
        if (text && text.length > 30) {
          const clean = stripHtml(text)
          if (clean.length > 30) return clean.slice(0, 1000)
        }
      }
    }
  }

  // 2. Fallback : event.localizedContents[].review
  const lc = event.localizedContents
  if (isArray(lc)) {
    for (const item of lc) {
      if (!isRecord(item)) continue
      const content = item as MRLocalizedContent
      const text = toStr(content.review)
      if (text && text.length > 30) {
        const clean = stripHtml(text)
        if (clean.length > 30) return clean.slice(0, 1000)
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Extraction du prix minimum depuis les races de l'édition
// ---------------------------------------------------------------------------

function extractMinPrice(races: unknown[]): number | null {
  const prices: number[] = []
  for (const r of races) {
    if (!isRecord(r)) continue
    const race = r as MRRace
    const products = race.products
    if (!isArray(products)) continue
    for (const p of products) {
      if (!isRecord(p)) continue
      const product = p as MRProduct
      const price = toNum(product.price)
      if (price !== null && price > 0) prices.push(price)
    }
  }
  if (prices.length === 0) return null
  return Math.round(Math.min(...prices))
}

// ---------------------------------------------------------------------------
// Extraction des distances du format principal
// MilesRepublic : swimDistance (m), bikeDistance (km), runDistance (km)
// On convertit tout en mètres pour l'interface ScrapedFields
// ---------------------------------------------------------------------------

const EXCLUDED_RACE_NAMES = /relay|relais|kids|enfant|junior|team|equipe/i

function pickPrimaryRace(races: unknown[]): MRRace | null {
  const valid: Array<{ race: MRRace; total: number }> = []

  for (const r of races) {
    if (!isRecord(r)) continue
    const race = r as MRRace
    const name = toStr(race.name) ?? ''
    if (EXCLUDED_RACE_NAMES.test(name)) continue

    // bikeDistance est en km sur MilesRepublic → convertit en m pour comparaison
    const swim = toNum(race.swimDistance) ?? 0
    const bikeKm = toNum(race.bikeDistance) ?? 0
    const runKm = toNum(race.runDistance) ?? 0
    const total = swim + bikeKm * 1000 + runKm * 1000

    valid.push({ race, total })
  }

  if (valid.length === 0) return null

  // Format avec la distance totale la plus élevée (ex: Full > 70.3 > M)
  valid.sort((a, b) => b.total - a.total)
  return valid[0].race
}

// ---------------------------------------------------------------------------
// Extraction depuis JSON-LD (fallback si __NEXT_DATA__ absent)
// ---------------------------------------------------------------------------

interface JsonLdLocation {
  name?: unknown
  address?: unknown
  geo?: unknown
}

interface JsonLdAddress {
  addressLocality?: unknown
  addressRegion?: unknown
  addressCountry?: unknown
}

interface JsonLdGeo {
  latitude?: unknown
  longitude?: unknown
}

interface JsonLdEvent {
  '@type'?: unknown
  name?: unknown
  startDate?: unknown
  description?: unknown
  image?: unknown
  location?: unknown
  offers?: unknown
  organizer?: unknown
}

// ---------------------------------------------------------------------------
// Helper : codes ISO pays → noms complets
// ---------------------------------------------------------------------------

function mapCountryCode(code: string | null): string | null {
  if (!code) return null
  if (code.length > 3) return code // déjà un nom complet
  const MAP: Record<string, string> = {
    FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg',
    ES: 'Espagne', IT: 'Italie', DE: 'Allemagne', GB: 'Royaume-Uni',
    PT: 'Portugal', NL: 'Pays-Bas', AT: 'Autriche', DK: 'Danemark',
    SE: 'Suède', NO: 'Norvège', FI: 'Finlande', PL: 'Pologne',
  }
  return MAP[code.toUpperCase()] ?? code
}

// ---------------------------------------------------------------------------
// Helper : parser un SportsEvent JSON-LD dans partial (réutilisable)
// ---------------------------------------------------------------------------

function parseSportsEvent(ev: JsonLdEvent, partial: Partial<ScrapedFields>): void {
  if (partial.date === undefined && ev.startDate) {
    const raw = toStr(ev.startDate)
    if (raw) {
      try { partial.date = new Date(raw).toISOString().slice(0, 10) } catch { partial.date = raw.slice(0, 10) }
    }
  }
  if (partial.image_url === undefined) partial.image_url = toStr(ev.image)

  if (isRecord(ev.location)) {
    const loc = ev.location as JsonLdLocation
    if (isRecord(loc.address)) {
      const addr = loc.address as JsonLdAddress
      if (partial.city === undefined) partial.city = toStr(addr.addressLocality)
      if (partial.region === undefined) partial.region = toStr(addr.addressRegion)
      if (partial.country === undefined) partial.country = mapCountryCode(toStr(addr.addressCountry))
    }
    if (isRecord(loc.geo)) {
      const geo = loc.geo as JsonLdGeo
      if (partial.latitude === undefined) {
        const lat = toNum(geo.latitude)
        const lng = toNum(geo.longitude)
        if (lat !== null) partial.latitude = lat
        if (lng !== null) partial.longitude = lng
      }
    }
  }

  if (partial.price_euros === undefined && isRecord(ev.offers)) {
    const offers = ev.offers as Record<string, unknown>
    const price = toNum(offers['price'])
    if (price !== null && price > 0) partial.price_euros = Math.round(price)
  }

  if (partial.organizer_name === undefined && isRecord(ev.organizer)) {
    const org = ev.organizer as Record<string, unknown>
    partial.organizer_name = toStr(org['name'])
  }
}

function extractFromJsonLd(html: string): Partial<ScrapedFields> {
  const partial: Partial<ScrapedFields> = {}
  const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = jsonLdPattern.exec(html)) !== null) {
    let data: unknown
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }

    const items: unknown[] = isArray(data) ? data : [data]
    for (const item of items) {
      if (!isRecord(item)) continue
      const raw = item as Record<string, unknown>
      const type = toStr(raw['@type'])

      // MilesRepublic (App Router) enveloppe les SportsEvent dans un ItemList
      if (type === 'ItemList') {
        // Nom de l'événement au niveau racine (ex: "Light On Tri Woippy")
        if (partial.name === undefined) partial.name = toStr(raw['name'])

        // Parcourir les items pour extraire date et localisation
        const elements = raw['itemListElement']
        if (isArray(elements)) {
          for (const el of elements) {
            if (!isRecord(el)) continue
            const innerItem = (el as Record<string, unknown>)['item']
            if (!isRecord(innerItem)) continue
            const ev = innerItem as JsonLdEvent
            if (ev['@type'] !== 'SportsEvent' && ev['@type'] !== 'Event') continue
            parseSportsEvent(ev, partial)
            break // On s'arrête au premier SportsEvent pour date et localisation
          }
        }
        continue
      }

      // SportsEvent/Event standard (autres sources)
      const ev = item as JsonLdEvent
      if (type !== 'SportsEvent' && type !== 'Event') continue

      if (partial.name === undefined) partial.name = toStr(ev.name)
      if (partial.description === undefined) {
        const desc = toStr(ev.description)
        if (desc && desc.length > 30) partial.description = desc.slice(0, 1000)
      }
      parseSportsEvent(ev, partial)
    }
  }

  return partial
}

// ---------------------------------------------------------------------------
// Extraction des distances depuis le HTML (patterns textuels)
// Utilisé quand __NEXT_DATA__ ne contient pas les distances
// ---------------------------------------------------------------------------

interface DistanceHint {
  swim: number | null
  bike: number | null
  run: number | null
}

function extractDistancesFromHtml(html: string): DistanceHint {
  // Pattern : "1500m natation", "40 km vélo", "10km course"
  const swimPattern = /(\d[\d.,]*)\s*m\b[^)]*?(?:nat|swim|nage)/i
  const bikePattern = /(\d[\d.,]*)\s*km[^)]*?(?:v[eé]lo|bike|cycl)/i
  const runPattern = /(\d[\d.,]*)\s*km[^)]*?(?:course|run|pied|cap)/i

  // data-* attributes
  const dataSwimPattern = /data-swim[^=]*=["']?(\d+)/i
  const dataBikePattern = /data-bike[^=]*=["']?(\d+)/i
  const dataRunPattern = /data-run[^=]*=["']?(\d+)/i

  function tryMatch(pattern: RegExp): number | null {
    const m = html.match(pattern)
    if (!m) return null
    const v = parseFloat(m[1].replace(',', '.'))
    return isNaN(v) ? null : v
  }

  // Préférer data-* (valeurs brutes) puis patterns textuels
  let swim = tryMatch(dataSwimPattern)
  let bike = tryMatch(dataBikePattern)
  let run = tryMatch(dataRunPattern)

  if (swim === null) swim = tryMatch(swimPattern)
  if (bike === null) {
    const b = tryMatch(bikePattern)
    // bikePattern retourne des km → convertir en mètres
    bike = b !== null ? b * 1000 : null
  }
  if (run === null) {
    const r = tryMatch(runPattern)
    // runPattern retourne des km → convertir en mètres
    run = r !== null ? r * 1000 : null
  }

  return { swim, bike, run }
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
    website_url: url,
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
    finishers_url: null,
    tagline: null,
    source: 'milesrepublic',
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
    track_geojson: null,
    elevation_profile: null,
  }
}

// ---------------------------------------------------------------------------
// Scraper principal
// ---------------------------------------------------------------------------

export function scrapeMilesRepublic(url: string, html: string): ScrapedFields {
  const result = emptyFields(url)

  // -------------------------------------------------------------------------
  // 1. Extraire __NEXT_DATA__ (source principale)
  // -------------------------------------------------------------------------
  const nextDataMatch = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  )

  if (nextDataMatch) {
    let nextData: MRNextData
    try {
      nextData = JSON.parse(nextDataMatch[1]) as MRNextData
    } catch {
      // __NEXT_DATA__ corrompu — on tombe sur les fallbacks
      nextData = {}
    }

    const pageProps = nextData?.props?.pageProps
    if (isRecord(pageProps)) {
      const props = pageProps as MRPageProps
      const rawEvent = props.event

      if (isRecord(rawEvent)) {
        const event = rawEvent as MREvent

        // Nom de l'événement (niveau event global, pas race)
        result.name = toStr(event.name)

        // Ville
        result.city = toStr(event.city)

        // Coordonnées géographiques
        const lat = toNum(event.latitude)
        const lng = toNum(event.longitude)
        if (lat !== null) result.latitude = lat
        if (lng !== null) result.longitude = lng

        // Image : coverImage en priorité, sinon première image du tableau
        const cover = event.coverImage
        if (typeof cover === 'string' && cover.startsWith('http')) {
          result.image_url = cover
        } else {
          const imgs = event.images
          if (isArray(imgs) && imgs.length > 0) {
            const first = imgs[0]
            if (typeof first === 'string' && first.startsWith('http')) {
              result.image_url = first
            }
          }
        }

        // Description depuis localizedContents
        result.description = parseDescription(event)

        // swim_type
        result.swim_type = mapSwimType(event.swimType) ?? mapSwimType(event.swimLocation)

        // bike_type
        result.bike_type = mapBikeType(event.bikeType)

        // is_wetsuit_allowed
        if (typeof event.isWetsuitAllowed === 'boolean') {
          result.is_wetsuit_allowed = event.isWetsuitAllowed
        }

        // is_draft_legal
        if (typeof event.isDraftLegal === 'boolean') {
          result.is_draft_legal = event.isDraftLegal
        }

        // tags
        if (isArray(event.tags)) {
          const filtered = event.tags
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .slice(0, 10)
          if (filtered.length > 0) result.tags = filtered
        }

        // qualification_for
        result.qualification_for =
          toStr(event.qualificationFor) ?? toStr(event.qualification)

        // Barrières horaires fallback niveau event (hors races[])
        const eventSwimCutoff = toNum(event.swimCutoffMinutes)
        const eventBikeCutoff = toNum(event.bikeCutoffMinutes)
        const eventRunCutoff = toNum(event.runCutoffMinutes)

        // Fallback depuis event.cutoffs.*
        let cutoffSwimFallback: number | null = null
        let cutoffBikeFallback: number | null = null
        let cutoffRunFallback: number | null = null
        if (isRecord(event.cutoffs)) {
          const c = event.cutoffs as Record<string, unknown>
          cutoffSwimFallback = toNum(c['swim'])
          cutoffBikeFallback = toNum(c['bike'])
          cutoffRunFallback = toNum(c['run'])
        }

        // Données de l'édition courante
        const ce = event.currentEdition
        if (isRecord(ce)) {
          const edition = ce as MREdition

          // Date de l'édition
          result.date = toStr(edition.startDate)

          // registration_deadline
          result.registration_deadline = toDateString(edition.registrationDeadline)

          // finishers_count
          result.finishers_count =
            toNum(edition.finishersCount) ?? toNum(edition.finishers_count)

          // gpx_url — priorité édition, fallback race principale plus bas
          result.gpx_url = toStr(edition.gpxUrl)

          // GPX par discipline au niveau édition
          result.swim_gpx_url = toStr(edition.swimGpxUrl)
          result.bike_gpx_url = toStr(edition.bikeGpxUrl)
          result.run_gpx_url  = toStr(edition.runGpxUrl)

          // record_men / record_women
          result.record_men =
            toStr(edition.recordMen) ?? toStr(edition.record_men)
          result.record_women =
            toStr(edition.recordWomen) ?? toStr(edition.record_women)

          // Races de l'édition
          const races = edition.races
          if (isArray(races)) {
            // Prix minimum sur tous les formats
            result.price_euros = extractMinPrice(races)

            // Format principal pour les distances
            const primary = pickPrimaryRace(races)
            if (primary !== null) {
              // swimDistance : en mètres
              result.swim_distance = toNum(primary.swimDistance)

              // bikeDistance : en kilomètres → convertir en mètres
              const bikeKm = toNum(primary.bikeDistance)
              result.bike_distance = bikeKm !== null ? Math.round(bikeKm * 1000) : null

              // runDistance : en kilomètres → convertir en mètres
              const runKm = toNum(primary.runDistance)
              result.run_distance = runKm !== null ? Math.round(runKm * 1000) : null

              // Dénivelés
              const bikeElev = toNum(primary.bikePositiveElevation)
              const runElev = toNum(primary.runPositiveElevation)
              if (bikeElev !== null && bikeElev > 0 && bikeElev < 6000) {
                result.bike_elevation = Math.round(bikeElev)
              }
              if (runElev !== null && runElev > 0 && runElev < 3000) {
                result.run_elevation = Math.round(runElev)
              }

              // Catégorie inférée depuis les distances
              const s = result.swim_distance ?? 0
              const b = result.bike_distance ?? 0
              const r = result.run_distance ?? 0
              if (s > 0 || b > 0 || r > 0) {
                result.category = inferCategory(s, b, r)
              }

              // Barrières horaires depuis la race principale
              const raceSwimCutoff = toNum(primary.swimCutoffMinutes)
              const raceBikeCutoff = toNum(primary.bikeCutoffMinutes)
              const raceRunCutoff = toNum(primary.runCutoffMinutes)

              result.swim_cutoff_minutes =
                raceSwimCutoff ?? eventSwimCutoff ?? cutoffSwimFallback
              result.bike_cutoff_minutes =
                raceBikeCutoff ?? eventBikeCutoff ?? cutoffBikeFallback
              result.run_cutoff_minutes =
                raceRunCutoff ?? eventRunCutoff ?? cutoffRunFallback

              // gpx_url depuis la race principale si pas encore renseigné
              if (result.gpx_url === null) {
                result.gpx_url = toStr(primary.gpxUrl)
              }

              // GPX par discipline depuis la race principale (fallback)
              if (result.swim_gpx_url === null) result.swim_gpx_url = toStr(primary.swimGpxUrl)
              if (result.bike_gpx_url === null) result.bike_gpx_url = toStr(primary.bikeGpxUrl)
              if (result.run_gpx_url  === null) result.run_gpx_url  = toStr(primary.runGpxUrl)
            } else {
              // Pas de race principale : utiliser les fallbacks cutoff event-level
              result.swim_cutoff_minutes = eventSwimCutoff ?? cutoffSwimFallback
              result.bike_cutoff_minutes = eventBikeCutoff ?? cutoffBikeFallback
              result.run_cutoff_minutes = eventRunCutoff ?? cutoffRunFallback
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Fallback JSON-LD pour les champs encore manquants
  // -------------------------------------------------------------------------
  const jsonLd = extractFromJsonLd(html)

  if (result.name === null) result.name = jsonLd.name ?? null
  if (result.date === null) result.date = jsonLd.date ?? null
  if (result.description === null) result.description = jsonLd.description ?? null
  if (result.image_url === null) result.image_url = jsonLd.image_url ?? null
  if (result.city === null) result.city = jsonLd.city ?? null
  if (result.region === null) result.region = jsonLd.region ?? null
  if (result.country === null) result.country = jsonLd.country ?? null
  if (result.latitude === null && jsonLd.latitude !== undefined) {
    result.latitude = jsonLd.latitude ?? null
  }
  if (result.longitude === null && jsonLd.longitude !== undefined) {
    result.longitude = jsonLd.longitude ?? null
  }
  if (result.price_euros === null) result.price_euros = jsonLd.price_euros ?? null
  if (result.organizer_name === null) result.organizer_name = jsonLd.organizer_name ?? null

  // -------------------------------------------------------------------------
  // 3. Fallback distances HTML si toujours manquantes
  // -------------------------------------------------------------------------
  if (
    result.swim_distance === null &&
    result.bike_distance === null &&
    result.run_distance === null
  ) {
    const hints = extractDistancesFromHtml(html)
    if (hints.swim !== null) result.swim_distance = Math.round(hints.swim)
    if (hints.bike !== null) result.bike_distance = Math.round(hints.bike)
    if (hints.run !== null) result.run_distance = Math.round(hints.run)

    // Recalcul catégorie si on a récupéré des distances via HTML
    if (
      result.category === null &&
      (result.swim_distance !== null || result.bike_distance !== null || result.run_distance !== null)
    ) {
      result.category = inferCategory(
        result.swim_distance ?? 0,
        result.bike_distance ?? 0,
        result.run_distance ?? 0
      )
    }
  }

  // -------------------------------------------------------------------------
  // 4. Fallback og:image si image encore manquante
  // -------------------------------------------------------------------------
  if (result.image_url === null) {
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    if (ogMatch && ogMatch[1].startsWith('http')) {
      result.image_url = ogMatch[1]
    }
  }

  // -------------------------------------------------------------------------
  // 5. Fallbacks regex HTML pour les champs booléens et GPX
  // -------------------------------------------------------------------------

  // is_wetsuit_allowed — cherche des mentions textuelles dans le HTML
  if (result.is_wetsuit_allowed === null) {
    if (/combinaison\s+(autoris[eé]e|obligatoire)|wetsuit\s+(allowed|mandatory)/i.test(html)) {
      result.is_wetsuit_allowed = true
    } else if (/combinaison\s+interdite|no\s+wetsuit|wetsuit\s+(not\s+allowed|prohibited)/i.test(html)) {
      result.is_wetsuit_allowed = false
    }
  }

  // is_draft_legal — cherche des mentions textuelles dans le HTML
  if (result.is_draft_legal === null) {
    if (/\bdraft[- ]?legal\b|aspiration\s+autoris[eé]e/i.test(html)) {
      result.is_draft_legal = true
    } else if (/\bno[- ]?draft\b|aspiration\s+interdite/i.test(html)) {
      result.is_draft_legal = false
    }
  }

  // gpx_url — cherche un lien href vers un fichier .gpx
  if (result.gpx_url === null) {
    const gpxMatch = html.match(/href="(https?:[^"]*\.gpx[^"]*)"/i)
    if (gpxMatch) {
      result.gpx_url = gpxMatch[1]
    }
  }

  return result
}
