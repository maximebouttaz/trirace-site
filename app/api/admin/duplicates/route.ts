import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface RaceRow {
  id: number
  name: string
  city: string
}

interface DuplicateCandidate {
  id: number
  name: string
  slug: string
}

export async function GET(req: NextRequest) {
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

  const idsParam = req.nextUrl.searchParams.get('ids')
  if (!idsParam) {
    return NextResponse.json({})
  }

  const ids = idsParam
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)

  if (ids.length === 0) {
    return NextResponse.json({})
  }

  const { data: pendingRaces } = await supabase
    .from('races')
    .select('id, name, city')
    .in('id', ids)
    .returns<RaceRow[]>()

  if (!pendingRaces || pendingRaces.length === 0) {
    return NextResponse.json({})
  }

  const result: Record<number, { possible_duplicate: DuplicateCandidate | null }> = {}

  await Promise.all(
    pendingRaces.map(async (race) => {
      const { data: duplicates } = await supabase
        .from('races')
        .select('id, name, slug')
        .eq('needs_review', false)
        .eq('city', race.city)
        .ilike('name', `%${race.name}%`)
        .not('id', 'in', `(${ids.join(',')})`)
        .limit(1)
        .returns<DuplicateCandidate[]>()

      result[race.id] = {
        possible_duplicate: duplicates && duplicates.length > 0 ? duplicates[0] : null,
      }
    })
  )

  return NextResponse.json(result)
}
