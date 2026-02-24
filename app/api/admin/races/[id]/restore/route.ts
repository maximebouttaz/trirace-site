import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const raceId = Number(id)
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('races')
    .update({ deleted_at: null })
    .eq('id', raceId)

  if (error) {
    console.error('[POST /api/admin/races/[id]/restore]', error)
    return NextResponse.json({ error: 'Erreur lors de la restauration.' }, { status: 500 })
  }

  await supabase.from('admin_audit_log').insert({
    action: 'approve',
    race_id: raceId,
    admin_id: session.user.id,
    admin_email: session.user.email ?? null,
  })

  return NextResponse.json({ success: true })
}
