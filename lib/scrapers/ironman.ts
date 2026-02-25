import type { ScrapedFields } from '@/lib/scrape-fields'

// ---------------------------------------------------------------------------
// Distances fixes par format Ironman
// ---------------------------------------------------------------------------

type SwimType = 'lac' | 'mer' | 'rivière' | 'piscine' | 'étang' | 'open water'

const IRONMAN_FULL = {
  swim_distance: 3800,
  bike_distance: 180000,
  run_distance: 42195,
  time_limit_hours: 17,
  category: 'XL',
  swim_cutoff_minutes: 140,
  bike_cutoff_minutes: 630,
  run_cutoff_minutes: 990,
  is_draft_legal: false as false,
  is_wetsuit_allowed: null as null,
  swim_type: 'open water' as SwimType,
  bike_type: 'route' as const,
  qualification_for: 'Championnats du Monde IRONMAN',
  tags: ['ironman', 'full', 'longue distance'] as string[],
} as const

const IRONMAN_703 = {
  swim_distance: 1900,
  bike_distance: 90000,
  run_distance: 21100,
  time_limit_hours: 8.5,
  category: '70.3',
  swim_cutoff_minutes: 70,
  bike_cutoff_minutes: 330,
  run_cutoff_minutes: 510,
  is_draft_legal: false as false,
  is_wetsuit_allowed: null as null,
  swim_type: 'open water' as SwimType,
  bike_type: 'route' as const,
  qualification_for: 'Championnats du Monde IRONMAN 70.3',
  tags: ['ironman', '70.3', 'half'] as string[],
} as const

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
    // Supporte "1,500" ou "1.500" comme séparateurs de milliers
    const cleaned = v.replace(/[,\s]/g, '').replace(/[^\d.]/g, '')
    const n = parseFloat(cleaned)
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
// Détection du format depuis l'URL
// ---------------------------------------------------------------------------

type IronmanFormat = typeof IRONMAN_FULL | typeof IRONMAN_703

function detectFormat(url: string): IronmanFormat {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('70.3') || lowerUrl.includes('703')) {
    return IRONMAN_703
  }
  return IRONMAN_FULL
}

// ---------------------------------------------------------------------------
// Types internes — structure JSON-LD SportsEvent / Event
// ---------------------------------------------------------------------------

interface JsonLdAddress {
  addressLocality?: unknown
  addressRegion?: unknown
  addressCountry?: unknown
  streetAddress?: unknown
}

interface JsonLdGeo {
  latitude?: unknown
  longitude?: unknown
}

interface JsonLdLocation {
  name?: unknown
  address?: unknown
  geo?: unknown
}

interface JsonLdOffers {
  price?: unknown
  priceCurrency?: unknown
  url?: unknown
  validThrough?: unknown
}

interface JsonLdOrganizer {
  name?: unknown
}

interface JsonLdEvent {
  '@type'?: unknown
  name?: unknown
  startDate?: unknown
  endDate?: unknown
  description?: unknown
  image?: unknown
  location?: unknown
  offers?: unknown
  organizer?: unknown
  url?: unknown
}

// ---------------------------------------------------------------------------
// Extraction depuis le JSON-LD
// ---------------------------------------------------------------------------

interface JsonLdResult {
  name: string | null
  date: string | null
  description: string | null
  image_url: string | null
  city: string | null
  country: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  price_euros: number | null
  organizer_name: string | null
  registration_url: string | null
  registration_deadline: string | null
}

