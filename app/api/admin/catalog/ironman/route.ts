import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { scrapeIronmanCatalog } from '@/lib/scrapers/ironman-catalog'
import type { CatalogRace } from '@/lib/scrapers/ironman-catalog'

// Augmenter le timeout pour le scraping (~30s)
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Helper — construire un slug ironman depuis un nom
// ---------------------------------------------------------------------------

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('ironman 70.3', 'ironman-703')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// Types de réponse
// ---------------------------------------------------------------------------

interface CatalogRaceWithStatus extends CatalogRace {
  status: 'new' | 'exists' | 'pending'
  db_id?: number
  db_slug?: string
}

interface CatalogResponse {
  catalog: CatalogRaceWithStatus[]
  stats: {
    total: number
    new: number
    existing: number
    pending: number
  }
  scraped_at: string
}

// ---------------------------------------------------------------------------
// GET /api/admin/catalog/ironman
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

  // Scraping du catalogue
  let catalogRaces: CatalogRace[]
  try {
    catalogRaces = await scrapeIronmanCatalog()
  } catch (err) {
    console.error('[GET /api/admin/catalog/ironman] scraping failed:', err)
    return NextResponse.json({ error: 'Scraping du catalogue échoué.' }, { status: 502 })
  }

  // Récupérer toutes les courses Ironman existantes en DB
  const { data: dbRaces, error: dbError } = await supabase
    .from('races')
    .select('id, slug, website_url, name, city, needs_review')
    .is('deleted_at', null)
    .or('category.eq.XL,category.eq.70.3')

  if (dbError) {
    console.error('[GET /api/admin/catalog/ironman] DB query failed:', dbError)
    return NextResponse.json({ error: 'Erreur base de données.' }, { status: 500 })
  }

  const existingRaces = dbRaces ?? []

  // Index pour la recherche rapide
  const byWebsiteUrl = new Map<string, typeof existingRaces[number]>()
  const bySlug = new Map<string, typeof existingRaces[number]>()

  for (const race of existingRaces) {
    if (race.website_url) {
      byWebsiteUrl.set(race.website_url.toLowerCase().trim(), race)
    }
    bySlug.set(race.slug.toLowerCase().trim(), race)
  }

  // Enrichir chaque course catalogue avec son statut DB
  const enriched: CatalogRaceWithStatus[] = catalogRaces.map((catalogRace) => {
    // 1. Match par website_url exact
    const byUrl = byWebsiteUrl.get(catalogRace.url.toLowerCase().trim())
    if (byUrl) {
      return {
        ...catalogRace,
        status: byUrl.needs_review ? 'pending' : 'exists',
        db_id: byUrl.id,
        db_slug: byUrl.slug,
      }
    }

    // 2. Match par slug similaire (construit depuis le nom ou l'URL)
    const slugFromUrl = catalogRace.url
      .replace(/^https?:\/\/www\.ironman\.com\/races\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim()
    const slugFromName = nameToSlug(catalogRace.name)

    const byUrlSlug = bySlug.get(slugFromUrl)
    if (byUrlSlug) {
      return {
        ...catalogRace,
        status: byUrlSlug.needs_review ? 'pending' : 'exists',
        db_id: byUrlSlug.id,
        db_slug: byUrlSlug.slug,
      }
    }

    // Cherche un match partiel dans les slugs DB pour le slug construit depuis le nom
    for (const [dbSlugKey, dbRace] of bySlug.entries()) {
      if (
        dbSlugKey.includes(slugFromName) ||
        slugFromName.includes(dbSlugKey.replace(/-\d{4}$/, ''))
      ) {
        return {
          ...catalogRace,
          status: dbRace.needs_review ? 'pending' : 'exists',
          db_id: dbRace.id,
          db_slug: dbRace.slug,
        }
      }
    }

    // 3. Aucun match — nouvelle course
    return { ...catalogRace, status: 'new' }
  })

  // Statistiques
  const stats = {
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
