// ---------------------------------------------------------------------------
// Finishers.com Catalog Scraper — API Typesense
//
// Finishers utilise Typesense comme moteur de recherche. La clé API est
// publique (exposée dans le bundle JS du navigateur, conçue pour ça).
// On peut récupérer l'intégralité des courses triathlon en quelques appels
// paginés, sans scraping HTML.
//
// Endpoint : https://vn2qtcjsbg0ea481p.a1.typesense.net/multi_search
// Collection : races | Filter : raceDiscipline:=[triathlon]
// Pagination : per_page=250 (max Typesense), ~4 pages pour ~861 events
// ---------------------------------------------------------------------------

const TYPESENSE_URL =
  'https://vn2qtcjsbg0ea481p.a1.typesense.net/multi_search?x-typesense-api-key=G1BPjGr3KDU7n6yylcfOREpRVGUBpKYW'

const FINISHERS_BASE = 'https://www.finishers.com'
const PER_PAGE = 250

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface FinishersCatalogRace {
  name: string
  url: string           // https://www.finishers.com/course/[slug]
  slug: string
  date: string | null   // YYYY-MM-DD
  city: string | null
  country: string | null  // code ISO 2 lettres (ex: "FR", "ES")
  countryName: string | null  // nom en français (ex: "France")
  source: 'finishers'
}

interface TypesenseDocument {
  eventSlug: string
  eventName: string
  city?: string
  countryCode?: string
  country?: string
  editionStartDate?: string
  [key: string]: unknown
}

interface TypesenseHit {
  document: TypesenseDocument
}

interface TypesenseGroupedHit {
  hits: TypesenseHit[]
}

interface TypesenseResult {
  found: number
  grouped_hits?: TypesenseGroupedHit[]
}

interface TypesenseResponse {
  results: TypesenseResult[]
}

// ---------------------------------------------------------------------------
// Fetch une page Typesense
// ---------------------------------------------------------------------------

async function fetchPage(page: number): Promise<{ found: number; races: FinishersCatalogRace[] }> {
  const body = JSON.stringify({
    searches: [
      {
        query_by: 'eventName',
        sort_by: 'boosted:desc,raceDate:asc',
        group_by: 'eventId',
        group_limit: 1,
        collection: 'races',
        q: '*',
        filter_by: 'raceDiscipline:=[`triathlon`]',
        page,
        per_page: PER_PAGE,
      },
    ],
  })

  const res = await fetch(TYPESENSE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain',
      'origin': 'https://www.finishers.com',
      'accept': 'application/json',
    },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Typesense HTTP ${res.status}`)
  }

  const data = (await res.json()) as TypesenseResponse
  const result = data.results?.[0]
  if (!result) return { found: 0, races: [] }

  const found = result.found ?? 0
  const races: FinishersCatalogRace[] = []

  for (const group of result.grouped_hits ?? []) {
    const hit = group.hits?.[0]
    if (!hit?.document) continue

    const doc = hit.document
    if (!doc.eventSlug) continue

    races.push({
      name: doc.eventName || slugToName(doc.eventSlug),
      url: `${FINISHERS_BASE}/course/${doc.eventSlug}`,
      slug: doc.eventSlug,
      date: doc.editionStartDate ?? null,
      city: doc.city ?? null,
      country: doc.countryCode ?? null,
      countryName: doc.country ?? null,
      source: 'finishers',
    })
  }

  return { found, races }
}

// ---------------------------------------------------------------------------
// Helper : slug → nom lisible
// ---------------------------------------------------------------------------

export function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------

export async function scrapeFinishersCatalog(): Promise<FinishersCatalogRace[]> {
  const allRaces: FinishersCatalogRace[] = []
  let totalFound = 0

  try {
    // Page 1 pour connaître le total
    const first = await fetchPage(1)
    totalFound = first.found
    allRaces.push(...first.races)

    console.log(`[finishers-catalog] ${totalFound} triathlons trouvés sur Typesense.`)

    // Pages suivantes en parallèle
    const totalPages = Math.ceil(totalFound / PER_PAGE)
    if (totalPages > 1) {
      const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
      const results = await Promise.all(pageNumbers.map(fetchPage))
      for (const r of results) {
        allRaces.push(...r.races)
      }
    }
  } catch (err) {
    console.warn('[finishers-catalog] Erreur Typesense :', err)
    return []
  }

  console.log(`[finishers-catalog] ${allRaces.length} courses récupérées.`)
  return allRaces
}
