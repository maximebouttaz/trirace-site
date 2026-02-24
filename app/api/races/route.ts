import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@/lib/supabase-server'
import { toNumberOrNull } from '@/lib/validators'

const CATEGORY_MAP: Record<string, string[]> = {
  sprint: ['XS', 'S'],
  olympic: ['M'],
  l: ['L'],
  half: ['70.3'],
  xl: ['XL'],
  ironman: ['Ironman'],
}

const LIST_COLS = 'id, slug, name, date, city, country, region, department, category, swim_distance, bike_distance, run_distance, total_distance, total_elevation, bike_elevation, price_euros, max_participants, time_limit_hours, image_gradient, image_url, tags, avg_temp_celsius, avg_water_temp_celsius, swim_type, is_wetsuit_allowed, label, qualification_for, finishers_count, registration_deadline, formats, latitude, longitude'
const GEO_COLS = 'slug, name, city, country, region, department, category, date, latitude, longitude'

const DEFAULT_PAGE_SIZE = 24

// Temporary: only show Half and Full Ironman categories
const VISIBLE_CATEGORIES = ['L', '70.3', 'XL', 'Ironman']

/** Sanitize region input to prevent PostgREST filter injection */
function sanitizeRegion(value: string): string {
  return value.replace(/[^\w\sÀ-ÿ\-]/g, '').trim().slice(0, 100)
}

