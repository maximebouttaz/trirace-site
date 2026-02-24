import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function DELETE(
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

  // Only allow permanent deletion of already soft-deleted races
  const { data: race } = await supabase
    .from('races')
    .select('id, name, city, deleted_at')
    .eq('id', raceId)
    .single<{ id: number; name: string; city: string; deleted_at: string | null }>()

  if (!race?.deleted_at) {
    return NextResponse.json({ error: 'La course doit d\'abord être supprimée avant suppression définitive.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('races')
    .delete()
    .eq('id', raceId)

  if (error) {
    console.error('[DELETE /api/admin/races/[id]/destroy]', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression définitive.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
