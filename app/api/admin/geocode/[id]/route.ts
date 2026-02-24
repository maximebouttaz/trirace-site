import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const { data: race, error: fetchError } = await supabase
    .from('races')
    .select('id, name, city, country')
    .eq('id', raceId)
    .single<{ id: number; name: string | null; city: string | null; country: string }>()

  if (fetchError || !race) {
    return NextResponse.json({ error: 'Course introuvable.' }, { status: 404 })
  }

  if (!race.city) {
    return NextResponse.json({ error: 'Ville manquante pour le géocodage.' }, { status: 422 })
  }

  const q = encodeURIComponent(`${race.city},${race.country}`)
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3`

  const res = await fetch(nominatimUrl, {
    headers: { 'User-Agent': 'TriRace/1.0 admin-geocoder' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Erreur Nominatim.' }, { status: 502 })
  }

  const raw: NominatimResult[] = await res.json()
  const results = raw.map(({ lat, lon, display_name }) => ({ lat, lon, display_name }))

  return NextResponse.json({ results })
}
