import type { ScrapedFields } from '@/lib/scrape-fields'

/**
 * Supprime les balises HTML et les entités courantes pour obtenir le texte brut.
 * Utilisé pour les recherches regex sur le contenu visible de la page.
 */
function stripHtml(html: string): string {
  return html
    // Supprimer les blocs script et style en entier
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Supprimer toutes les balises HTML restantes
    .replace(/<[^>]+>/g, ' ')
    // Décoder les entités HTML courantes
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Normaliser les espaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convertit une valeur numérique et son unité en mètres.
 * Remplace la virgule par un point pour les décimaux FR.
 */
function toMeters(value: string, unit: string): number {
  const normalized = value.replace(',', '.')
  const num = parseFloat(normalized)
  if (isNaN(num)) return 0
  return unit.toLowerCase() === 'km' ? Math.round(num * 1000) : Math.round(num)
}

/**
 * Convertit un pattern "XhYY" ou "X:YY" ou "X:YY:ZZ" en minutes.
 * Ex: "1h10" → 70, "5h30" → 330, "1:10:00" → 70, "5:30" → 330
 */
function parseTimeToMinutes(raw: string): number | null {
  // Format "Xh" ou "XhYY" ou "Xh YY"
  const hMin = raw.match(/(\d+)\s*h\s*(\d+)?/i)
  if (hMin) {
    const hours = parseInt(hMin[1], 10)
    const mins  = parseInt(hMin[2] ?? '0', 10)
    return hours * 60 + mins
  }

  // Format "H:MM:SS" ou "H:MM"
  const colonFull = raw.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (colonFull) {
    return parseInt(colonFull[1], 10) * 60 + parseInt(colonFull[2], 10)
  }
  const colonShort = raw.match(/^(\d+):(\d{2})$/)
  if (colonShort) {
    return parseInt(colonShort[1], 10) * 60 + parseInt(colonShort[2], 10)
  }

  return null
}

/**
 * Extrait les distances natation / vélo / course depuis le texte brut de la page.
 * Supporte les notations FR et EN, avec l'unité avant ou après le sport.
 */
function extractDistances(text: string): {
  swim_distance: number | null
  bike_distance: number | null
  run_distance: number | null
} {
  // Patterns : distance + unité + sport
  const swimFwd = /(\d+[,.]\d+|\d+)\s*(km|m)\s*(?:de\s+)?(natation|nage|swim|swimming)/i
  const bikeFwd = /(\d+[,.]\d+|\d+)\s*(km|m)\s*(?:de\s+)?(v[eé]lo|bike|cycling|cyclisme)/i
  const runFwd  = /(\d+[,.]\d+|\d+)\s*(km|m)\s*(?:de\s+)?(course(?:\s+[aà]\s+pied)?|run(?:ning)?|cap|jogging)/i

  // Patterns inversés : sport + séparateur + distance + unité
  const swimBwd = /(natation|nage|swim(?:ming)?)\s*[:\-]?\s*(\d+[,.]\d+|\d+)\s*(km|m)/i
  const bikeBwd = /(v[eé]lo|bike|cycling|cyclisme)\s*[:\-]?\s*(\d+[,.]\d+|\d+)\s*(km|m)/i
  const runBwd  = /(course(?:\s+[aà]\s+pied)?|run(?:ning)?|cap)\s*[:\-]?\s*(\d+[,.]\d+|\d+)\s*(km|m)/i

  function matchDistance(fwd: RegExp, bwd: RegExp): number | null {
    const mFwd = text.match(fwd)
    if (mFwd) {
      const meters = toMeters(mFwd[1], mFwd[2])
      return meters > 0 ? meters : null
    }
    const mBwd = text.match(bwd)
    if (mBwd) {
      const meters = toMeters(mBwd[2], mBwd[3])
      return meters > 0 ? meters : null
    }
    return null
  }

  return {
    swim_distance: matchDistance(swimFwd, swimBwd),
    bike_distance: matchDistance(bikeFwd, bikeBwd),
    run_distance:  matchDistance(runFwd,  runBwd),
  }
}

/**
 * Extrait le prix en euros depuis le texte brut.
 * Privilégie les formulations explicites (tarif, prix…), puis le premier montant en € trouvé.
 */
function extractPrice(text: string): number | null {
  // Formulations explicites : "Prix : 75€", "tarif : 90 EUR", "à partir de 65€", "from €80"
  const explicitPattern = /(?:prix|tarif|price|from|[aà]\s+partir\s+de|d[eè]s)\s*[:\-]?\s*(?:€|EUR)?\s*(\d+(?:[,.]\d+)?)\s*(?:€|EUR)?/i
  const mExplicit = text.match(explicitPattern)
  if (mExplicit) {
    const val = parseFloat(mExplicit[1].replace(',', '.'))
    if (!isNaN(val) && val > 0 && val < 10000) return val
  }

  // Fallback : premier "XX€" ou "€XX" ou "XX EUR" trouvé dans la page
  const euroAfter  = /(\d+(?:[,.]\d+)?)\s*€/
  const euroBefore = /€\s*(\d+(?:[,.]\d+)?)/
  const euroEur    = /(\d+(?:[,.]\d+)?)\s*EUR/i

  for (const pattern of [euroAfter, euroBefore, euroEur]) {
    const m = text.match(pattern)
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(val) && val > 0 && val < 10000) return val
    }
  }

  return null
}

