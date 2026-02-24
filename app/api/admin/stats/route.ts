import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acces refuse.' }, { status: 403 })
  }

  // Count pending (needs_review = true)
  const { count: pending } = await supabase
    .from('races')
    .select('*', { count: 'exact', head: true })
    .eq('needs_review', true)

  // Count approved this month (published, updated this month)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: approved_this_month } = await supabase
    .from('races')
    .select('*', { count: 'exact', head: true })
    .eq('needs_review', false)
    .eq('status', 'published')
    .gte('updated_at', startOfMonth.toISOString())

  // Breakdown by source for pending races
  const { data: sourceRows } = await supabase
    .from('races')
    .select('sync_source')
    .eq('needs_review', true)

  const by_source: Record<string, number> = {}
  for (const row of sourceRows ?? []) {
    const src = row.sync_source ?? 'unknown'
    by_source[src] = (by_source[src] ?? 0) + 1
  }

  return NextResponse.json({
    pending: pending ?? 0,
    approved_this_month: approved_this_month ?? 0,
    rejected_this_month: 0,
    by_source,
  })
}
