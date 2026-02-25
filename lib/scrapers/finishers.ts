import type { ScrapedFields } from '@/lib/scrape-fields'

// ---------------------------------------------------------------------------
// Types internes — structure attendue dans __NEXT_DATA__
// ---------------------------------------------------------------------------

interface FinishersFormat {
  name?: unknown
  swimDistance?: unknown
  bikeDistance?: unknown
  runDistance?: unknown
  bikeElevation?: unknown
  runElevation?: unknown
  price?: unknown
  maxParticipants?: unknown
  timeLimitHours?: unknown
  registrationUrl?: unknown
  // Barrières horaires
  swimCutoffMinutes?: unknown
  bikeCutoffMinutes?: unknown
  runCutoffMinutes?: unknown
  // Parcours
  gpxUrl?: unknown
  gpx_url?: unknown
  swimGpxUrl?: unknown
  swim_gpx_url?: unknown
  bikeGpxUrl?: unknown
  bike_gpx_url?: unknown
  runGpxUrl?: unknown
  run_gpx_url?: unknown
}

interface FinishersOrganizer {
  name?: unknown
}

interface FinishersCutoffs {
  swim?: unknown
  bike?: unknown
  run?: unknown
}

interface FinishersRace {
  name?: unknown
  startDate?: unknown
  city?: unknown
  country?: unknown
  region?: unknown
  department?: unknown
  latitude?: unknown
  longitude?: unknown
  description?: unknown
  tagline?: unknown
  image?: unknown
  website?: unknown
  slug?: unknown
  organizer?: unknown
  formats?: unknown
  // Barrières horaires niveau race
  cutoffs?: unknown
  swimCutoffMinutes?: unknown
  bikeCutoffMinutes?: unknown
  runCutoffMinutes?: unknown
  // Plan d'eau / parcours
  swimType?: unknown
  swim_type?: unknown
  bikeType?: unknown
  bike_type?: unknown
  // Combinaison / drafting
  isWetsuitAllowed?: unknown
  wetsuit?: unknown
  isDraftLegal?: unknown
  draft?: unknown
  // Inscription
  registrationDeadline?: unknown
  inscriptionDeadline?: unknown
  // Records
  recordMen?: unknown
  record_men?: unknown
  recordWomen?: unknown
  record_women?: unknown
  // Qualification
  qualificationFor?: unknown
  qualification?: unknown
  // Tags
  tags?: unknown
  // Finishers
  finishersCount?: unknown
  finishers?: unknown
  // GPX
  gpxUrl?: unknown
  gpx_url?: unknown
  swimGpxUrl?: unknown
  swim_gpx_url?: unknown
  bikeGpxUrl?: unknown
  bike_gpx_url?: unknown
  runGpxUrl?: unknown
  run_gpx_url?: unknown
}