/**
 * Extrait le nombre maximum de participants depuis le texte brut.
 */
function extractMaxParticipants(text: string): number | null {
  // "3000 participants", "2 500 places", "1 500 inscrits", "5000 athletes"
  const pattern = /([\d][\d\s]{0,6}[\d])\s*(participants?|places?|inscrits?|athletes?|athlètes?)/i
  const m = text.match(pattern)
  if (!m) return null
  // Supprimer les espaces intercalés (séparateurs de milliers)
  const raw = m[1].replace(/\s/g, '')
  const val = parseInt(raw, 10)
  if (isNaN(val) || val < 10 || val > 100000) return null
  return val
}

/**
 * Extrait le lien d'inscription depuis le HTML brut (recherche dans les attributs href des balises <a>).
 * Retourne l'URL absolue si possible.
 */
function extractRegistrationUrl(html: string, baseUrl: string): string | null {
  // Regex pour capturer href + texte de lien dans les balises <a>
  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const keywords = /s['']?inscrire|inscription|register|sign[\s-]?up|s-inscrire|s'inscrire|je m'inscris|inscrivez/i

  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1]
    const linkText = stripHtml(match[2])

    if (keywords.test(linkText) || keywords.test(href)) {
      // Ignorer les ancres et les liens JavaScript
      if (href.startsWith('#') || href.startsWith('javascript:')) continue

      // Retourner une URL absolue
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href
      }
      try {
        return new URL(href, baseUrl).href
      } catch {
        return href
      }
    }
  }

  return null
}

/**
 * Extrait les barrières horaires (swim / bike / run) en minutes depuis le texte brut.
 * Supporte les formulations françaises et anglaises.
 */
