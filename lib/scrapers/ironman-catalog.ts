// ---------------------------------------------------------------------------
// Ironman Catalog Scraper — sitemap XML
// Stratégie :
//   1. Fetcher https://www.ironman.com/sitemap.xml (index) → 4 sous-sitemaps
//   2. Fetcher chaque sous-sitemap https://www.ironman.com/sitemap.xml?page=N
//   3. Parser les <url> dont <loc> matche /races/[slug-direct] (pas de sous-chemin)
//   4. Retourner CatalogRace[] dédupliqué par URL
// ---------------------------------------------------------------------------

export interface CatalogRace {
  name: string        // construit depuis le slug (ex: "im703-texas" → "IRONMAN 70.3 Texas")
  url: string         // URL complète ironman.com
  date: string | null // format YYYY-MM-DD si possible
  city: string | null
  country: string | null
  format: 'full' | '70.3' | '5150' | null
  source: string      // 'sitemap'
  lastmod: string | null // ISO date string du lastmod sitemap
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectFormat(slug: string): 'full' | '70.3' | '5150' | null {
  if (slug.includes('703') || slug.includes('70-3')) return '70.3'
  if (slug.includes('5150')) return '5150'
  if (slug.startsWith('im-')) return 'full'
  return null
}

function slugToName(slug: string): string {
  // im703-texas → "IRONMAN 70.3 Texas"
  // im-new-zealand → "IRONMAN New Zealand"
  // 5150-guimaras → "5150 Guimaras"
  let working = slug

  if (working.startsWith('im703-') || working.startsWith('im703')) {
    working = working.replace(/^im703-?/, '')
    const location = working
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `IRONMAN 70.3 ${location}`
  }

  if (working.startsWith('im-')) {
    working = working.replace(/^im-/, '')
    const location = working
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `IRONMAN ${location}`
  }

  if (working.startsWith('5150-')) {
    working = working.replace(/^5150-/, '')
    const location = working
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `5150 ${location}`
  }

  // Cas générique : capitaliser chaque mot
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function deduplicateByUrl(races: CatalogRace[]): CatalogRace[] {
  const seen = new Set<string>()
  return races.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

// Extrait toutes les paires <loc>...</loc><lastmod>...</lastmod> d'un XML de sitemap
function parseUrlsFromSitemap(xml: string): Array<{ loc: string; lastmod: string | null }> {
  const results: Array<{ loc: string; lastmod: string | null }> = []
  // Pattern : <url>...</url> blocs
  const urlBlockPattern = /<url>([\s\S]*?)<\/url>/g
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = urlBlockPattern.exec(xml)) !== null) {
    const block = blockMatch[1]

    const locMatch = block.match(/<loc>(.*?)<\/loc>/)
    if (!locMatch) continue
    const loc = locMatch[1].trim()

    const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/)
    const lastmod = lastmodMatch ? lastmodMatch[1].trim() : null

    results.push({ loc, lastmod })
  }

  return results
}

// ---------------------------------------------------------------------------
// Fetch d'un sous-sitemap et extraction des courses
// ---------------------------------------------------------------------------

async function fetchSubSitemap(url: string): Promise<CatalogRace[]> {
  let xml: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TriRace/1.0 (sitemap crawler)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn(`[ironman-catalog] Sous-sitemap ${url} → HTTP ${res.status}`)
      return []
    }
    xml = await res.text()
  } catch (err) {
    console.warn(`[ironman-catalog] Fetch échoué pour ${url} :`, err)
    return []
  }

  const entries = parseUrlsFromSitemap(xml)
  const races: CatalogRace[] = []

  for (const { loc, lastmod } of entries) {
    // Garder uniquement les URLs qui matchent /races/[slug-direct] sans sous-chemin
    // ex: https://www.ironman.com/races/im703-texas ✓
    // ex: https://www.ironman.com/races/im703-texas/registration ✗
    const racePathMatch = loc.match(/^https?:\/\/www\.ironman\.com\/races\/([a-z0-9][a-z0-9-]*)$/)
    if (!racePathMatch) continue

    const slug = racePathMatch[1]
    const format = detectFormat(slug)
    const name = slugToName(slug)

    races.push({
      name,
      url: loc,
      date: null,
      city: null,
      country: null,
      format,
      source: 'sitemap',
      lastmod: lastmod ?? null,
    })
  }

  return races
}

// ---------------------------------------------------------------------------
// Fetch du sitemap index pour découvrir les sous-sitemaps
// ---------------------------------------------------------------------------

async function fetchSitemapIndex(): Promise<string[]> {
  let xml: string
  try {
    const res = await fetch('https://www.ironman.com/sitemap.xml', {
      headers: { 'User-Agent': 'TriRace/1.0 (sitemap crawler)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn(`[ironman-catalog] Sitemap index → HTTP ${res.status}`)
      return []
    }
    xml = await res.text()
  } catch (err) {
    console.warn('[ironman-catalog] Fetch sitemap index échoué :', err)
    return []
  }

  // Chercher les <loc> dans les <sitemap> du sitemapindex
  const sitemapUrls: string[] = []
  const sitemapBlockPattern = /<sitemap>([\s\S]*?)<\/sitemap>/g
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = sitemapBlockPattern.exec(xml)) !== null) {
    const locMatch = blockMatch[1].match(/<loc>(.*?)<\/loc>/)
    if (locMatch) {
      sitemapUrls.push(locMatch[1].trim())
    }
  }

  // Si aucun sous-sitemap trouvé dans un sitemapindex standard,
  // tenter la convention ?page=N (pages 1 à 4)
  if (sitemapUrls.length === 0) {
    console.warn('[ironman-catalog] Index sans <sitemap> — fallback pages 1-4')
    for (let page = 1; page <= 4; page++) {
      sitemapUrls.push(`https://www.ironman.com/sitemap.xml?page=${page}`)
    }
  }

  return sitemapUrls
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------

export async function scrapeIronmanCatalog(): Promise<CatalogRace[]> {
  // 1. Récupérer la liste des sous-sitemaps
  const subSitemapUrls = await fetchSitemapIndex()

  if (subSitemapUrls.length === 0) {
    console.warn('[ironman-catalog] Aucun sous-sitemap découvert — catalogue vide.')
    return []
  }

  // 2. Fetcher tous les sous-sitemaps en parallèle
  const results = await Promise.all(subSitemapUrls.map(fetchSubSitemap))
  const allRaces = results.flat()

  if (allRaces.length === 0) {
    console.warn('[ironman-catalog] Aucune course extraite depuis les sitemaps.')
  }

  // 3. Déduplication par URL
  return deduplicateByUrl(allRaces)
}