interface FinishersNextData {
  props?: {
    pageProps?: {
      race?: unknown
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

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1' || v === 'true' || v === 'yes' || v === 'oui') return true
  if (v === 0 || v === '0' || v === 'false' || v === 'no' || v === 'non') return false
  return null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

// ---------------------------------------------------------------------------
// Helper : convertir une valeur date vers YYYY-MM-DD
// ---------------------------------------------------------------------------

function toDateYMD(v: unknown): string | null {
  const s = toStr(v)
  if (!s) return null
  // Déjà en YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Tenter une conversion générique
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {
    // ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Helper : normaliser swim_type
// ---------------------------------------------------------------------------

type SwimType = 'lac' | 'mer' | 'rivière' | 'piscine' | 'étang' | 'open water'

function normalizeSwimType(v: unknown): SwimType | null {
  const s = toStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  if (/\bla[ck]e?\b|lac\b/.test(lower)) return 'lac'
  if (/\b(mer|sea|ocean|oc[eé]an)\b/.test(lower)) return 'mer'
  if (/\b(rivi[eè]re|river|fleuve)\b/.test(lower)) return 'rivière'
  if (/\b(piscine|pool)\b/.test(lower)) return 'piscine'
  if (/\b([eé]tang|pond)\b/.test(lower)) return 'étang'
  if (/open.?water/.test(lower)) return 'open water'
  return null
}

// ---------------------------------------------------------------------------
// Helper : normaliser bike_type
// ---------------------------------------------------------------------------

type BikeType = 'route' | 'gravel' | 'mixte' | 'vtt'

function normalizeBikeType(v: unknown): BikeType | null {
  const s = toStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  if (/\b(route|road)\b/.test(lower)) return 'route'
  if (/\bgravel\b/.test(lower)) return 'gravel'
  if (/\b(vtt|mtb|mountain)\b/.test(lower)) return 'vtt'
  if (/\b(mixte|mixed)\b/.test(lower)) return 'mixte'
  return null
}

// ---------------------------------------------------------------------------
// Fallbacks HTML — barrières horaires
// Convertit "Xh YY" ou "Xheure" → minutes
// ---------------------------------------------------------------------------

function parseCutoffToMinutes(h: string, m: string): number {
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

function extractCutoffsFromHtml(html: string): {
  swim: number | null
  bike: number | null
  run: number | null
} {
  const result: { swim: number | null; bike: number | null; run: number | null } = {
    swim: null,
    bike: null,
    run: null,
  }

  // Barrière natation
  const swimRe =
    /barri[eè]re\s+natation[^<\d]*(\d+)h(\d{0,2})|swim\s+cutoff[^<\d]*(\d+)h(\d{0,2})/i
  const swimMatch = html.match(swimRe)
  if (swimMatch) {
    const h = swimMatch[1] ?? swimMatch[3]
    const m = swimMatch[2] ?? swimMatch[4] ?? '0'
    if (h) result.swim = parseCutoffToMinutes(h, m || '0')
  }

  // Barrière vélo
  const bikeRe =
    /barri[eè]re\s+v[eé]lo[^<\d]*(\d+)h(\d{0,2})|bike\s+cutoff[^<\d]*(\d+)h(\d{0,2})/i
  const bikeMatch = html.match(bikeRe)
  if (bikeMatch) {
    const h = bikeMatch[1] ?? bikeMatch[3]
    const m = bikeMatch[2] ?? bikeMatch[4] ?? '0'
    if (h) result.bike = parseCutoffToMinutes(h, m || '0')
  }

  // Barrière course
  const runRe =
    /barri[eè]re\s+(course|cap|run)[^<\d]*(\d+)h(\d{0,2})|run\s+cutoff[^<\d]*(\d+)h(\d{0,2})/i
  const runMatch = html.match(runRe)
  if (runMatch) {
    const h = runMatch[2] ?? runMatch[4]
    const m = runMatch[3] ?? runMatch[5] ?? '0'
    if (h) result.run = parseCutoffToMinutes(h, m || '0')
  }

  return result
}

// ---------------------------------------------------------------------------
// Fallback HTML — swim_type
// ---------------------------------------------------------------------------

function extractSwimTypeFromHtml(html: string): SwimType | null {
  // Chercher dans le texte visible (pas les balises)
  const textOnly = html.replace(/<[^>]+>/g, ' ')
  const lower = textOnly.toLowerCase()

  if (/\blac\b/.test(lower)) return 'lac'
  if (/\b(mer|oc[eé]an)\b/.test(lower)) return 'mer'
  if (/\b(rivi[eè]re|fleuve)\b/.test(lower)) return 'rivière'
  if (/\bpiscine\b/.test(lower)) return 'piscine'
  if (/\b[eé]tang\b/.test(lower)) return 'étang'
  if (/open.?water/.test(lower)) return 'open water'
  return null
}

// ---------------------------------------------------------------------------
// Fallback HTML — is_wetsuit_allowed
// ---------------------------------------------------------------------------

function extractWetsuitFromHtml(html: string): boolean | null {
  const lower = html.toLowerCase()
  if (/combinaison\s+(non\s+)?autoris[ée]e|wetsuit\s+(not\s+)?allowed/.test(lower)) {
    if (/non\s+autoris[ée]e|not\s+allowed/.test(lower)) return false
    return true
  }
  if (/combinaison\s+obligatoire/.test(lower)) return true
  if (/sans\s+combinaison|wetsuit\s+forbidden|no\s+wetsuit/.test(lower)) return false
  return null
}

// ---------------------------------------------------------------------------
// Fallback HTML — is_draft_legal
// ---------------------------------------------------------------------------

function extractDraftFromHtml(html: string): boolean | null {
  const lower = html.toLowerCase()
  if (/draft\s+l[eé]gal|drafting\s+autoris[eé]/.test(lower)) return true
  if (/non.drafting|draft\s+interdit|no\s+draft/.test(lower)) return false
  return null
}

// ---------------------------------------------------------------------------
// Fallback HTML — gpx_url
// ---------------------------------------------------------------------------

function extractGpxFromHtml(html: string): string | null {
  // Liens href vers un fichier .gpx
  const gpxFileRe = /href="([^"]*\.gpx[^"]*)"/i
  const gpxFileMatch = html.match(gpxFileRe)
  if (gpxFileMatch?.[1]) return gpxFileMatch[1]

  // Liens "gpx" avec attribut download
  const gpxDownloadRe = /href="([^"]*gpx[^"]*)"[^>]*download/i
  const gpxDlMatch = html.match(gpxDownloadRe)
  if (gpxDlMatch?.[1]) return gpxDlMatch[1]

  return null
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
// Sélection du format "principal"
//
// On exclut les formats de type relais ou kids (noms contenant relay/relais/
// kids/enfant/junior), puis on prend le format dont la somme des distances
// est la plus élevée. Si aucun format n'est disponible on retourne null.
// ---------------------------------------------------------------------------

const EXCLUDED_FORMAT_NAMES = /relay|relais|kids|enfant|junior|team/i

function pickPrimaryFormat(formats: unknown[]): FinishersFormat | null {
  const valid: FinishersFormat[] = []

  for (const f of formats) {
    if (!isRecord(f)) continue
    const name = toStr(f['name'])
    if (name && EXCLUDED_FORMAT_NAMES.test(name)) continue
    valid.push(f as FinishersFormat)
  }

  if (valid.length === 0) return null

  // Trier par distance totale décroissante puis prendre le premier
  valid.sort((a, b) => {
    const totalA =
      (toNum(a.swimDistance) ?? 0) +
      (toNum(a.bikeDistance) ?? 0) +
      (toNum(a.runDistance) ?? 0)
    const totalB =
      (toNum(b.swimDistance) ?? 0) +
      (toNum(b.bikeDistance) ?? 0) +
      (toNum(b.runDistance) ?? 0)
    return totalB - totalA
  })

  return valid[0]
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
    is_sold_out: null,
    registration_status: null,
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

  // 2. Extraire l'objet race
  const rawRace = nextData?.props?.pageProps?.race
  if (!isRecord(rawRace)) return emptyFields(url)

  const race = rawRace as FinishersRace

  // 3. Champs simples
  const name = toStr(race.name)
  const date = toStr(race.startDate)
  const city = toStr(race.city)
  const country = toStr(race.country)
  const region = toStr(race.region)
  const department = toStr(race.department)
  const latitude = toNum(race.latitude)
  const longitude = toNum(race.longitude)
  const description = toStr(race.description)
  const tagline = toStr(race.tagline)
  const image_url = toStr(race.image)
  const website_url = toStr(race.website)

  // 4. Organisateur
  let organizer_name: string | null = null
  if (isRecord(race.organizer)) {
    const org = race.organizer as FinishersOrganizer
    organizer_name = toStr(org.name)
  }

  // 5. Format principal
  let swim_distance: number | null = null
  let bike_distance: number | null = null
  let run_distance: number | null = null
  let bike_elevation: number | null = null
  let run_elevation: number | null = null
  let price_euros: number | null = null
  let max_participants: number | null = null
  let time_limit_hours: number | null = null
  let registration_url: string | null = null
  let category: string | null = null
  let primaryFormat: FinishersFormat | null = null

  if (isArray(race.formats)) {
    primaryFormat = pickPrimaryFormat(race.formats)
    if (primaryFormat !== null) {
      swim_distance = toNum(primaryFormat.swimDistance)
      bike_distance = toNum(primaryFormat.bikeDistance)
      run_distance = toNum(primaryFormat.runDistance)
      bike_elevation = toNum(primaryFormat.bikeElevation)
      run_elevation = toNum(primaryFormat.runElevation)
      price_euros = toNum(primaryFormat.price)
      max_participants = toNum(primaryFormat.maxParticipants)
      time_limit_hours = toNum(primaryFormat.timeLimitHours)
      registration_url = toStr(primaryFormat.registrationUrl)

      if (
        swim_distance !== null &&
        bike_distance !== null &&
        run_distance !== null
      ) {
        category = inferCategory(swim_distance, bike_distance, run_distance)
      }
    }
  }

  // 6. Barrières horaires
  // Priorité : race.cutoffs > race.*CutoffMinutes > format.*CutoffMinutes > HTML
  let swim_cutoff_minutes: number | null = null
  let bike_cutoff_minutes: number | null = null
  let run_cutoff_minutes: number | null = null

  if (isRecord(race.cutoffs)) {
    const cutoffs = race.cutoffs as FinishersCutoffs
    swim_cutoff_minutes = toNum(cutoffs.swim)
    bike_cutoff_minutes = toNum(cutoffs.bike)
    run_cutoff_minutes = toNum(cutoffs.run)
  }

  if (swim_cutoff_minutes === null) swim_cutoff_minutes = toNum(race.swimCutoffMinutes)
  if (bike_cutoff_minutes === null) bike_cutoff_minutes = toNum(race.bikeCutoffMinutes)
  if (run_cutoff_minutes === null) run_cutoff_minutes = toNum(race.runCutoffMinutes)

  if (primaryFormat !== null) {
    if (swim_cutoff_minutes === null) swim_cutoff_minutes = toNum(primaryFormat.swimCutoffMinutes)
    if (bike_cutoff_minutes === null) bike_cutoff_minutes = toNum(primaryFormat.bikeCutoffMinutes)
    if (run_cutoff_minutes === null) run_cutoff_minutes = toNum(primaryFormat.runCutoffMinutes)
  }

  if (
    swim_cutoff_minutes === null ||
    bike_cutoff_minutes === null ||
    run_cutoff_minutes === null
  ) {
    const htmlCutoffs = extractCutoffsFromHtml(html)
    if (swim_cutoff_minutes === null) swim_cutoff_minutes = htmlCutoffs.swim
    if (bike_cutoff_minutes === null) bike_cutoff_minutes = htmlCutoffs.bike
    if (run_cutoff_minutes === null) run_cutoff_minutes = htmlCutoffs.run
  }

  // 7. swim_type
  let swim_type: ScrapedFields['swim_type'] = null

  swim_type =
    normalizeSwimType(race.swimType) ??
    normalizeSwimType(race.swim_type) ??
    extractSwimTypeFromHtml(html)

  // 8. bike_type
  let bike_type: ScrapedFields['bike_type'] = null

  bike_type =
    normalizeBikeType(race.bikeType) ??
    normalizeBikeType(race.bike_type)

  // 9. is_wetsuit_allowed
  let is_wetsuit_allowed: boolean | null =
    toBool(race.isWetsuitAllowed) ??
    toBool(race.wetsuit) ??
    extractWetsuitFromHtml(html)

  // 10. is_draft_legal
  let is_draft_legal: boolean | null =
    toBool(race.isDraftLegal) ??
    toBool(race.draft) ??
    extractDraftFromHtml(html)

  // 11. registration_deadline
  const registration_deadline: string | null =
    toDateYMD(race.registrationDeadline) ??
    toDateYMD(race.inscriptionDeadline)

  // 12. Records
  const record_men: string | null =
    toStr(race.recordMen) ?? toStr(race.record_men)

  const record_women: string | null =
    toStr(race.recordWomen) ?? toStr(race.record_women)

  // 13. qualification_for
  const qualification_for: string | null =
    toStr(race.qualificationFor) ?? toStr(race.qualification)

  // 14. tags — filtrer les non-strings
  let tags: string[] | null = null
  if (isArray(race.tags)) {
    const filtered = race.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    tags = filtered.length > 0 ? filtered : null
  }

  // 15. finishers_count
  const finishers_count: number | null =
    toNum(race.finishersCount) ?? toNum(race.finishers)

  // 16. gpx_url
  // Priorité : race.gpxUrl > race.gpx_url > format.gpxUrl > format.gpx_url > HTML
  let gpx_url: string | null =
    toStr(race.gpxUrl) ??
    toStr(race.gpx_url)

  if (gpx_url === null && primaryFormat !== null) {
    gpx_url = toStr(primaryFormat.gpxUrl) ?? toStr(primaryFormat.gpx_url)
  }

  if (gpx_url === null) {
    gpx_url = extractGpxFromHtml(html)
  }

  // 17. GPX par discipline
  // Priorité : race.*GpxUrl > format.*GpxUrl
  const swim_gpx_url: string | null =
    toStr(race.swimGpxUrl) ??
    toStr(race.swim_gpx_url) ??
    (primaryFormat !== null
      ? toStr(primaryFormat.swimGpxUrl) ?? toStr(primaryFormat.swim_gpx_url)
      : null)

  const bike_gpx_url: string | null =
    toStr(race.bikeGpxUrl) ??
    toStr(race.bike_gpx_url) ??
    (primaryFormat !== null
      ? toStr(primaryFormat.bikeGpxUrl) ?? toStr(primaryFormat.bike_gpx_url)
      : null)

  const run_gpx_url: string | null =
    toStr(race.runGpxUrl) ??
    toStr(race.run_gpx_url) ??
    (primaryFormat !== null
      ? toStr(primaryFormat.runGpxUrl) ?? toStr(primaryFormat.run_gpx_url)
      : null)

  // 18. Construire le slug finishers si l'URL n'est pas encore la bonne
  const finishers_url = url

  // Supprimer les avertissements "assigned but never used" pour les variables
  // qui sont réassignées conditionnellement — les valeurs finales sont celles
  // retournées dans l'objet ci-dessous.
  void (swim_type satisfies ScrapedFields['swim_type'])
  void (bike_type satisfies ScrapedFields['bike_type'])
  void (is_wetsuit_allowed satisfies boolean | null)
  void (is_draft_legal satisfies boolean | null)

  return {
    name,
    date,
    description,
    image_url,
    city,
    country,
    latitude,
    longitude,
    price_euros,
    website_url,
    organizer_name,
    swim_distance,
    bike_distance,
    run_distance,
    category,
    region,
    department,
    bike_elevation,
    run_elevation,
    max_participants,
    time_limit_hours,
    registration_url,
    finishers_url,
    tagline,
    source: 'finishers',
    swim_cutoff_minutes,
    bike_cutoff_minutes,
    run_cutoff_minutes,
    swim_type,
    bike_type,
    is_wetsuit_allowed,
    is_draft_legal,
    registration_deadline,
    record_men,
    record_women,
    qualification_for,
    tags,
    finishers_count,
    gpx_url,
    swim_gpx_url,
    bike_gpx_url,
    run_gpx_url,
    avg_water_temp_celsius: null,
    avg_temp_celsius: null,
    avg_wind_kmh: null,
    is_sold_out: null,
    registration_status: null,
    track_geojson: null,
    elevation_profile: null,
  }
}