function extractCutoffs(text: string): {
  swim_cutoff_minutes: number | null
  bike_cutoff_minutes: number | null
  run_cutoff_minutes: number | null
} {
  // Temps au format "1h10", "1h", "1:10:00", "1:10"
  const timePattern = /(\d+h\d*|\d+:\d{2}(?::\d{2})?)/i

  function extractCutoff(pattern: RegExp): number | null {
    const m = text.match(pattern)
    if (!m) return null
    const timeMatch = m[0].match(timePattern)
    if (!timeMatch) return null
    return parseTimeToMinutes(timeMatch[1])
  }

  // Natation
  const swimPattern = /(?:barri[eè]re\s+(?:natation|nage)|cutoff\s+swim|swim\s+cutoff|temps\s+limite\s+natation)\s*[:\-]?\s*(\d+h\d*|\d+:\d{2}(?::\d{2})?)/i
  const swimMatch = text.match(swimPattern)
  const swim_cutoff_minutes = swimMatch
    ? parseTimeToMinutes(swimMatch[1])
    : null

  // Vélo
  const bikePattern = /(?:barri[eè]re\s+(?:v[eé]lo|cyclisme)|cutoff\s+bike|bike\s+cutoff)\s*[:\-]?\s*(\d+h\d*|\d+:\d{2}(?::\d{2})?)/i
  const bikeMatch = text.match(bikePattern)
  const bike_cutoff_minutes = bikeMatch
    ? parseTimeToMinutes(bikeMatch[1])
    : null

  // Course à pied
  const runPattern = /(?:barri[eè]re\s+(?:course|cap)|cutoff\s+run|run\s+cutoff)\s*[:\-]?\s*(\d+h\d*|\d+:\d{2}(?::\d{2})?)/i
  const runMatch = text.match(runPattern)
  const run_cutoff_minutes = runMatch
    ? parseTimeToMinutes(runMatch[1])
    : null

  // Éviter l'avertissement "unused variable" sur extractCutoff (utilisé ci-dessous si besoin)
  void extractCutoff

  return { swim_cutoff_minutes, bike_cutoff_minutes, run_cutoff_minutes }
}

/**
 * Détecte le type de plan d'eau (natation) depuis le texte brut.
 */
function extractSwimType(text: string): ScrapedFields['swim_type'] {
  const lower = text.toLowerCase()
  if (/\bpiscine\b|\bpool\b/.test(lower)) return 'piscine'
  if (/\bmer\b|\bocean\b|\boc[eé]an\b|\bsea\b/.test(lower)) return 'mer'
  if (/\blac\b|\blake\b/.test(lower)) return 'lac'
  if (/\brivi[eè]re\b|\briver\b|\bfleuve\b/.test(lower)) return 'rivière'
  if (/\b[eé]tang\b|\bpond\b/.test(lower)) return 'étang'
  if (/open water/.test(lower)) return 'open water'
  return null
}

/**
 * Détecte le type de parcours vélo depuis le texte brut.
 */
function extractBikeType(text: string): ScrapedFields['bike_type'] {
  const lower = text.toLowerCase()
  if (/\bgravel\b/.test(lower)) return 'gravel'
  if (/\bvtt\b|\bmountain\s+bike\b|\bmtb\b/.test(lower)) return 'vtt'
  if (/\bmixte\b|\bmixed\b/.test(lower)) return 'mixte'
  if (/v[eé]lo\s+de\s+route\b|\broad\s+bike\b|\broute\b/.test(lower)) return 'route'
  return null
}

/**
 * Détecte si la combinaison de natation est autorisée ou interdite.
 */
function extractWetsuitAllowed(text: string): boolean | null {
  const lower = text.toLowerCase()
  if (
    /combinaison\s+autoris[eé]e|wetsuit\s+allowed|combinaison\s+recommand[eé]e|wetsuit\s+recommended/.test(lower)
  ) {
    return true
  }
  if (
    /combinaison\s+interdite|wetsuit\s+not\s+allowed|sans\s+combinaison|no\s+wetsuit/.test(lower)
  ) {
    return false
  }
  return null
}

/**
 * Détecte si le drafting est autorisé ou interdit.
 */
function extractDraftLegal(text: string): boolean | null {
  const lower = text.toLowerCase()
  if (/draft\s+l[eé]gal|drafting\s+autoris[eé]|draft\s+autoris[eé]/.test(lower)) return true
  if (/non[- ]drafting|draft\s+interdit|no\s+drafting|sans\s+drafting/.test(lower)) return false
  return null
}

/**
 * Extrait la date limite d'inscription (YYYY-MM-DD).
 */
