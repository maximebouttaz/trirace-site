import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { ScrapedFields } from '@/lib/scrape-fields'
import { detectSource } from '@/lib/scrapers/detect'
import { scrapeFinishers } from '@/lib/scrapers/finishers'
import { scrapeMilesRepublic } from '@/lib/scrapers/milesrepublic'
import { scrapeIronman } from '@/lib/scrapers/ironman'
import { scrapeGeneric } from '@/lib/scrapers/generic'
import { parseGPX } from '@/lib/gpx-parser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    return res.text()
  } catch {
    return ''
  }
}

function extractIronmanSlug(url: string): string {
  // https://www.ironman.com/races/im703-vichy → "im703-vichy"
  // https://www.ironman.com/races/im703-vichy/course → "im703-vichy"
  try {
    const { pathname } = new URL(url)
    const segments = pathname.split('/').filter(Boolean)
    // segments[0] = "races", segments[1] = "im703-vichy"
    const racesIdx = segments.indexOf('races')
    if (racesIdx !== -1 && segments[racesIdx + 1]) {
      return segments[racesIdx + 1]
    }
  } catch {
    // URL invalide
  }
  return ''
}

// ---------------------------------------------------------------------------
// Route POST — scraping à la demande (admin uniquement)
// Timeout global augmenté à 60s pour laisser le temps aux fetches parallèles + GPX
// ---------------------------------------------------------------------------

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'URL manquante.' }, { status: 400 })
  }

  const { url } = body as { url: string }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return NextResponse.json({ error: 'URL invalide (doit commencer par http).' }, { status: 400 })
  }

  const source = detectSource(url)

  let result: ScrapedFields

  if (source === 'ironman') {
    // Fetch multi-pages en parallèle (timeout global 20s)
    const slug = extractIronmanSlug(url)
    const base = slug
      ? `https://www.ironman.com/races/${slug}`
      : url.split('?')[0].replace(/\/(course|register|athletes-guide)\/?$/, '')

    const [htmlMain, htmlCourse, htmlRegister, htmlGuide] = await Promise.allSettled([
      fetchPage(base),
      fetchPage(`${base}/course`),
      fetchPage(`${base}/register`),
      fetchPage(`${base}/athletes-guide`),
    ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : '')))

    if (!htmlMain) {
      return NextResponse.json({ error: 'Fetch echoue — page principale inaccessible.' }, { status: 502 })
    }

    result = scrapeIronman(url, htmlMain, htmlCourse, htmlRegister, htmlGuide)

    // Download and parse GPX files in parallel
    const gpxEntries = [
      { key: 'swim', url: result.swim_gpx_url },
      { key: 'bike', url: result.bike_gpx_url },
      { key: 'run', url: result.run_gpx_url },
    ].filter((g): g is { key: string; url: string } => g.url != null)

    if (gpxEntries.length > 0) {
      const gpxTexts = await Promise.allSettled(
        gpxEntries.map(async ({ url: gpxUrl }) => {
          const r = await fetch(gpxUrl, { signal: AbortSignal.timeout(15000) })
          if (!r.ok) throw new Error(`${r.status}`)
          return r.text()
        })
      )

      const trackSeg: Record<string, unknown> = {}
      const elevSeg: Record<string, unknown> = {}

      for (let i = 0; i < gpxEntries.length; i++) {
        const textResult = gpxTexts[i]
        if (textResult.status === 'rejected') continue
        try {
          const { trackGeoJSON, elevationProfile } = parseGPX(textResult.value)
          trackSeg[gpxEntries[i].key] = trackGeoJSON
          elevSeg[gpxEntries[i].key] = elevationProfile
        } catch {
          // ignore parse errors silently
        }
      }

      if (Object.keys(trackSeg).length > 0) {
        result.track_geojson = trackSeg
        result.elevation_profile = elevSeg
      }
    }
  } else {
    // Fetch simple pour les autres sources
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch echoue (${res.status}).` }, { status: 502 })
    }

    const html = await res.text()

    switch (source) {
      case 'finishers':
        result = scrapeFinishers(url, html)
        break
      case 'milesrepublic':
        result = scrapeMilesRepublic(url, html)
        break
      default:
        result = scrapeGeneric(url, html)
    }
  }

  // Auto-géocodage si city présent mais coordonnées absentes
  if (result.city && (!result.latitude || !result.longitude)) {
    try {
      const query = `${result.city}, ${result.country || 'France'}`
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'TriRace/1.0 admin-scraper' },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (geoRes.ok) {
        const geoData = await geoRes.json()
        if (geoData?.[0]) {
          result.latitude = parseFloat(geoData[0].lat)
          result.longitude = parseFloat(geoData[0].lon)
        }
      }
    } catch {
      // Géocodage échoué → on continue sans coordonnées
    }
  }

  return NextResponse.json(result)
}
