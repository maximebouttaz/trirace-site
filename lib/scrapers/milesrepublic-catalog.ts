// ---------------------------------------------------------------------------
// MilesRepublic Catalog Scraper — API Meilisearch
//
// MilesRepublic utilise Meilisearch comme moteur de recherche. La clé API est
// publique (exposée dans le bundle JS du navigateur, conçue pour ça).
// On peut récupérer les courses triathlon françaises futures en quelques appels
// paginés, sans scraping HTML.
//
// Endpoint : https://miles-meilisearch.onrender.com/multi-search
// Index : fra_events | Filter : catégories triathlon + courses futures
// Pagination : hitsPerPage=500
// ---------------------------------------------------------------------------

const MEILISEARCH_URL = 'https://miles-meilisearch.onrender.com/multi-search'
const MEILISEARCH_API_KEY =
  '907c3e336637f8ff56389dce5ce5ee339a5c9e38f0c7a29902e45c83810987b5'
const MILESREPUBLIC_BASE = 'https://fr.milesrepublic.com'
const HITS_PER_PAGE = 500

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MilesRepublicCatalogRace {
  name: string
  url: string           // https://fr.milesrepublic.com/en/event/[slug]
  slug: string
  date: string | null   // YYYY-MM-DD converti depuis Unix timestamp
  city: string | null
  country: string | null
  region: string | null
  department: string | null
  latitude: number | null
  longitude: number | null
  category: string | null  // catégorie principale TriRace (la plus grande)
  source: 'milesrepublic'
}

// Catégories MilesRepublic dans l'ordre de priorité croissante
const TRIATHLON_CATEGORIES = [
  'TRIATHLON_XS',
  'TRIATHLON_S',
  'TRIATHLON_M',
  'TRIATHLON_L',
  'TRIATHLON_XXL',
] as const

type MrCategory = typeof TRIATHLON_CATEGORIES[number]

// Mapping MilesRepublic → TriRace (priorité : plus grand = principal)
const CATEGORY_MAP: Record<MrCategory, string> = {
  TRIATHLON_XS: 'XS',
  TRIATHLON_S: 'S',
  TRIATHLON_M: 'M',
  TRIATHLON_L: 'L',
  TRIATHLON_XXL: 'Ironman',
}

interface MeilisearchHit {
  eventName: string
  eventSlug: string
  eventCity?: string
  eventCountry?: string
  eventCountrySubdivisionNameLevel1?: string
  eventCountrySubdivisionNameLevel2?: string
  _geo?: { lat: number; lng: number }
  editionLiveLevel2CategoryKey?: string[]
  editionLiveStartDateTimestamp?: number
  eventLivePriceStartingFrom?: number | null
  minPrice?: number | null
  editionCalendarStatus?: string
  eventStatus?: string
  [key: string]: unknown
}

interface MeilisearchResult {
  hits: MeilisearchHit[]
  totalHits: number
  totalPages: number
  page: number
  hitsPerPage: number
}

interface MeilisearchResponse {
  results: MeilisearchResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tsToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

function getPrimaryCategory(keys: string[]): string | null {
  // Priorité : plus grand = principal (XXL > L > M > S > XS)
  let best: MrCategory | null = null
  for (const key of keys) {
    const idx = TRIATHLON_CATEGORIES.indexOf(key as MrCategory)
    if (idx === -1) continue
    const bestIdx = best !== null ? TRIATHLON_CATEGORIES.indexOf(best) : -1
    if (idx > bestIdx) {
      best = key as MrCategory
    }
  }
  return best !== null ? CATEGORY_MAP[best] : null
}

function buildFilter(): string {
  const nowTs = Math.floor(Date.now() / 1000)
  const categories = TRIATHLON_CATEGORIES.map((c) => `"${c}"`).join(', ')
  return [
    `editionLiveEndDateTimestamp > ${nowTs}`,
    `editionLiveLevel2CategoryKey IN [${categories}]`,
    `eventStatus = "LIVE"`,
  ].join(' AND ')
}

// ---------------------------------------------------------------------------
// Fetch une page Meilisearch
// ---------------------------------------------------------------------------

async function fetchPage(
  page: number
): Promise<{ totalHits: number; totalPages: number; races: MilesRepublicCatalogRace[] }> {
  const body = JSON.stringify({
    queries: [
      {
        indexUid: 'fra_events',
        q: '',
        filter: buildFilter(),
        hitsPerPage: HITS_PER_PAGE,
        page,
      },
    ],
  })

  const res = await fetch(MEILISEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILISEARCH_API_KEY}`,
      Origin: 'https://fr.milesrepublic.com',
      Accept: 'application/json',
    },
    body,
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    throw new Error(`Meilisearch HTTP ${res.status}`)
  }

  const data = (await res.json()) as MeilisearchResponse
  const result = data.results?.[0]
  if (!result) return { totalHits: 0, totalPages: 0, races: [] }

  const races: MilesRepublicCatalogRace[] = []

  for (const hit of result.hits ?? []) {
    if (!hit.eventSlug) continue

    const categoryKeys = Array.isArray(hit.editionLiveLevel2CategoryKey)
      ? hit.editionLiveLevel2CategoryKey
      : []

    races.push({
      name: hit.eventName || hit.eventSlug,
      url: `${MILESREPUBLIC_BASE}/en/event/${hit.eventSlug}`,
      slug: hit.eventSlug,
      date:
        typeof hit.editionLiveStartDateTimestamp === 'number'
          ? tsToDate(hit.editionLiveStartDateTimestamp)
          : null,
      city: hit.eventCity ?? null,
      country: hit.eventCountry ?? null,
      region: hit.eventCountrySubdivisionNameLevel1 ?? null,
      department: hit.eventCountrySubdivisionNameLevel2 ?? null,
      latitude: hit._geo?.lat ?? null,
      longitude: hit._geo?.lng ?? null,
      category: getPrimaryCategory(categoryKeys),
      source: 'milesrepublic',
    })
  }

  return {
    totalHits: result.totalHits ?? 0,
    totalPages: result.totalPages ?? 1,
    races,
  }
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------

export async function scrapeMilesRepublicCatalog(): Promise<MilesRepublicCatalogRace[]> {
  const allRaces: MilesRepublicCatalogRace[] = []

  try {
    // Page 1 pour connaître le total
    const first = await fetchPage(1)
    allRaces.push(...first.races)

    console.log(
      `[milesrepublic-catalog] ${first.totalHits} triathlons trouvés sur Meilisearch.`
    )

    // Pages suivantes en parallèle
    if (first.totalPages > 1) {
      const pageNumbers = Array.from(
        { length: first.totalPages - 1 },
        (_, i) => i + 2
      )
      const results = await Promise.all(pageNumbers.map(fetchPage))
      for (const r of results) {
        allRaces.push(...r.races)
      }
    }
  } catch (err) {
    console.warn('[milesrepublic-catalog] Erreur Meilisearch :', err)
    return []
  }

  console.log(`[milesrepublic-catalog] ${allRaces.length} courses récupérées.`)
  return allRaces
}
