import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'

function shiftYear(dateStr: string, years: number): string {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

async function fetchSeaTempForDate(lat: number, lng: number, date: string): Promise<number | null> {
  const start = new Date(date)
  start.setDate(start.getDate() - 3)
  const end = new Date(date)
  end.setDate(end.getDate() + 3)

  const url =
    `${MARINE_BASE}?latitude=${lat}&longitude=${lng}` +
    `&start_date=${start.toISOString().slice(0, 10)}` +
    `&end_date=${end.toISOString().slice(0, 10)}` +
    `&hourly=sea_surface_temperature` +
    `&timezone=auto`

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TriRace/1.0' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    const values: number[] = (data.hourly?.sea_surface_temperature ?? []).filter((v: unknown) => v != null)
    if (values.length === 0) return null
    return values.reduce((a, b) => a + b, 0) / values.length
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params // requis par Next.js même si non utilisé

  // Auth
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

  // Params
  const { searchParams } = new URL(request.url)
  const lat  = parseFloat(searchParams.get('lat')  ?? '')
  const lng  = parseFloat(searchParams.get('lng')  ?? '')
  const date = searchParams.get('date') ?? ''

  if (isNaN(lat) || isNaN(lng) || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json(
      { error: 'Paramètres invalides. Requis : lat, lng, date (YYYY-MM-DD).' },
      { status: 400 }
    )
  }

  // Moyenne sur 3 années précédentes
  const results = await Promise.all(
    [-1, -2, -3].map((offset) => fetchSeaTempForDate(lat, lng, shiftYear(date, offset)))
  )

  const valid = results.filter((v): v is number => v !== null)
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'Aucune donnée température eau disponible pour cette localisation.' },
      { status: 503 }
    )
  }

  const avg = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
  return NextResponse.json({ avg_water_temp_celsius: avg })
}
