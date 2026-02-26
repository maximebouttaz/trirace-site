import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { scrapeFinishersCatalog } from '@/lib/scrapers/finishers-catalog'
import type { FinishersCatalogRace } from '@/lib/scrapers/finishers-catalog'

// Typesense : ~4 requêtes parallèles de 15s max chacune
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Types de réponse
// ---------------------------------------------------------------------------

interface CatalogRaceWithStatus extends FinishersCatalogRace {
  format: null  // toujours null pour Finishers (pas de format détectable au listing)
  lastmod: null
  status: 'new' | 'exists' | 'pending' | 'missing' | 'updated'
  db_id?: number
  db_slug?: string
  db_updated_at?: string
}

interface CatalogStats {
  total: number
  new: number
  existing: number
  pending: number
}

interface CatalogResponse {
  catalog: CatalogRaceWithStatus[]
  stats: CatalogStats
  scraped_at: string
}

// ---------------------------------------------------------------------------
// Helper — extraire un slug depuis une finishers_url stockée en DB
// Supporte : /course/[slug] et /en/event/[slug]
// ---------------------------------------------------------------------------

function slugFromFinishersUrl(url: string): string | null {
  const courseMatch = url.match(/\/course\/([^/?#]+)/)
  if (courseMatch) return courseMatch[1]

  const eventMatch = url.match(/\/en\/event\/([^/?#]+)/)
  if (eventMatch) return eventMatch[1]

  return null
}

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/finishers
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient()

  // Auth — admin uniquement (même pattern que les autres routes admin)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse.' }, { status: 403 })
  }

  // Scraping du catalogue Finishers
  let catalogRaces: FinishersCatalogRace[]
  try {
    catalogRaces = await scrapeFinishersCatalog()
  } catch (err) {
    console.error('[GET /api/admin/catalog/finishers] scraping failed:', err)
    return NextResponse.json({ error: 'Scraping du catalogue échoué.' }, { status: 502 })
  }

  // Catalogue vide — retourner une réponse propre avec stats à zéro
  if (catalogRaces.length === 0) {
    const emptyResponse: CatalogResponse = {
      catalog: [],
      stats: { total: 0, new: 0, existing: 0, pending: 0 },
      scraped_at: new Date().toISOString(),
    }
    return NextResponse.json(emptyResponse)
  }

  // Récupérer les courses existantes en DB qui ont une finishers_url
  const { data: dbRaces, error: dbError } = await supabase
    .from('races')
    .select('id, slug, name, finishers_url, needs_review, updated_at')
    .is('deleted_at', null)
    .not('finishers_url', 'is', null)

  if (dbError) {
    console.error('[GET /api/admin/catalog/finishers] DB query failed:', dbError)
    return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 })
  }

  const existingRaces = dbRaces ?? []

  // Construire un Map slug → race DB pour la recherche rapide
  const bySlug = new Map<string, typeof existingRaces[number]>()

  for (const race of existingRaces) {
    if (!race.finishers_url) continue
    const slug = slugFromFinishersUrl(race.finishers_url)
    if (slug) {
      bySlug.set(slug.toLowerCase().trim(), race)
    }
  }

  // Enrichir chaque course catalogue avec son statut DB
  const enriched: CatalogRaceWithStatus[] = catalogRaces.map((catalogRace) => {
    const dbRace = bySlug.get(catalogRace.slug.toLowerCase().trim())

    if (dbRace) {
      const status = dbRace.needs_review ? 'pending' : 'exists'
      return {
        ...catalogRace,
        format: null,
        lastmod: null,
        status,
        db_id: dbRace.id,
        db_slug: dbRace.slug,
        db_updated_at: dbRace.updated_at ?? undefined,
      }
    }

    // Aucun match — nouvelle course
    return {
      ...catalogRace,
      format: null,
      lastmod: null,
      status: 'new',
    }
  })

  // Statistiques
  const stats: CatalogStats = {
    total: enriched.length,
    new: enriched.filter((r) => r.status === 'new').length,
    existing: enriched.filter((r) => r.status === 'exists').length,
    pending: enriched.filter((r) => r.status === 'pending').length,
  }

  const response: CatalogResponse = {
    catalog: enriched,
    stats,
    scraped_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