function extractRegistrationDeadline(text: string): string | null {
  // FR : "inscriptions jusqu'au 15 mai 2026", "date limite d'inscription : 15/05/2026"
  // EN : "registration deadline : May 15, 2026"

  const frMonths: Record<string, number> = {
    janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
  }

  // Pattern FR textuel : "15 mai 2026"
  const frTextPattern =
    /(?:inscriptions?\s+jusqu['']?au|date\s+limite\s+d['']inscription\s*[:\-]?)\s+(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})/i
  const mFrText = text.match(frTextPattern)
  if (mFrText) {
    const day   = parseInt(mFrText[1], 10)
    const month = frMonths[mFrText[2].toLowerCase().replace('é', 'é')] ?? null
    const year  = parseInt(mFrText[3], 10)
    if (month) {
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
  }

  // Pattern numérique : "15/05/2026" ou "15-05-2026"
  const frNumPattern =
    /(?:inscriptions?\s+jusqu['']?au|date\s+limite\s+d['']inscription\s*[:\-]?)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i
  const mFrNum = text.match(frNumPattern)
  if (mFrNum) {
    const d = new Date(
      parseInt(mFrNum[3], 10),
      parseInt(mFrNum[2], 10) - 1,
      parseInt(mFrNum[1], 10)
    )
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  // Pattern EN : "registration deadline : May 15, 2026"
  const enPattern =
    /registration\s+deadline\s*[:\-]?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i
  const mEn = text.match(enPattern)
  if (mEn) {
    const d = new Date(`${mEn[1]} ${mEn[2]}, ${mEn[3]}`)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  return null
}

/**
 * Extrait les records hommes et femmes.
 * Formats acceptés : "7h42:15", "7:42:15"
 */
function extractRecords(text: string): { record_men: string | null; record_women: string | null } {
  // Pattern de temps : "7h42:15" ou "7:42:15"
  const timeRe = /(\d+h\d{2}:\d{2}|\d+:\d{2}:\d{2})/

  const menPattern =
    /(?:record\s+hommes?\s*[:\-]?|men['']?s?\s+record\s*[:\-]?)\s*(\d+h\d{2}:\d{2}|\d+:\d{2}:\d{2})/i
  const womenPattern =
    /(?:record\s+femmes?\s*[:\-]?|women['']?s?\s+record\s*[:\-]?)\s*(\d+h\d{2}:\d{2}|\d+:\d{2}:\d{2})/i

  const mMen   = text.match(menPattern)
  const mWomen = text.match(womenPattern)

  // Éviter l'avertissement sur timeRe si les patterns ci-dessus suffisent
  void timeRe

  return {
    record_men:   mMen   ? mMen[1]   : null,
    record_women: mWomen ? mWomen[1] : null,
  }
}

/**
 * Extrait la course/épreuve pour laquelle cette course est qualificative.
 */
function extractQualificationFor(text: string): string | null {
  const pattern =
    /(?:qualificatif\s+pour|slot\s+pour|qualification\s+pour|qualifying\s+race\s+for|qualify\s+for)\s+(.{3,100}?)(?:[.!?\n]|$)/i
  const m = text.match(pattern)
  if (!m) return null
  return m[1].trim().slice(0, 100) || null
}

/**
 * Extrait les tags depuis les meta keywords et les éléments HTML marqués comme tags.
 */
function extractTags(html: string): string[] | null {
  const tags: string[] = []

  // Meta keywords
  const metaKeywords =
    html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i)
  if (metaKeywords?.[1]) {
    const kws = metaKeywords[1].split(/[,;]/).map(k => k.trim()).filter(Boolean)
    tags.push(...kws)
  }

  // Éléments HTML avec class tag / badge / label / keyword
  const tagPattern = /<(?:a|span|div|li)[^>]+class=["'][^"']*\b(?:tag|badge|label|keyword)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|span|div|li)>/gi
  let m: RegExpExecArray | null
  while ((m = tagPattern.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim()
    if (text) tags.push(text)
  }

  // Dédupliquer, filtrer les vides, limiter à 10
  const unique = [...new Set(tags.map(t => t.trim()).filter(t => t.length > 0))].slice(0, 10)
  return unique.length > 0 ? unique : null
}

/**
 * Extrait le nombre de finishers depuis le texte brut (patterns supplémentaires).
 */
function extractFinishersCount(text: string): number | null {
  // "1250 finishers", "1 250 finishers", "1250 arrivants", "1 250 arrivants"
  const pattern = /([\d][\d\s]{0,6}[\d])\s*(finishers?|arrivants?)/i
  const m = text.match(pattern)
  if (!m) return null
  const raw = m[1].replace(/\s/g, '')
  const val = parseInt(raw, 10)
  if (isNaN(val) || val < 10 || val > 50000) return null
  return val
}

/**
 * Extrait l'URL du fichier GPX depuis le HTML brut.
 * Résout les URLs relatives.
 */
function extractGpxUrl(html: string, baseUrl: string): string | null {
  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const textKeywords = /gpx|t[eé]l[eé]charger\s+le\s+parcours|download\s+(?:track|gpx)/i

  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(html)) !== null) {
    const href     = match[1]
    const linkText = stripHtml(match[2])

    const isGpxHref = /\.gpx$/i.test(href) || /[?&/]gpx/i.test(href)
    const isGpxText = textKeywords.test(linkText)

    if (isGpxHref || isGpxText) {
      if (href.startsWith('#') || href.startsWith('javascript:')) continue

      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href
      }
      try {
        return new URL(href, baseUrl).href
      } catch {
        return href
      }
    }
  }

  return null
}

