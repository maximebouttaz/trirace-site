import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive'

function shiftYear(dateStr: string, years: number): string {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

async function fetchWeatherForDate(
  lat: number,
  lng: number,
  date: string
): Promise<{ tempHigh: number | null; tempLow: number | null; wind: number | null }> {
  // ±3 jours autour de la date
  const start = new Date(date)
  start.setDate(start.getDate() - 3)
  const end = new Date(date)
  end.setDate(end.getDate() + 3)

  const url =
    `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}` +
    `&start_date=${start.toISOString().slice(0, 10)}` +
    `&end_date=${end.toISOString().slice(0, 10)}` +
    `&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max` +
    `&wind_speed_unit=kmh` +
    `&timezone=auto`

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TriRace/1.0' } })
    if (!res.ok) return { tempHigh: null, tempLow: null, wind: null }
    const data = await res.json()
    const highs: number[] = (data.daily?.temperature_2m_max ?? []).filter((v: unknown) => v != null)
    const lows: number[]  = (data.daily?.temperature_2m_min ?? []).filter((v: unknown) => v != null)
    const winds: number[] = (data.daily?.wind_speed_10m_max  ?? []).filter((v: unknown) => v != null)
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    return { tempHigh: avg(highs), tempLow: avg(lows), wind: avg(winds) }
  } catch {
    return { tempHigh: null, tempLow: null, wind: null }
  }
}

export async function GET(request: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
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
  const years = [-1, -2, -3]
  const results = await Promise.all(
    years.map((offset) => fetchWeatherForDate(lat, lng, shiftYear(date, offset)))
  )

  const validHighs = results.map((r) => r.tempHigh).filter((v): v is number => v !== null)
  const validLows  = results.map((r) => r.tempLow).filter((v): v is number => v !== null)
  const validWinds = results.map((r) => r.wind).filter((v): v is number => v !== null)

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

  const tempHigh = avg(validHighs)
  const tempLow  = avg(validLows)
  const wind     = avg(validWinds)

  if (tempHigh === null && tempLow === null && wind === null) {
    return NextResponse.json(
      { error: 'Aucune donnée météo disponible pour cette localisation et cette date.' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    avg_temp_high_celsius: tempHigh,
    avg_temp_low_celsius:  tempLow,
    avg_wind_kmh:          wind,
  })
}
