import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { ScrapedFields } from '@/lib/scrape-fields'
import { detectSource } from '@/lib/scrapers/detect'
import { scrapeFinishers } from '@/lib/scrapers/finishers'
import { scrapeMilesRepublic } from '@/lib/scrapers/milesrepublic'
import { scrapeIronman } from '@/lib/scrapers/ironman'
import { scrapeGeneric } from '@/lib/scrapers/generic'

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
// Timeout global augmenté à 20s pour laisser le temps aux 4 fetches parallèles
// ---------------------------------------------------------------------------

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

  return NextResponse.json(result)
}
