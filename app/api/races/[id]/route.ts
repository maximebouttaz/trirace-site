import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { toNumberOrNull } from '@/lib/validators'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Course introuvable.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const { name, date, city, category } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })
  }
  if (!date || typeof date !== 'string') {
    return NextResponse.json({ error: 'La date est requise.' }, { status: 400 })
  }
  if (!city || typeof city !== 'string' || !city.trim()) {
    return NextResponse.json({ error: 'La ville est requise.' }, { status: 400 })
  }
  if (!category || typeof category !== 'string') {
    return NextResponse.json({ error: 'La catégorie est requise.' }, { status: 400 })
  }

  const updateData = {
    name: (name as string).trim(),
    date: date as string,
    city: (city as string).trim(),
    department: body.department ? String(body.department).trim() || null : null,
    region: body.region ? String(body.region).trim() || null : null,
    country: body.country ? String(body.country).trim() || null : null,
    category: category as string,
    discipline: body.discipline ? String(body.discipline).trim() || 'triathlon' : 'triathlon',
    swim_distance: toNumberOrNull(body.swim_distance),
    bike_distance: toNumberOrNull(body.bike_distance),
    run_distance: toNumberOrNull(body.run_distance),
    total_elevation: toNumberOrNull(body.total_elevation),
    price_euros: toNumberOrNull(body.price_euros),
    max_participants: toNumberOrNull(body.max_participants),
    time_limit_hours: toNumberOrNull(body.time_limit_hours),
    description: body.description ? String(body.description).trim() || null : null,
    website_url: body.website_url ? String(body.website_url).trim() || null : null,
    image_url: body.image_url ? String(body.image_url).trim() || null : null,
    status: body.status ? String(body.status) : 'pending',
    location: `${(city as string).trim()}, ${body.country ? String(body.country).trim() : ''}`.replace(/, $/, ''),
    updated_at: new Date().toISOString(),
  }

  const { data: race, error } = await supabase
    .from('races')
    .update(updateData)
    .eq('id', id)
    .eq('organizer_id', session.user.id)
    .select()
    .single()

  if (error) {
    console.error('[PUT /api/races/[id]]', error)
    if (error.code === 'PGRST116') {
      // No rows matched — either not found or not owned by user
      return NextResponse.json(
        { error: 'Course introuvable ou accès refusé.' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour. Veuillez réessayer.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, race })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  // First verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('races')
    .select('id')
    .eq('id', id)
    .eq('organizer_id', session.user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Course introuvable ou accès refusé.' },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from('races')
    .delete()
    .eq('id', id)
    .eq('organizer_id', session.user.id)

  if (error) {
    console.error('[DELETE /api/races/[id]]', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression. Veuillez réessayer.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