function extractFromJsonLd(html: string): JsonLdResult {
  const result: JsonLdResult = {
    name: null,
    date: null,
    description: null,
    image_url: null,
    city: null,
    country: null,
    region: null,
    latitude: null,
    longitude: null,
    price_euros: null,
    organizer_name: null,
    registration_url: null,
    registration_deadline: null,
  }

  const pattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    let data: unknown
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }

    const rawItems: unknown[] = isArray(data) ? data : [data]
    // Dépaqueter @graph (format utilisé par Ironman : {"@context":"...", "@graph":[...]})
    const items: unknown[] = []
    for (const raw of rawItems) {
      if (isRecord(raw) && isArray(raw['@graph'])) {
        items.push(...(raw['@graph'] as unknown[]))
      } else {
        items.push(raw)
      }
    }
    for (const item of items) {
      if (!isRecord(item)) continue
      const ev = item as JsonLdEvent
      const type = ev['@type']
      if (type !== 'SportsEvent' && type !== 'Event') continue

      if (result.name === null) result.name = toStr(ev.name)
      if (result.date === null) {
        const rawDate = toStr(ev.startDate)
        if (rawDate) {
          // Normaliser en YYYY-MM-DD (ex: "2025-11-02T00:00:00+0000" → "2025-11-02")
          const dateMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/)
          result.date = dateMatch ? dateMatch[1] : rawDate
        }
      }

      if (result.description === null) {
        const desc = toStr(ev.description)
        if (desc && desc.length > 20) {
          result.description = desc.slice(0, 1000)
        }
      }

      // Image — peut être une string ou un tableau
      if (result.image_url === null) {
        if (typeof ev.image === 'string' && ev.image.startsWith('http')) {
          result.image_url = ev.image
        } else if (isArray(ev.image) && ev.image.length > 0) {
          const first = ev.image[0]
          if (typeof first === 'string' && first.startsWith('http')) {
            result.image_url = first
          }
        }
      }

      // Location
      if (isRecord(ev.location)) {
        const loc = ev.location as JsonLdLocation

        if (isRecord(loc.address)) {
          const addr = loc.address as JsonLdAddress
          if (result.city === null) result.city = toStr(addr.addressLocality)
          if (result.region === null) result.region = toStr(addr.addressRegion)
          if (result.country === null) {
            const rawCountry = addr.addressCountry
            if (typeof rawCountry === 'string') {
              result.country = toStr(rawCountry)
            } else if (isRecord(rawCountry) && typeof (rawCountry as Record<string, unknown>).name === 'string') {
              result.country = toStr((rawCountry as Record<string, unknown>).name)
            }
          }
        }

        if (isRecord(loc.geo)) {
          const geo = loc.geo as JsonLdGeo
          if (result.latitude === null) {
            const lat = toNum(geo.latitude)
            const lng = toNum(geo.longitude)
            if (lat !== null) result.latitude = lat
            if (lng !== null) result.longitude = lng
          }
        }
      }

      // Offers — prix, lien inscription, deadline
      if (isRecord(ev.offers)) {
        const offers = ev.offers as JsonLdOffers
        if (result.price_euros === null) {
          const price = toNum(offers.price)
          if (price !== null && price > 0) result.price_euros = Math.round(price)
        }
        if (result.registration_url === null) {
          result.registration_url = toStr(offers.url)
        }
        if (result.registration_deadline === null) {
          const raw = toStr(offers.validThrough)
          if (raw) {
            // Normaliser en YYYY-MM-DD
            const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
            if (dateMatch) result.registration_deadline = dateMatch[1]
          }
        }
      }

      // Organizer
      if (result.organizer_name === null && isRecord(ev.organizer)) {
        const org = ev.organizer as JsonLdOrganizer
        result.organizer_name = toStr(org.name)
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Extraction du prix depuis le HTML Ironman
// Ironman utilise des classes comme .pricing, [class*="price"], [class*="entry"]
// ---------------------------------------------------------------------------

function extractPriceFromHtml(html: string): number | null {
  // Patterns ciblant les blocs prix typiques d'Ironman
  const pricePatterns = [
    // <span class="pricing">€ 650</span>
    /class="[^"]*pric[^"]*"[^>]*>[^<]*?[€$£]?\s*(\d[\d.,]*)/i,
    // data-price="650"
    /data-price[^=]*=["']?(\d[\d.,]*)/i,
    // "entry fee" suivi d'un montant
    /entry\s+fee[^€$£\d]*[€$£]?\s*(\d[\d.,]*)/i,
    // "registration" suivi d'un montant
    /registr[a-z]+[^€$£\d]*[€$£]\s*(\d[\d.,]*)/i,
  ]

  for (const pattern of pricePatterns) {
    const m = html.match(pattern)
    if (m) {
      const price = toNum(m[1])
      // Sanity check : prix entre 50€ et 2000€
      if (price !== null && price >= 50 && price <= 2000) {
        return Math.round(price)
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Extraction du nombre de participants depuis le HTML Ironman
// ---------------------------------------------------------------------------

function extractMaxParticipantsFromHtml(html: string): number | null {
  const patterns = [
    // class contenant "athlete" ou "participant"
    /class="[^"]*(?:athlete|participant)[^"]*"[^>]*>[^<]*?(\d[\d,]*)/i,
    // "athlete slots" ou "participant limit"
    /(?:athlete\s+slots?|participant\s+limit)[^:]*:\s*(\d[\d,]*)/i,
    // Nombre de dossards
    /(\d[\d,]*)\s+(?:athlete\s+slots?|participants?|dossards?)/i,
  ]

  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m) {
      const val = toNum(m[1].replace(/,/g, ''))
      // Sanity check : entre 100 et 5000 participants
      if (val !== null && val >= 100 && val <= 5000) {
        return Math.round(val)
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Extraction de la ville depuis l'URL (dernier fallback)
// ex: https://www.ironman.com/im-nice → "Nice"
// ex: https://eu.ironman.com/triathlon/races/europe/france/nice/2026 → "Nice"
// ---------------------------------------------------------------------------

function cityFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url)
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null

    // Chercher le dernier segment qui ressemble à une ville
    for (let i = segments.length - 1; i >= 0; i--) {
      let seg = segments[i].toLowerCase()
      // Exclure les segments numériques (années) ou trop génériques
      if (/^\d+$/.test(seg)) continue
      if (['triathlon', 'races', 'europe', 'france', 'ironman', 'im', '703'].includes(seg)) continue
      // Supprimer les préfixes Ironman connus : "im703-", "im-", "ironman-", "703-"
      seg = seg.replace(/^(?:im703|im70\.3|im|ironman|703)-/, '')
      if (!seg) continue
      // Capitaliser chaque mot (ex: "vichy" → "Vichy", "aix-en-provence" → "Aix-en-provence")
      return seg.charAt(0).toUpperCase() + seg.slice(1)
    }
  } catch {
    // URL invalide
  }
  return null
}

// ---------------------------------------------------------------------------
// Extraction du nom depuis l'URL (fallback)
// ex: https://www.ironman.com/im-nice → "IRONMAN Nice"
// ---------------------------------------------------------------------------

function nameFromUrl(url: string, format: IronmanFormat): string | null {
  const city = cityFromUrl(url)
  if (!city) return null

  const prefix = format === IRONMAN_703 ? 'IRONMAN 70.3' : 'IRONMAN'
  return `${prefix} ${city}`
}

// ---------------------------------------------------------------------------
// Conversion URL relative → absolue (Ironman utilise des chemins /sites/...)
// ---------------------------------------------------------------------------

function toAbsoluteIronmanUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('www.')) return `https://${url}`
  if (url.startsWith('/')) return `https://www.ironman.com${url}`
  return url
}

// ---------------------------------------------------------------------------
// Extraction du lien GPX depuis le HTML
// ---------------------------------------------------------------------------

function extractGpxUrl(html: string): string | null {
  // Cas 1 : <a href="...gpx..."> — href contient ".gpx"
  const hrefGpxPattern = /<a[^>]+href="([^"]*\.gpx[^"]*)"/gi
  let m = hrefGpxPattern.exec(html)
  if (m) return m[1]

  // Cas 2 : href contenant le mot "gpx" (sans extension explicite)
  const hrefWordPattern = /<a[^>]+href="([^"]*gpx[^"]*)"/gi
  m = hrefWordPattern.exec(html)
  if (m) return m[1]

  // Cas 3 : texte du lien contient "gpx", "course map", "download track"
  const textPattern = /<a[^>]+href="([^"]+)"[^>]*>[^<]*(?:gpx|course\s+map|download\s+track)[^<]*<\/a>/gi
  m = textPattern.exec(html)
  if (m) return m[1]

  return null
}

// ---------------------------------------------------------------------------
// Extraction des GPX par discipline depuis le HTML
// ---------------------------------------------------------------------------

function extractDisciplineGpxUrls(html: string): {
  swim_gpx_url: string | null
  bike_gpx_url: string | null
  run_gpx_url: string | null
} {
  const result = { swim_gpx_url: null as string | null, bike_gpx_url: null as string | null, run_gpx_url: null as string | null }

  // Stratégie principale : texte du lien ("Swim/Bike/Run GPX file")
  // Invariant quel que soit la langue du nom de fichier (allemand, français…)
  const swimTextPat = /<a[^>]+href="([^"]*\.gpx[^"]*)"[^>]*>[^<]*swim[^<]*<\/a>/gi
  let m = swimTextPat.exec(html)
  if (m) result.swim_gpx_url = m[1]

  const bikeTextPat = /<a[^>]+href="([^"]*\.gpx[^"]*)"[^>]*>[^<]*bike[^<]*<\/a>/gi
  m = bikeTextPat.exec(html)
  if (m) result.bike_gpx_url = m[1]

  const runTextPat = /<a[^>]+href="([^"]*\.gpx[^"]*)"[^>]*>[^<]*\brun\b[^<]*<\/a>/gi
  m = runTextPat.exec(html)
  if (m) result.run_gpx_url = m[1]

  // Fallback : discipline dans le nom du fichier href
  if (!result.swim_gpx_url) {
    const swimHrefPat = /<a[^>]+href="([^"]*(?:swim|natation)[^"]*\.gpx[^"]*)"[^>]*>/gi
    m = swimHrefPat.exec(html)
    if (m) result.swim_gpx_url = m[1]
  }
  if (!result.bike_gpx_url) {
    const bikeHrefPat = /<a[^>]+href="([^"]*(?:bike|cycling|velo|v%C3%A9lo|rad)[^"]*\.gpx[^"]*)"[^>]*>/gi
    m = bikeHrefPat.exec(html)
    if (m) result.bike_gpx_url = m[1]
  }
  if (!result.run_gpx_url) {
    const runHrefPat = /<a[^>]+href="([^"]*(?:run|lauf)[^"]*\.gpx[^"]*)"[^>]*>/gi
    m = runHrefPat.exec(html)
    if (m) result.run_gpx_url = m[1]
  }

  return result
}

