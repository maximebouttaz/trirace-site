import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  // Validation
  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  // GitHub
  const token = process.env.GITHUB_SYNC_TOKEN
  const repo  = process.env.GITHUB_REPO

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GITHUB_SYNC_TOKEN ou GITHUB_REPO non configurés.' },
      { status: 503 }
    )
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/enrich-water-temp.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization:          `Bearer ${token}`,
        Accept:                 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type':         'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { race_id: String(raceId) } }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ triggered: true })
  }

  const errorBody = await res.text()
  console.error('[POST /api/admin/water-temp] GitHub API error:', res.status, errorBody)
  return NextResponse.json(
    { error: `Erreur GitHub API (${res.status}). Vérifie le token et le dépôt.` },
    { status: 502 }
  )
}