/**
 * Extrait les URLs GPX par discipline (natation, vélo, course à pied) depuis le HTML brut.
 * Cherche dans les href et le texte des liens <a> des mots-clés de discipline combinés
 * avec l'extension .gpx ou le mot "gpx".
 */
function extractDisciplineGpxUrls(
  html: string,
  baseUrl: string
): { swim_gpx_url: string | null; bike_gpx_url: string | null; run_gpx_url: string | null } {
  const result = { swim_gpx_url: null as string | null, bike_gpx_url: null as string | null, run_gpx_url: null as string | null }

  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  const swimHrefKw = /swim|natation|nage/i
  const bikeHrefKw = /bike|velo|v[eé]lo|cyclisme/i
  const runHrefKw  = /run|course|cap/i

  const swimTextKw = /swim|natation|nage/i
  const bikeTextKw = /bike|v[eé]lo|cyclisme/i
  const runTextKw  = /run|course\s+[aà]\s+pied|cap/i

  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html)) !== null) {
    const href     = match[1]
    const linkText = stripHtml(match[2])

    // Le lien doit concerner un GPX
    const isGpxHref = /\.gpx$/i.test(href) || /[?&/]gpx/i.test(href)
    const isGpxText = /\bgpx\b/i.test(linkText)

    if (!isGpxHref && !isGpxText) continue
    if (href.startsWith('#') || href.startsWith('javascript:')) continue

    // Résolution d'URL
    let resolvedHref = href
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      try {
        resolvedHref = new URL(href, baseUrl).href
      } catch {
        resolvedHref = href
      }
    }

    // Qualifier la discipline via href puis texte du lien
    if (result.swim_gpx_url === null && (swimHrefKw.test(href) || swimTextKw.test(linkText))) {
      result.swim_gpx_url = resolvedHref
    } else if (result.bike_gpx_url === null && (bikeHrefKw.test(href) || bikeTextKw.test(linkText))) {
      result.bike_gpx_url = resolvedHref
    } else if (result.run_gpx_url === null && (runHrefKw.test(href) || runTextKw.test(linkText))) {
      result.run_gpx_url = resolvedHref
    }

    // Arrêt anticipé si tous les champs sont remplis
    if (result.swim_gpx_url !== null && result.bike_gpx_url !== null && result.run_gpx_url !== null) break
  }

  return result
}

/**
 * Scraper générique — extrait les champs depuis n'importe quelle page web de course.
 *
 * Stratégie d'extraction par priorité :
 *   1. Balises Open Graph (og:title, og:image, og:description, og:url)
 *   2. Meta name="description" (fallback description)
 *   3. JSON-LD SportsEvent / Event (date, lieu, géo, prix, organisateur)
 *   4. __NEXT_DATA__ (géolocalisation sur sites Next.js)
 *   5. Regex sur le texte brut (distances, prix, participants, inscription)
 *   6. Regex enrichis (barrières, swim_type, bike_type, combinaison, drafting,
 *      deadline inscription, records, qualification, finishers, GPX, tags)
 */