/** Sanitize free-text search to prevent PostgREST ilike injection */
function sanitizeSearch(value: string): string {
  return value.replace(/[%_,.()\[\]]/g, '').trim().slice(0, 100)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const geo = searchParams.get('geo') === 'true'
  const category = searchParams.get('category')
  const rawRegion = searchParams.get('region')
  const region = rawRegion ? sanitizeRegion(rawRegion) : null
  const priceMin = searchParams.get('price_min')
  const priceMax = searchParams.get('price_max')
  const distMin = searchParams.get('dist_min')
  const distMax = searchParams.get('dist_max')
  const elevMin = searchParams.get('elev_min')
  const elevMax = searchParams.get('elev_max')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const rawSearch = searchParams.get('search')
  const search = rawSearch ? sanitizeSearch(rawSearch) : null
  const sort = searchParams.get('sort') || 'date_asc'
  const temp = searchParams.get('temp')
  const swimType = searchParams.get('swim_type')
  const wetsuit = searchParams.get('wetsuit')
  const label = searchParams.get('label')

  // --- GEO MODE: lightweight, no pagination ---
  if (geo) {
    let geoQuery = supabase
      .from('races')
      .select(GEO_COLS)
      .eq('needs_review', false)
      .is('deleted_at', null)
      .in('category', VISIBLE_CATEGORIES)
      .order('date', { ascending: true })

    if (category && CATEGORY_MAP[category]) geoQuery = geoQuery.in('category', CATEGORY_MAP[category])
    if (region) geoQuery = geoQuery.or(`region.eq."${region}",department.eq."${region}"`)
    if (priceMin) geoQuery = geoQuery.gte('price_euros', Number(priceMin))
    if (priceMax) geoQuery = geoQuery.lte('price_euros', Number(priceMax))
    if (distMin) geoQuery = geoQuery.gte('total_distance', Number(distMin) * 1000)
    if (distMax) geoQuery = geoQuery.lte('total_distance', Number(distMax) * 1000)
    if (elevMin) geoQuery = geoQuery.gte('total_elevation', Number(elevMin))
    if (elevMax) geoQuery = geoQuery.lte('total_elevation', Number(elevMax))
    if (dateFrom) geoQuery = geoQuery.gte('date', dateFrom)
    if (dateTo) geoQuery = geoQuery.lte('date', dateTo)
    if (search) geoQuery = geoQuery.or(`name.ilike.%${search}%,city.ilike.%${search}%,region.ilike.%${search}%`)
    if (temp === 'hot') geoQuery = geoQuery.gte('avg_temp_celsius', 28)
    else if (temp === 'pleasant') { geoQuery = geoQuery.gte('avg_temp_celsius', 22); geoQuery = geoQuery.lt('avg_temp_celsius', 28) }
    else if (temp === 'cool') { geoQuery = geoQuery.gte('avg_temp_celsius', 16); geoQuery = geoQuery.lt('avg_temp_celsius', 22) }
    else if (temp === 'cold') geoQuery = geoQuery.lt('avg_temp_celsius', 16)
    if (swimType) geoQuery = geoQuery.eq('swim_type', swimType)
    if (wetsuit === 'true') geoQuery = geoQuery.eq('is_wetsuit_allowed', true)
    if (label) geoQuery = geoQuery.ilike('label', `%${label}%`)

    const { data, error } = await geoQuery

    if (error) {
      console.error('[GET /api/races?geo=true]', error)
      return NextResponse.json({ error: 'Erreur lors du chargement des courses.' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // --- PAGINATED MODE ---
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE)))
  const offset = (page - 1) * limit

  let query = supabase
    .from('races')
    .select(LIST_COLS, { count: 'exact' })
    .eq('needs_review', false)
    .is('deleted_at', null)
    .in('category', VISIBLE_CATEGORIES)
    .range(offset, offset + limit - 1)

  if (category && CATEGORY_MAP[category]) query = query.in('category', CATEGORY_MAP[category])
  if (region) query = query.or(`region.eq."${region}",department.eq."${region}"`)
  if (priceMin) query = query.gte('price_euros', Number(priceMin))
  if (priceMax) query = query.lte('price_euros', Number(priceMax))
  if (distMin) query = query.gte('total_distance', Number(distMin) * 1000)
  if (distMax) query = query.lte('total_distance', Number(distMax) * 1000)
  if (elevMin) query = query.gte('total_elevation', Number(elevMin))
  if (elevMax) query = query.lte('total_elevation', Number(elevMax))
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,region.ilike.%${search}%`)
  if (temp === 'hot') query = query.gte('avg_temp_celsius', 28)
  else if (temp === 'pleasant') { query = query.gte('avg_temp_celsius', 22); query = query.lt('avg_temp_celsius', 28) }
  else if (temp === 'cool') { query = query.gte('avg_temp_celsius', 16); query = query.lt('avg_temp_celsius', 22) }
  else if (temp === 'cold') query = query.lt('avg_temp_celsius', 16)
  if (swimType) query = query.eq('swim_type', swimType)
  if (wetsuit === 'true') query = query.eq('is_wetsuit_allowed', true)
  if (label) query = query.ilike('label', `%${label}%`)

  // Server-side sort
  if (sort === 'date_desc') query = query.order('date', { ascending: false })
  else if (sort === 'price_asc') query = query.order('price_euros', { ascending: true, nullsFirst: false })
  else if (sort === 'elevation_desc') query = query.order('total_elevation', { ascending: false, nullsFirst: false })
  else query = query.order('date', { ascending: true })

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/races]', error)
    return NextResponse.json({ error: 'Erreur lors du chargement des courses.' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({ data: data ?? [], total, page, totalPages })
}

function makeSlug(name: string, city: string, year: number): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${normalize(name)}-${normalize(city)}-${year}`
}


export async function POST(request: NextRequest) {
  const supabaseServer = await createClient()

  const {
    data: { session },
  } = await supabaseServer.auth.getSession()

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

  // Required field validation
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

  const year = new Date(date).getFullYear()
  const baseSlug = makeSlug(name as string, city as string, year)

  // Ensure slug uniqueness by appending a suffix if needed
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await supabaseServer
      .from('races')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const insertData = {
    name: (name as string).trim(),
    date: date as string,
    city: (city as string).trim(),
    department: body.department ? String(body.department).trim() || null : null,
    region: body.region ? String(body.region).trim() || null : null,
    country: body.country ? String(body.country).trim() || 'France' : 'France',
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
    slug,
    organizer_id: session.user.id,
    status: 'pending',
    location: `${(city as string).trim()}, ${body.country ? String(body.country).trim() || 'France' : 'France'}`,
  }

  const { data: race, error } = await supabaseServer
    .from('races')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[POST /api/races]', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de la course. Veuillez réessayer." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, race }, { status: 201 })
}
