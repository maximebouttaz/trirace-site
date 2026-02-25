// ---------------------------------------------------------------------------
// Ironman Catalog Scraper
// Stratégie :
//   A) ironman.com/races avec headers browser (Next.js __NEXT_DATA__ ou liens href)
//   B) Fallback coachcox.co.uk pour les full distance
// Les 70.3 sont extraits depuis la même source ironman.com si possible,
// avec fallback sur l'analyse des slugs coachcox.
// ---------------------------------------------------------------------------

export interface CatalogRace {
  name: string
  url: string        // URL de la page ironman.com
  date: string | null  // format YYYY-MM-DD si possible
  city: string | null
  country: string | null
  format: 'full' | '70.3' | null  // inféré depuis le nom ou l'URL
  source: string     // 'ironman.com' | 'coachcox' | 'finishers'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectFormat(name: string, url: string): 'full' | '70.3' | null {
  const combined = `${name} ${url}`.toLowerCase()
  if (combined.includes('70.3') || combined.includes('703')) return '70.3'
  if (combined.includes('ironman') || combined.includes('/im-') || combined.includes('/ironman-')) return 'full'
  return null
}

function nameToIronmanSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('ironman 70.3', 'ironman-703')
    .replace('ironman', 'ironman')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseIsoDate(raw: string): string | null {
  // Accepte "2026-06-14T06:00:00Z", "June 14, 2026", "14/06/2026", etc.
  if (!raw) return null
  // ISO
  const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  // "Month DD, YYYY"
  const verboseMatch = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (verboseMatch) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    }
    const month = months[verboseMatch[1].toLowerCase()]
    if (month) {
      return `${verboseMatch[3]}-${month}-${verboseMatch[2].padStart(2, '0')}`
    }
  }
  return null
}