export function scrapeGeneric(url: string, html: string): ScrapedFields {
  const result: ScrapedFields = {
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
    source: 'generic',
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

  // ─── 1. Open Graph ──────────────────────────────────────────────────────────

  const ogImageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  result.image_url = ogImageMatch?.[1] ?? null

  const ogDescMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
  result.description = ogDescMatch?.[1] ?? null

  // Fallback meta[name=description]
  if (!result.description) {
    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
    result.description = metaDescMatch?.[1] ?? null
  }

  if (result.description && result.description.length > 500) {
    result.description = result.description.slice(0, 500)
  }

  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
  result.name = ogTitleMatch?.[1] ?? null

  const ogUrlMatch =
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i)
  result.website_url = ogUrlMatch?.[1] ?? url

  // ─── 2. JSON-LD ─────────────────────────────────────────────────────────────

  const jsonLdMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const match of jsonLdMatches) {
    try {
      const json: unknown = JSON.parse(match[1])
      const items: unknown[] = Array.isArray(json) ? json : [json]

      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const obj = item as Record<string, unknown>

        const type = obj['@type']
        const isEvent = type === 'SportsEvent' || type === 'Event'
        if (!isEvent) continue

        // startDate
        if (!result.date && obj.startDate) {
          result.date = String(obj.startDate).slice(0, 10)
        }

        // name fallback
        if (!result.name && obj.name) {
          result.name = String(obj.name)
        }

        // description fallback
        if (!result.description && obj.description) {
          let desc = String(obj.description)
          if (desc.length > 500) desc = desc.slice(0, 500)
          result.description = desc
        }

        // location (city, country, lat, lng)
        const loc = obj.location
        if (typeof loc === 'object' && loc !== null) {
          const locObj = loc as Record<string, unknown>

          const address = locObj.address
          if (typeof address === 'object' && address !== null) {
            const addr = address as Record<string, unknown>
            if (!result.city && addr.addressLocality) {
              result.city = String(addr.addressLocality)
            }
            if (!result.country && addr.addressCountry) {
              result.country = String(addr.addressCountry)
            }
            if (!result.region && addr.addressRegion) {
              result.region = String(addr.addressRegion)
            }
          }

          const geo = locObj.geo
          if (typeof geo === 'object' && geo !== null) {
            const geoObj = geo as Record<string, unknown>
            if (result.latitude === null && geoObj.latitude != null) {
              result.latitude = Number(geoObj.latitude) || null
            }
            if (result.longitude === null && geoObj.longitude != null) {
              result.longitude = Number(geoObj.longitude) || null
            }
          }
        }

        // offers -> price
        const offers = obj.offers
        if (offers != null && result.price_euros === null) {
          const offersObj = typeof offers === 'object' ? (offers as Record<string, unknown>) : null
          const price = offersObj?.price ?? offersObj?.lowPrice
          if (price != null) {
            result.price_euros = Number(price) || null
          }
        }

        // organizer
        const organizer = obj.organizer
        if (organizer != null && result.organizer_name === null) {
          if (typeof organizer === 'string') {
            result.organizer_name = organizer
          } else if (typeof organizer === 'object') {
            const orgObj = organizer as Record<string, unknown>
            result.organizer_name = orgObj.name ? String(orgObj.name) : null
          }
        }
      }
    } catch {
      // JSON-LD invalide — on ignore
    }
  }

  // Fallback date : parcourir à nouveau en cherchant startDate à n'importe quel niveau
  if (!result.date) {
    const jsonLdMatches2 = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
    for (const match of jsonLdMatches2) {
      try {
        const json = JSON.parse(match[1]) as Record<string, unknown>
        const startDate =
          json?.startDate ??
          (json?.event as Record<string, unknown> | undefined)?.startDate
        if (startDate) {
          result.date = String(startDate).slice(0, 10)
          break
        }
      } catch {
        // skip
      }
    }
  }

  // ─── 3. __NEXT_DATA__ (géolocalisation sur sites Next.js) ───────────────────

  if (result.latitude === null || result.longitude === null) {
    const nextDataMatch = html.match(
      /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/
    )
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
        const props = (nextData?.props as Record<string, unknown>)?.pageProps as
          | Record<string, unknown>
          | undefined

        const lat =
          (props?.event as Record<string, unknown> | undefined)?.latitude ??
          (props?.race as Record<string, unknown> | undefined)?.latitude ??
          props?.latitude
        const lon =
          (props?.event as Record<string, unknown> | undefined)?.longitude ??
          (props?.race as Record<string, unknown> | undefined)?.longitude ??
          props?.longitude

        if (lat != null && lon != null) {
          result.latitude = Number(lat) || null
          result.longitude = Number(lon) || null
        }
      } catch {
        // skip
      }
    }
  }

  // ─── 4. Regex sur le texte brut ─────────────────────────────────────────────

  const text = stripHtml(html)

  // Distances (natation, vélo, course)
  const distances = extractDistances(text)
  if (result.swim_distance === null) result.swim_distance = distances.swim_distance
  if (result.bike_distance === null) result.bike_distance = distances.bike_distance
  if (result.run_distance === null) result.run_distance = distances.run_distance

  // Prix
  if (result.price_euros === null) {
    result.price_euros = extractPrice(text)
  }

  // Participants max
  if (result.max_participants === null) {
    result.max_participants = extractMaxParticipants(text)
  }

  // ─── 5. Lien d'inscription (depuis le HTML brut) ─────────────────────────────

  if (result.registration_url === null) {
    result.registration_url = extractRegistrationUrl(html, url)
  }

  // ─── 6. Regex enrichis (nouveaux champs) ────────────────────────────────────

  // Barrières horaires
  const cutoffs = extractCutoffs(text)
  if (result.swim_cutoff_minutes === null) result.swim_cutoff_minutes = cutoffs.swim_cutoff_minutes
  if (result.bike_cutoff_minutes === null) result.bike_cutoff_minutes = cutoffs.bike_cutoff_minutes
  if (result.run_cutoff_minutes  === null) result.run_cutoff_minutes  = cutoffs.run_cutoff_minutes

  // Type de plan d'eau
  if (result.swim_type === null) result.swim_type = extractSwimType(text)

  // Type de parcours vélo
  if (result.bike_type === null) result.bike_type = extractBikeType(text)

  // Combinaison de natation
  if (result.is_wetsuit_allowed === null) result.is_wetsuit_allowed = extractWetsuitAllowed(text)

  // Drafting
  if (result.is_draft_legal === null) result.is_draft_legal = extractDraftLegal(text)

  // Date limite d'inscription
  if (result.registration_deadline === null) {
    result.registration_deadline = extractRegistrationDeadline(text)
  }

  // Records hommes / femmes
  const records = extractRecords(text)
  if (result.record_men   === null) result.record_men   = records.record_men
  if (result.record_women === null) result.record_women = records.record_women

  // Qualification
  if (result.qualification_for === null) {
    result.qualification_for = extractQualificationFor(text)
  }

  // Tags (depuis le HTML brut + meta keywords)
  if (result.tags === null) result.tags = extractTags(html)

  // Nombre de finishers
  if (result.finishers_count === null) result.finishers_count = extractFinishersCount(text)

  // URL du fichier GPX
  if (result.gpx_url === null) result.gpx_url = extractGpxUrl(html, url)

  // URLs GPX par discipline
  const disciplineGpx = extractDisciplineGpxUrls(html, url)
  if (result.swim_gpx_url === null) result.swim_gpx_url = disciplineGpx.swim_gpx_url
  if (result.bike_gpx_url === null) result.bike_gpx_url = disciplineGpx.bike_gpx_url
  if (result.run_gpx_url  === null) result.run_gpx_url  = disciplineGpx.run_gpx_url

  // Sold out
  const soldOutMatch = text.match(/(?:registration\s+)?sold\s+out|inscriptions?\s+(?:ferm[ée]es?|compl[eè]tes?)/i)
  if (soldOutMatch) result.is_sold_out = true

  return result
}
