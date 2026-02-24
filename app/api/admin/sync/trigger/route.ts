import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
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

  const token = process.env.GITHUB_SYNC_TOKEN
  const repo = process.env.GITHUB_REPO // format: "owner/repo"

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'Variables GITHUB_SYNC_TOKEN et GITHUB_REPO non configurées.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const source: string = body.source ?? 'all'

  const inputs: Record<string, string> = {}
  if (source !== 'all') {
    inputs.sources = source
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sync-races.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    }
  )

  // GitHub renvoie 204 No Content en cas de succès
  if (res.status === 204) {
    return NextResponse.json({ success: true })
  }

  const errorBody = await res.text()
  console.error('[POST /api/admin/sync/trigger] GitHub API error:', res.status, errorBody)
  return NextResponse.json(
    { error: `Erreur GitHub API (${res.status}). Vérifie le token et le nom du dépôt.` },
    { status: 502 }
  )
}