// ---------------------------------------------------------------------------
// Extraction des records hommes / femmes depuis le HTML
// ---------------------------------------------------------------------------

// Normalise un temps capturé vers le format "7h42:15"
function normalizeTime(raw: string): string | null {
  raw = raw.trim()

  // Format déjà normalisé "7h42:15"
  if (/^\d+h\d{2}:\d{2}$/.test(raw)) return raw

  // Format "7:42:15" → "7h42:15"
  const colonFull = raw.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (colonFull) return `${colonFull[1]}h${colonFull[2]}:${colonFull[3]}`

  return null
}

function extractRecords(html: string): { record_men: string | null; record_women: string | null } {
  const result = { record_men: null as string | null, record_women: null as string | null }

  // Patterns pour les records — on cherche les paires label + temps
  // ex: "Course Record Men: 7:42:15", "CR Men 7h42:15", "course record men : 7:42:15"
  const patterns: Array<{ key: 'record_men' | 'record_women'; re: RegExp }> = [
    {
      key: 'record_men',
      re: /(?:course\s+record\s+men|cr\s+men)[^:\d]*:?\s*(\d+[h:]\d{2}[:\d]*)/gi,
    },
    {
      key: 'record_women',
      re: /(?:course\s+record\s+women|cr\s+women)[^:\d]*:?\s*(\d+[h:]\d{2}[:\d]*)/gi,
    },
  ]

  for (const { key, re } of patterns) {
    re.lastIndex = 0
    const m = re.exec(html)
    if (m) {
      const normalized = normalizeTime(m[1])
      if (normalized) result[key] = normalized
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Extraction du nombre de finishers depuis le HTML
// ---------------------------------------------------------------------------

function extractFinishersCount(html: string): number | null {
  const patterns = [
    // "1500 finishers" ou "1,500 finishers"
    /(\d[\d,]*)\s+finishers?/i,
    // "1500 athletes finished"
    /(\d[\d,]*)\s+athletes?\s+finished/i,
  ]

  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m) {
      const val = toNum(m[1].replace(/,/g, ''))
      // Plage : 500 à 5000
      if (val !== null && val >= 500 && val <= 5000) return Math.round(val)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Extraction de la date limite d'inscription depuis le HTML (fallback JSON-LD)
// ---------------------------------------------------------------------------

function extractRegistrationDeadlineFromHtml(html: string): string | null {
  // Patterns textuels : "registration closes May 15, 2026", "last day to register: 2026-05-15"
  const textPatterns = [
    /registration\s+closes?\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
    /last\s+day\s+to\s+register[^:]*:\s*(\d{4}-\d{2}-\d{2})/i,
    /inscriptions?\s+(?:closes?|jusqu'au|avant\s+le)[^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
  ]

  for (const pattern of textPatterns) {
    const m = html.match(pattern)
    if (m) {
      const raw = m[1].trim()

      // Déjà au format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

      // Format DD/MM/YYYY ou DD-MM-YYYY
      const dmyMatch = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
      if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`

      // Formats textuels anglais : "May 15, 2026" ou "May 15 2026"
      const monthNames: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04',
        may: '05', june: '06', july: '07', august: '08',
        september: '09', october: '10', november: '11', december: '12',
      }
      const engMatch = raw.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
      if (engMatch) {
        const month = monthNames[engMatch[1].toLowerCase()]
        if (month) {
          const day = engMatch[2].padStart(2, '0')
          return `${engMatch[3]}-${month}-${day}`
        }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Détection dynamique du swim_type depuis le HTML
// ---------------------------------------------------------------------------

function detectSwimType(html: string): SwimType {
  const lower = html.toLowerCase()

  // Étape 1 : recherche contextuelle par proximité
  // Pour chaque occurrence de "swim", on analyse les 250 chars suivants dans le HTML brut.
  // Ça fonctionne même si "Swim" est un titre h3 et le type d'eau est dans un <p> suivant,
  // car les balises HTML sont transparentes pour cette analyse.
  // L'ordre des checks (river avant lac avant sea) détermine la priorité.
  const swimRe = /swim(?:ming|s)?\b/g
  let m: RegExpExecArray | null
  while ((m = swimRe.exec(lower)) !== null) {
    const ctx = lower.slice(m.index, m.index + 250)
    if (/\b(?:river|rivière|riviere|fleuve|canal)\b/.test(ctx)) return 'rivière'
    if (/\b(?:ocean|mediterranean|atlantic|pacific|marina|harbor|harbour)\b/.test(ctx)) return 'mer'
    if (/\b(?:sea|bay)\b/.test(ctx)) return 'mer'
    if (/\b(?:lake|reservoir|étang|etang)\b/.test(ctx) || / lac /.test(ctx)) return 'lac'
    if (/\bpool\b/.test(ctx) || /\bpiscine\b/.test(ctx)) return 'piscine'
  }

  // Étape 2 : fallback sur mots-clés isolés (sans 'river' seul — trop de faux positifs géographiques)
  if (lower.includes('rivière') || lower.includes('riviere') || lower.includes('fleuve')) return 'rivière'
  if (lower.includes('lake') || lower.includes(' lac ') || lower.includes('>lac<') || lower.includes('reservoir')) return 'lac'
  if (lower.includes('ocean') || lower.includes(' sea ') || lower.includes('>sea<') || lower.includes(' mer ') || lower.includes('>mer<')) return 'mer'
  if (lower.includes('pool') || lower.includes('piscine')) return 'piscine'

  return 'open water'
}

// ---------------------------------------------------------------------------
// Extraction de la date depuis le HTML (fallback JSON-LD)
// ---------------------------------------------------------------------------

function extractDateFromHtml(html: string): string | null {
  // Pattern 1 : attribut datetime="..." dans une balise <time>
  const timeAttr = html.match(/<time[^>]+datetime="([^"]+)"/i)
  if (timeAttr) {
    const raw = timeAttr[1]
    const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) return isoMatch[1]
  }

  // Pattern 2 : ISO dans le HTML brut
  const isoInHtml = html.match(/(\d{4}-\d{2}-\d{2})/)
  if (isoInHtml) return isoInHtml[1]

  // Pattern 3 : "Month DD, YYYY" ou "Month DD YYYY"
  const monthNames: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  }
  const monthPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i
  const monthMatch = html.match(monthPattern)
  if (monthMatch) {
    const month = monthNames[monthMatch[1].toLowerCase()]
    if (month) {
      const day = monthMatch[2].padStart(2, '0')
      return `${monthMatch[3]}-${month}-${day}`
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Extraction de la température de l'eau depuis le HTML
// ---------------------------------------------------------------------------

function extractWaterTemp(html: string): number | null {
  const pattern = /(?:avg\.?\s+)?water\s+temp(?:erature)?[^:\d]*:?\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])/i
  const m = html.match(pattern)
  if (!m) return null

  const value = parseFloat(m[1])
  if (isNaN(value)) return null

  let celsius = value
  if (m[2].toUpperCase() === 'F') {
    celsius = (value - 32) * 5 / 9
  }

  // Plage valide : 10 à 35°C
  if (celsius < 10 || celsius > 35) return null
  return Math.round(celsius * 10) / 10
}

// ---------------------------------------------------------------------------
// Détection sold out depuis le HTML
// ---------------------------------------------------------------------------

function extractSoldOut(html: string): boolean | null {
  const pattern = /(?:registration\s+)?sold\s+out|inscriptions?\s+(?:ferm[ée]es?|compl[eè]tes?)|(?:^|\s)complet(?:\s|$)/i
  if (pattern.test(html)) return true
  return null
}

// ---------------------------------------------------------------------------
// Conversion d'un temps texte en minutes (ex: "1:10:00" → 70, "1h10" → 70)
// ---------------------------------------------------------------------------

function parseTimeToMinutes(raw: string): number | null {
  raw = raw.trim()

  // Format "H:MM:SS" ou "H:MM"
  const colonMatch = raw.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10)
    const m = parseInt(colonMatch[2], 10)
    return h * 60 + m
  }

  // Format "Xh YY" ou "XhYY" ou "Xh YY min"
  const hMatch = raw.match(/^(\d+)h\s*(\d{0,2})/)
  if (hMatch) {
    const h = parseInt(hMatch[1], 10)
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0
    return h * 60 + m
  }

  // Format "X min" (minutes seules)
  const minMatch = raw.match(/^(\d+)\s*min/)
  if (minMatch) {
    return parseInt(minMatch[1], 10)
  }

  return null
}

// ---------------------------------------------------------------------------
// Objet vide retourné en cas d'erreur
// ---------------------------------------------------------------------------

function emptyFields(url: string, format: IronmanFormat): ScrapedFields {
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
    organizer_name: 'IRONMAN Group',
    swim_distance: format.swim_distance,
    bike_distance: format.bike_distance,
    run_distance: format.run_distance,
    category: format.category,
    region: null,
    department: null,
    bike_elevation: null,
    run_elevation: null,
    max_participants: null,
    time_limit_hours: format.time_limit_hours,
    registration_url: null,
    finishers_url: null,
    tagline: null,
    source: 'ironman',
    swim_cutoff_minutes: format.swim_cutoff_minutes,
    bike_cutoff_minutes: format.bike_cutoff_minutes,
    run_cutoff_minutes: format.run_cutoff_minutes,
    swim_type: format.swim_type,
    bike_type: format.bike_type,
    is_wetsuit_allowed: format.is_wetsuit_allowed,
    is_draft_legal: format.is_draft_legal,
    registration_deadline: null,
    record_men: null,
    record_women: null,
    qualification_for: format.qualification_for,
    tags: [...format.tags],
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
// Parser sous-page /course
// ---------------------------------------------------------------------------

interface CoursePageResult {
  swim_type: SwimType | null
  bike_elevation: number | null
  run_elevation: number | null
  gpx_url: string | null
  swim_gpx_url: string | null
  bike_gpx_url: string | null
  run_gpx_url: string | null
  description: string | null
  // Cutoffs — présents sur la page /course chez Ironman (pas sur /athletes-guide)
  swim_cutoff_minutes: number | null
  bike_cutoff_minutes: number | null
  run_cutoff_minutes: number | null
}

function parseCourseHtml(html: string): CoursePageResult {
  const result: CoursePageResult = {
    swim_type: null,
    bike_elevation: null,
    run_elevation: null,
    gpx_url: null,
    swim_gpx_url: null,
    bike_gpx_url: null,
    run_gpx_url: null,
    description: null,
    swim_cutoff_minutes: null,
    bike_cutoff_minutes: null,
    run_cutoff_minutes: null,
  }

  if (!html) return result

  // swim_type — priorité 1 : titre de section "Swim River" / "Swim Lake" sur la même ligne (Ironman)
  // Fonctionne quand le mot est immédiatement après "swim" dans le texte brut
  const swimSectionMatch = html.match(/\bswim\s+(river|rivière|riviere|fleuve|canal|lake|lac|reservoir|sea|ocean|mer|bay|pool|piscine|etang|étang)\b/i)
  if (swimSectionMatch) {
    const sw = swimSectionMatch[1].toLowerCase()
    if (['river', 'rivière', 'riviere', 'fleuve', 'canal'].includes(sw)) {
      result.swim_type = 'rivière'
    } else if (['lake', 'lac', 'reservoir', 'etang', 'étang'].includes(sw)) {
      result.swim_type = 'lac'
    } else if (['sea', 'ocean', 'mer', 'bay'].includes(sw)) {
      result.swim_type = 'mer'
    } else if (['pool', 'piscine'].includes(sw)) {
      result.swim_type = 'piscine'
    }
  }

  // Priorité 2 : detectSwimType sur l'intégralité du HTML de la page /course
  // Cherche 'river' avant 'lake' — évite le faux positif "Lac d'Allier" quand "River Allier" est aussi présent
  if (result.swim_type === null) {
    const detected = detectSwimType(html)
    if (detected !== 'open water') result.swim_type = detected
  }

  // bike_elevation
  const bikeElevPatterns = [
    /bike[^:]*(?:elevation|d\+|gain)[^:]*:\s*([0-9,]+)\s*m/i,
    /v[eé]lo[^:]*(?:d[eé]nivel[eé]|d\+)[^:]*:\s*([0-9,]+)\s*m/i,
    /cycling[^:]*(?:elevation|gain)[^:]*:\s*([0-9,]+)\s*m/i,
  ]
  for (const pat of bikeElevPatterns) {
    const m = html.match(pat)
    if (m) {
      const val = toNum(m[1])
      if (val !== null && val >= 0 && val <= 8000) {
        result.bike_elevation = Math.round(val)
        break
      }
    }
  }

  // run_elevation
  const runElevPatterns = [
    /run[^:]*(?:elevation|d\+|gain)[^:]*:\s*([0-9,]+)\s*m/i,
    /course[^:]*(?:d[eé]nivel[eé]|d\+)[^:]*:\s*([0-9,]+)\s*m/i,
    /running[^:]*(?:elevation|gain)[^:]*:\s*([0-9,]+)\s*m/i,
  ]
  for (const pat of runElevPatterns) {
    const m = html.match(pat)
    if (m) {
      const val = toNum(m[1])
      if (val !== null && val >= 0 && val <= 3000) {
        result.run_elevation = Math.round(val)
        break
      }
    }
  }

  // GPX urls
  result.gpx_url = extractGpxUrl(html)
  const disciplineGpx = extractDisciplineGpxUrls(html)
  result.swim_gpx_url = disciplineGpx.swim_gpx_url
  result.bike_gpx_url = disciplineGpx.bike_gpx_url
  result.run_gpx_url = disciplineGpx.run_gpx_url

  // Description — og:description ou meta description
  const ogDescMatch = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i)
  if (ogDescMatch && ogDescMatch[1].length > 20) {
    result.description = ogDescMatch[1].slice(0, 1000)
  }

  // Cutoffs — Ironman place ces infos sur /course avec des balises HTML avec CSS inline massif
  // Format HTML réel : "Cut off time (Swim):</strong></span>...[~600 chars CSS]...<span>1h10</span>"
  // On utilise une regex multilignes qui saute les balises entre le label et la valeur
  const cutoffExtract = (pattern: RegExp): number | null => {
    const m = html.match(pattern)
    if (!m) return null
    const minutes = parseTimeToMinutes(m[1])
    return minutes !== null && minutes > 0 ? minutes : null
  }

  // Swim seul
  result.swim_cutoff_minutes = cutoffExtract(
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\)[\s\S]{1,2000}?(\d+h\d{2})/i
  )
  // Swim+Bike cumulatif — valeur stockée telle quelle (ex: 5h50 = 350 min)
  result.bike_cutoff_minutes = cutoffExtract(
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\+\s*bike\s*\)[\s\S]{1,2000}?(\d+h\d{2})/i
  )
  // Total Swim+Bike+Run — valeur totale (ex: 8h30 = 510 min)
  result.run_cutoff_minutes = cutoffExtract(
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\+\s*bike\s*\+\s*run\s*\)[\s\S]{1,2000}?(\d+h\d{2})/i
  )

  return result
}

// ---------------------------------------------------------------------------
// Parser sous-page /register
// ---------------------------------------------------------------------------

interface RegisterPageResult {
  price_euros: number | null
  is_sold_out: boolean | null
  registration_status: string | null
  registration_deadline: string | null
  max_participants: number | null
}

function parseRegisterHtml(html: string): RegisterPageResult {
  const result: RegisterPageResult = {
    price_euros: null,
    is_sold_out: null,
    registration_status: null,
    registration_deadline: null,
    max_participants: null,
  }

  if (!html) return result

  // Prix — chercher d'abord "General Entry: X EUR/USD" ou "General Entry: $X"
  // Gère : "General Entry: 387.50 EUR", "General Entry: $472.70 USD", "General Entry: $472.70"
  const generalEntryPattern = /General Entry[:\s]+\$?(\d+[\.,]\d+)\s*(EUR|USD)?/gi
  const entryPrices: number[] = []
  let gem: RegExpExecArray | null
  while ((gem = generalEntryPattern.exec(html)) !== null) {
    const p = toNum(gem[1])
    if (p !== null && p >= 50 && p <= 2000) entryPrices.push(p)
  }
  if (entryPrices.length > 0) {
    result.price_euros = Math.round(Math.min(...entryPrices))
  } else {
    // Fallback : minimum des prix EUR/USD/$ entre 50 et 2000
    const pricePattern = /(?:€|EUR|\$|USD)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€|EUR|USD)/gi
    const foundPrices: number[] = []
    let priceMatch: RegExpExecArray | null
    while ((priceMatch = pricePattern.exec(html)) !== null) {
      const raw = priceMatch[1] ?? priceMatch[2]
      const price = toNum(raw)
      if (price !== null && price >= 50 && price <= 2000) foundPrices.push(price)
    }
    if (foundPrices.length > 0) result.price_euros = Math.round(Math.min(...foundPrices))
  }

  // Statut d'inscription — détecter depuis les textes Registration Open/Closed/Sold Out
  // Gère aussi : "Registration is Open", "Register Now" (→ open), tag CSS "tag--green"/"tag--black"
  if (/registration\s+sold\s*out|sold\s*out/i.test(html)) {
    result.registration_status = 'sold_out'
    result.is_sold_out = true
  } else if (/registration\s+(?:is\s+)?closed|registrations?\s+closed/i.test(html)) {
    result.registration_status = 'closed'
    result.is_sold_out = false
  } else if (/registration\s+(?:is\s+)?open|registrations?\s+(?:is\s+)?open|register\s+now/i.test(html)) {
    result.registration_status = 'open'
    result.is_sold_out = false
  }

  // Date limite d'inscription
  result.registration_deadline = extractRegistrationDeadlineFromHtml(html)

  // Max participants
  const participantPatterns = [
    /(\d[\d,]*)\s+athlete\s+slots?/i,
    /capacity[^:]*:\s*(\d[\d,]*)/i,
    /(\d[\d,]*)\s+places?/i,
    /athlete\s+slots?[^:]*:\s*(\d[\d,]*)/i,
  ]
  for (const pat of participantPatterns) {
    const m = html.match(pat)
    if (m) {
      const val = toNum(m[1].replace(/,/g, ''))
      if (val !== null && val >= 100 && val <= 5000) {
        result.max_participants = Math.round(val)
        break
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Parser sous-page /athletes-guide
// ---------------------------------------------------------------------------

interface AthletesGuideResult {
  swim_cutoff_minutes: number | null
  bike_cutoff_minutes: number | null
  run_cutoff_minutes: number | null
  avg_temp_celsius: number | null
  avg_water_temp_celsius: number | null
  avg_wind_kmh: number | null
  record_men: string | null
  record_women: string | null
  is_wetsuit_allowed: boolean | null
  qualification_for: string | null
}

function parseAthletesGuideHtml(html: string): AthletesGuideResult {
  const result: AthletesGuideResult = {
    swim_cutoff_minutes: null,
    bike_cutoff_minutes: null,
    run_cutoff_minutes: null,
    avg_temp_celsius: null,
    avg_water_temp_celsius: null,
    avg_wind_kmh: null,
    record_men: null,
    record_women: null,
    is_wetsuit_allowed: null,
    qualification_for: null,
  }

  if (!html) return result

  // Barrières horaires — format réel Ironman : "Cut off time (Swim): 1h10"
  // "Cut off time (Swim+Bike): 5h50" = cumulatif natation+vélo
  // "Cut off Time (Swim+Bike+Run): 8h30" = temps total
  const swimCutoffPatterns = [
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\)\s*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /swim\s+cut[\s\-]*off[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /cutoff\s+swim[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /swim[^:]*barrière[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
  ]
  for (const pat of swimCutoffPatterns) {
    const m = html.match(pat)
    if (m) {
      const minutes = parseTimeToMinutes(m[1])
      if (minutes !== null && minutes > 0 && minutes <= 240) {
        result.swim_cutoff_minutes = minutes
        break
      }
    }
  }

  // Cutoff vélo = valeur cumulative (Swim+Bike) depuis le début de la course
  const bikeCutoffPatterns = [
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\+\s*bike\s*\)\s*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /bike\s+cut[\s\-]*off[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /cutoff\s+bike[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /v[eé]lo[^:]*barrière[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
  ]
  for (const pat of bikeCutoffPatterns) {
    const m = html.match(pat)
    if (m) {
      const minutes = parseTimeToMinutes(m[1])
      if (minutes !== null && minutes > 0 && minutes <= 1000) {
        result.bike_cutoff_minutes = minutes
        break
      }
    }
  }

  // Cutoff course = temps total (Swim+Bike+Run) depuis le départ
  const runCutoffPatterns = [
    /cut[\s\-]*off\s*time\s*\(\s*swim\s*\+\s*bike\s*\+\s*run\s*\)\s*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /run\s+cut[\s\-]*off[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /cutoff\s+run[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
    /course\s+[àa]\s+pied[^:]*barrière[^:]*:\s*(\d+[h:]\d+(?::\d+)?)/i,
  ]
  for (const pat of runCutoffPatterns) {
    const m = html.match(pat)
    if (m) {
      const minutes = parseTimeToMinutes(m[1])
      if (minutes !== null && minutes > 0 && minutes <= 1100) {
        result.run_cutoff_minutes = minutes
        break
      }
    }
  }

  // Température de l'air
  const airTempPatterns = [
    /avg\.?\s+(?:air\s+)?temp(?:erature)?[^:]*:\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])/i,
    /average\s+(?:air\s+)?temperature[^:]*:\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])/i,
    /air\s+temperature[^:]*:\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])/i,
  ]
  for (const pat of airTempPatterns) {
    const m = html.match(pat)
    if (m) {
      const val = parseFloat(m[1])
      if (!isNaN(val)) {
        let celsius = val
        if (m[2] && m[2].toUpperCase() === 'F') celsius = (val - 32) * 5 / 9
        if (celsius >= -10 && celsius <= 50) {
          result.avg_temp_celsius = Math.round(celsius * 10) / 10
          break
        }
      }
    }
  }

  // Température de l'eau
  const waterTempVal = extractWaterTemp(html)
  if (waterTempVal !== null) result.avg_water_temp_celsius = waterTempVal

  // Vitesse du vent
  const windPatterns = [
    /avg\.?\s+wind\s+speed[^:]*:\s*(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph)/i,
    /average\s+wind\s+speed[^:]*:\s*(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph)/i,
    /wind\s+speed[^:]*:\s*(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph)/i,
  ]
  for (const pat of windPatterns) {
    const m = html.match(pat)
    if (m) {
      const val = parseFloat(m[1])
      if (!isNaN(val) && val >= 0 && val <= 150) {
        result.avg_wind_kmh = Math.round(val * 10) / 10
        break
      }
    }
  }

  // Records
  const records = extractRecords(html)
  result.record_men = records.record_men
  result.record_women = records.record_women

  // Combinaison néoprène
  const noWetsuitPattern = /wetsuit\s+(?:is\s+)?not\s+(?:allowed|permitted)|no\s+wetsuit|wetsuits?\s+(?:are\s+)?(?:banned|prohibited|not\s+allowed)/i
  const yesWetsuitPattern = /wetsuit\s+(?:is\s+)?(?:allowed|permitted)|wetsuits?\s+permitted/i
  if (noWetsuitPattern.test(html)) {
    result.is_wetsuit_allowed = false
  } else if (yesWetsuitPattern.test(html)) {
    result.is_wetsuit_allowed = true
  } else if (result.avg_water_temp_celsius !== null) {
    // Règle IRONMAN : autorisé si eau < 24.5°C
    result.is_wetsuit_allowed = result.avg_water_temp_celsius < 24.5
  }

  // Qualification
  const qualifyPatterns = [
    /qualifying\s+race\s+for\s+([^.<\n]+)/i,
    /qualify\s+for\s+(?:the\s+)?([^.<\n]+)/i,
    /qualification\s+(?:pour|for)\s+([^.<\n]+)/i,
  ]
  for (const pat of qualifyPatterns) {
    const m = html.match(pat)
    if (m) {
      const text = m[1].trim().slice(0, 200)
      if (text.length > 5) {
        result.qualification_for = text
        break
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Scraper principal — accepte 4 HTMLs (les 3 sous-pages sont optionnelles)
// ---------------------------------------------------------------------------

export function scrapeIronman(
  url: string,
  htmlMain: string,
  htmlCourse = '',
  htmlRegister = '',
  htmlGuide = '',
): ScrapedFields {
  // 1. Détecter le format depuis l'URL (distances fixes)
  const format = detectFormat(url)
  const result = emptyFields(url, format)

  // 2. Extraire les données depuis le JSON-LD de la page principale
  const jsonLd = extractFromJsonLd(htmlMain)

  result.name = jsonLd.name
  result.date = jsonLd.date

  // Fallback HTML si la date JSON-LD est absente
  if (result.date === null) {
    result.date = extractDateFromHtml(htmlMain)
  }

  result.description = jsonLd.description
  result.image_url = jsonLd.image_url
  result.city = jsonLd.city
  result.country = jsonLd.country
  result.region = jsonLd.region
  result.latitude = jsonLd.latitude
  result.longitude = jsonLd.longitude
  result.registration_url = jsonLd.registration_url

  // L'organisateur JSON-LD remplace le défaut si présent
  if (jsonLd.organizer_name !== null) {
    result.organizer_name = jsonLd.organizer_name
  }

  // Prix : JSON-LD en priorité, puis HTML
  if (jsonLd.price_euros !== null) {
    result.price_euros = jsonLd.price_euros
  } else {
    result.price_euros = extractPriceFromHtml(htmlMain)
  }

  // 3. Participants depuis le HTML (JSON-LD ne l'expose pas)
  result.max_participants = extractMaxParticipantsFromHtml(htmlMain)

  // 4. Champs scrapés depuis la page principale
  result.gpx_url = extractGpxUrl(htmlMain)

  const records = extractRecords(htmlMain)
  result.record_men = records.record_men
  result.record_women = records.record_women

  result.finishers_count = extractFinishersCount(htmlMain)

  // registration_deadline : JSON-LD (offers.validThrough) en priorité, puis HTML
  if (jsonLd.registration_deadline !== null) {
    result.registration_deadline = jsonLd.registration_deadline
  } else {
    result.registration_deadline = extractRegistrationDeadlineFromHtml(htmlMain)
  }

  // swim_type : combiner toutes les pages disponibles pour maximiser la détection
  // 'river' est cherché en priorité absolue sur TOUTES les pages avant de concéder 'lac'
  const allHtmlForSwim = [htmlMain, htmlCourse, htmlGuide].filter(Boolean).join('\n')
  result.swim_type = detectSwimType(allHtmlForSwim)

  // Température de l'eau depuis la page principale
  result.avg_water_temp_celsius = extractWaterTemp(htmlMain)

  // Statut sold out depuis la page principale
  result.is_sold_out = extractSoldOut(htmlMain)

  // og:image fallback
  if (result.image_url === null) {
    const ogMatch = htmlMain.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    if (ogMatch && ogMatch[1].startsWith('http')) {
      result.image_url = ogMatch[1]
    }
  }

  // Ville depuis l'URL
  if (result.city === null) {
    result.city = cityFromUrl(url)
  }

  // Nom depuis l'URL (dernier recours)
  if (result.name === null) {
    result.name = nameFromUrl(url, format)
  }

  // og:description fallback
  if (result.description === null) {
    const ogDescMatch = htmlMain.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i)
    if (ogDescMatch && ogDescMatch[1].length > 20) {
      result.description = ogDescMatch[1].slice(0, 1000)
    }
  }

  // Pays par défaut si JSON-LD ne l'a pas fourni et URL contient des indices
  if (result.country === null) {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('/france/') || lowerUrl.includes('-fr-') || lowerUrl.includes('.fr/')) {
      result.country = 'FR'
    }
  }

  // 5. Merge page /course — override swim_type, ajoute dénivelé, GPX
  if (htmlCourse) {
    const course = parseCourseHtml(htmlCourse)
    // Ne pas rétrograder 'rivière' → 'lac' : la détection combinée a déjà trouvé 'rivière'
    if (course.swim_type !== null && !(result.swim_type === 'rivière' && course.swim_type === 'lac')) {
      result.swim_type = course.swim_type
    }
    if (course.bike_elevation !== null) result.bike_elevation = course.bike_elevation
    if (course.run_elevation !== null) result.run_elevation = course.run_elevation
    if (course.gpx_url !== null) result.gpx_url = course.gpx_url
    if (course.swim_gpx_url !== null) result.swim_gpx_url = course.swim_gpx_url
    if (course.bike_gpx_url !== null) result.bike_gpx_url = course.bike_gpx_url
    if (course.run_gpx_url !== null) result.run_gpx_url = course.run_gpx_url
    if (result.description === null && course.description !== null) result.description = course.description
    // Cutoffs depuis /course (priorité sur les valeurs par défaut du format)
    if (course.swim_cutoff_minutes !== null) result.swim_cutoff_minutes = course.swim_cutoff_minutes
    if (course.bike_cutoff_minutes !== null) result.bike_cutoff_minutes = course.bike_cutoff_minutes
    if (course.run_cutoff_minutes !== null) result.run_cutoff_minutes = course.run_cutoff_minutes
  }

  // 6. Merge page /register — prix réel, sold out, statut inscription, participants
  if (htmlRegister) {
    const reg = parseRegisterHtml(htmlRegister)
    if (reg.price_euros !== null) result.price_euros = reg.price_euros
    if (reg.registration_status !== null) result.registration_status = reg.registration_status
    if (reg.is_sold_out !== null) result.is_sold_out = reg.is_sold_out
    if (reg.registration_deadline !== null) result.registration_deadline = reg.registration_deadline
    if (reg.max_participants !== null) result.max_participants = reg.max_participants
  }

  // 7. Merge page /athletes-guide — cutoffs réels, météo, records
  if (htmlGuide) {
    const guide = parseAthletesGuideHtml(htmlGuide)
    if (guide.swim_cutoff_minutes !== null) result.swim_cutoff_minutes = guide.swim_cutoff_minutes
    if (guide.bike_cutoff_minutes !== null) result.bike_cutoff_minutes = guide.bike_cutoff_minutes
    if (guide.run_cutoff_minutes !== null) result.run_cutoff_minutes = guide.run_cutoff_minutes
    if (guide.avg_temp_celsius !== null) result.avg_temp_celsius = guide.avg_temp_celsius
    if (guide.avg_water_temp_celsius !== null) result.avg_water_temp_celsius = guide.avg_water_temp_celsius
    if (guide.avg_wind_kmh !== null) result.avg_wind_kmh = guide.avg_wind_kmh
    if (guide.record_men !== null) result.record_men = guide.record_men
    if (guide.record_women !== null) result.record_women = guide.record_women
    if (guide.is_wetsuit_allowed !== null) result.is_wetsuit_allowed = guide.is_wetsuit_allowed
    if (guide.qualification_for !== null) result.qualification_for = guide.qualification_for
  }

  // 8. Normaliser les URLs GPX relatives → absolues (Ironman utilise /sites/default/...)
  result.gpx_url = toAbsoluteIronmanUrl(result.gpx_url)
  result.swim_gpx_url = toAbsoluteIronmanUrl(result.swim_gpx_url)
  result.bike_gpx_url = toAbsoluteIronmanUrl(result.bike_gpx_url)
  result.run_gpx_url = toAbsoluteIronmanUrl(result.run_gpx_url)

  return result
}
