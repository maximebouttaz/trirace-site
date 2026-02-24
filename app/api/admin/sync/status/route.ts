import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Étapes internes GitHub à masquer
const HIDDEN_STEPS = new Set([
  'Set up job',
  'Complete job',
  'Upload logs on failure',
  'Post Set up Python 3.11',
  'Post Checkout repository',
  'Post actions/setup-python@v5',
  'Post actions/checkout@v4',
])

export interface SyncStep {
  name: string
  status: 'pending' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'skipped' | null
}

export interface SyncStatus {
  run_id: number | null
  run_url: string | null
  status: 'idle' | 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | null
  progress: number // 0-100
  current_step: string | null
  steps: SyncStep[]
  started_at: string | null
  last_success_at: string | null // date ISO du dernier sync réussi
}

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single<{ role: string }>()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const token = process.env.GITHUB_SYNC_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) {
    return NextResponse.json({ error: 'GitHub non configuré.' }, { status: 503 })
  }

  // 1. Derniers runs du workflow (5 pour trouver le dernier succès)
  const runsRes = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/sync-races.yml/runs?per_page=5`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, next: { revalidate: 0 } }
  )
  if (!runsRes.ok) return NextResponse.json({ error: 'Erreur API GitHub.' }, { status: 502 })

  const runsData = await runsRes.json()
  const allRuns: Array<{ id: number; status: string; conclusion: 'success' | 'failure' | 'cancelled' | null; created_at: string; updated_at: string; html_url: string }> =
    runsData.workflow_runs ?? []

  const run = allRuns[0] ?? null

  // Dernier run completed + success parmi les 5
  const lastSuccess = allRuns.find(r => r.status === 'completed' && r.conclusion === 'success')
  const last_success_at = lastSuccess?.updated_at ?? null

  if (!run) {
    return NextResponse.json<SyncStatus>({
      run_id: null, run_url: null, status: 'idle', conclusion: null,
      progress: 0, current_step: null, steps: [], started_at: null, last_success_at,
    })
  }

  // Run terminé — retour rapide sans fetcher les jobs
  if (run.status === 'completed' && run.conclusion !== null) {
    return NextResponse.json<SyncStatus>({
      run_id: run.id,
      run_url: run.html_url,
      status: 'completed',
      conclusion: run.conclusion,
      progress: run.conclusion === 'success' ? 100 : 0,
      current_step: null,
      steps: [],
      started_at: run.created_at,
      last_success_at,
    })
  }

  // 2. Étapes du job
  const jobsRes = await fetch(
    `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, next: { revalidate: 0 } }
  )
  if (!jobsRes.ok) return NextResponse.json({ error: 'Erreur API GitHub (jobs).' }, { status: 502 })

  const jobsData = await jobsRes.json()
  const job = jobsData.jobs?.[0]

  const steps: SyncStep[] = (job?.steps ?? [])
    .filter((s: { name: string }) => !HIDDEN_STEPS.has(s.name))
    .map((s: { name: string; status: string; conclusion: string | null }) => ({
      name: s.name,
      status: s.status as SyncStep['status'],
      conclusion: s.conclusion as SyncStep['conclusion'],
    }))

  const total = steps.length
  const done = steps.filter(s => s.status === 'completed').length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const current = steps.find(s => s.status === 'in_progress')?.name ?? null

  return NextResponse.json<SyncStatus>({
    run_id: run.id,
    run_url: run.html_url,
    status: run.status as SyncStatus['status'],
    conclusion: run.conclusion,
    progress,
    current_step: current,
    steps,
    started_at: run.created_at,
    last_success_at,
  })
}
