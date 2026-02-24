import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const CSV_COLUMNS = [
  'id', 'slug', 'name', 'city', 'country', 'date', 'category',
  'latitude', 'longitude', 'description', 'price_euros',
  'image_url', 'website_url', 'finishers_url',
] as const

type CsvRow = Record<typeof CSV_COLUMNS[number], string | number | null>

function escapeCell(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(rows: CsvRow[]): string {
  const header = CSV_COLUMNS.join(',')
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCell(row[col])).join(',')
  )
  return [header, ...lines].join('\n')
}

export async function GET() {
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

  const { data, error } = await supabase
    .from('races')
    .select('id, slug, name, city, country, date, category, latitude, longitude, description, price_euros, image_url, website_url, finishers_url')
    .eq('needs_review', false)
    .or('latitude.is.null,description.is.null,image_url.is.null')
    .order('id', { ascending: true })

  if (error) {
    console.error('[GET /api/admin/export-csv]', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }

  const csv = buildCsv((data ?? []) as CsvRow[])

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="courses-incompletes.csv"',
    },
  })
}
