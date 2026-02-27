import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ALLOWED_FIELDS = new Set([
  'name', 'city', 'country', 'date', 'category', 'region', 'department',
  'description', 'tagline', 'website_url', 'price_euros', 'swim_distance',
  'bike_distance', 'run_distance', 'total_elevation', 'bike_elevation', 'run_elevation',
  'latitude', 'longitude', 'image_url', 'image_gradient', 'discipline',
  'max_participants', 'time_limit_hours',
  'avg_temp_high_celsius', 'avg_temp_low_celsius', 'avg_water_temp_celsius', 'avg_wind_kmh',
  'record_men', 'record_women', 'finishers_url', 'finishers_count',
  'organizer_name', 'label', 'track_geojson', 'elevation_profile',
  'gpx_url', 'swim_gpx_url', 'bike_gpx_url', 'run_gpx_url',
  'swim_type', 'bike_type', 'is_wetsuit_allowed', 'is_draft_legal',
  'registration_status', 'registration_deadline', 'qualification_for', 'tags',
  'swim_cutoff_minutes', 'bike_cutoff_minutes', 'run_cutoff_minutes',
  'needs_review', 'status',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  // Only allow whitelisted fields
  const patch: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue
    if (val === '') { patch[key] = null; continue }
    // Tags : convertir CSV → tableau si besoin
    if (key === 'tags' && typeof val === 'string') {
      patch[key] = val ? val.split(',').map((t) => t.trim()).filter(Boolean) : null
    } else {
      patch[key] = val
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide à mettre à jour.' }, { status: 400 })
  }

  patch.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('races')
    .update(patch)
    .eq('id', raceId)

  if (error) {
    console.error('[PATCH /api/admin/races/[id]]', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single<{ role: string }>()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })

  const { error } = await supabase
    .from('races')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', raceId)

  if (error) {
    console.error('[DELETE /api/admin/races/[id]]', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