function deduplicateByUrl(races: CatalogRace[]): CatalogRace[] {
  const seen = new Set<string>()
  return races.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

// ---------------------------------------------------------------------------
// Étape A — ironman.com/races
// ---------------------------------------------------------------------------

async function scrapeIronmanDotCom(): Promise<CatalogRace[]> {
  let html: string
  try {
    const res = await fetch('https://www.ironman.com/races', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const races: CatalogRace[] = []

  // Tentative 1 : __NEXT_DATA__
  try {
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
    if (nextDataMatch?.[1]) {
      const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
      // Chercher récursivement les entrées avec startDate + name + url
      const items = extractRacesFromNextData(nextData)
      if (items.length > 0) {
        races.push(...items)
      }
    }
  } catch {
    // ignore JSON parse errors
  }

  // Tentative 2 : scraping des href /races/ironman-* ou /races/im*
  if (races.length === 0) {
    const hrefPattern = /href="(\/races\/(?:ironman[^"]*|im[^"]*))"/gi
    let match: RegExpExecArray | null
    while ((match = hrefPattern.exec(html)) !== null) {
      const path = match[1]
      // Exclure les chemins trop génériques ou avec extensions
      if (path === '/races' || path.includes('.') || path.split('/').length > 3) continue
      const url = `https://www.ironman.com${path}`
      const namePart = path.replace('/races/', '').replace(/-/g, ' ')
      const name = namePart
        .replace(/\b703\b/g, '70.3')
        .replace(/\bironian\b/gi, 'IRONMAN')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

      races.push({
        name,
        url,
        date: null,
        city: null,
        country: null,
        format: detectFormat(name, url),
        source: 'ironman.com',
      })
    }
  }

  return races
}

function extractRacesFromNextData(obj: unknown, depth = 0): CatalogRace[] {
  if (depth > 10 || typeof obj !== 'object' || obj === null) return []
  const results: CatalogRace[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...extractRacesFromNextData(item, depth + 1))
    }
    return results
  }

  const record = obj as Record<string, unknown>

  // Cherche un objet ressemblant à une course (a un name + url qui contient ironman.com/races)
  const url = typeof record.url === 'string' ? record.url : null
  const name = typeof record.name === 'string' ? record.name : null
  const startDate = typeof record.startDate === 'string' ? record.startDate :
                    typeof record.date === 'string' ? record.date : null

  if (
    name && url &&
    url.includes('ironman.com/races') &&
    (name.toLowerCase().includes('ironman') || name.toLowerCase().includes('70.3'))
  ) {
    const city = typeof record.city === 'string' ? record.city :
                 typeof record.location === 'string' ? record.location : null
    const country = typeof record.country === 'string' ? record.country : null

    results.push({
      name,
      url,
      date: startDate ? parseIsoDate(startDate) : null,
      city,
      country,
      format: detectFormat(name, url),
      source: 'ironman.com',
    })
    return results
  }

  for (const value of Object.values(record)) {
    results.push(...extractRacesFromNextData(value, depth + 1))
  }

  return results
}

// ---------------------------------------------------------------------------
// Étape B — Fallback coachcox.co.uk (full distance)
// ---------------------------------------------------------------------------

async function scrapeCoachCox(): Promise<CatalogRace[]> {
  let html: string
  try {
    const res = await fetch('https://www.coachcox.co.uk/imstats/im/', {
      headers: { 'User-Agent': 'TriRace/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const races: CatalogRace[] = []

  // Extraire les lignes de tableau ou liens contenant des noms de course Ironman
  // coachcox liste les courses dans des liens ou des cellules de table
  // Pattern : chercher les textes "IRONMAN ..." ou "Ironman ..."
  const rowPattern = /<(?:td|th|a)[^>]*>([^<]*(?:IRONMAN|Ironman)[^<]*)<\/(?:td|th|a)>/gi
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = rowPattern.exec(html)) !== null) {
    const rawName = match[1].trim()
    if (!rawName || rawName.length < 5) continue
    // Normaliser le nom
    const name = rawName
      .replace(/\s+/g, ' ')
      .replace(/IRONMAN/g, 'IRONMAN')
      .trim()

    if (seen.has(name)) continue
    seen.add(name)

    // Extraire la date si présente dans le contexte proche (±300 chars)
    const contextStart = Math.max(0, match.index - 200)
    const contextEnd = Math.min(html.length, match.index + match[0].length + 200)
    const context = html.slice(contextStart, contextEnd)

    const dateMatch = context.match(/(\d{1,2})[\/\-\s]([A-Za-z]+|\d{1,2})[\/\-\s](\d{4})/)
    let date: string | null = null
    if (dateMatch) {
      date = parseIsoDate(dateMatch[0])
    }

    const slug = nameToIronmanSlug(name)
    const url = `https://www.ironman.com/races/${slug}`

    races.push({
      name,
      url,
      date,
      city: null,
      country: null,
      format: detectFormat(name, url),
      source: 'coachcox',
    })
  }

  // Fallback : chercher les liens <a href> vers les pages ironman sur coachcox
  if (races.length === 0) {
    const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([^<]*(?:IRONMAN|Ironman|ironman)[^<]*)<\/a>/gi
    while ((match = linkPattern.exec(html)) !== null) {
      const rawName = match[2].trim()
      if (!rawName || seen.has(rawName)) continue
      seen.add(rawName)

      const slug = nameToIronmanSlug(rawName)
      const url = `https://www.ironman.com/races/${slug}`

      races.push({
        name: rawName,
        url,
        date: null,
        city: null,
        country: null,
        format: detectFormat(rawName, url),
        source: 'coachcox',
      })
    }
  }

  return races
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------

export async function scrapeIronmanCatalog(): Promise<CatalogRace[]> {
  // Étape A : ironman.com
  let races: CatalogRace[] = []
  try {
    races = await scrapeIronmanDotCom()
  } catch (err) {
    console.warn('[ironman-catalog] Étape A échouée :', err)
  }

  // Étape B : fallback coachcox si ironman.com n'a rien retourné
  if (races.length === 0) {
    try {
      races = await scrapeCoachCox()
    } catch (err) {
      console.warn('[ironman-catalog] Étape B (coachcox) échouée :', err)
    }
  }

  if (races.length === 0) {
    console.warn('[ironman-catalog] Toutes les sources ont échoué — catalogue vide.')
  }

  return deduplicateByUrl(races)
}
