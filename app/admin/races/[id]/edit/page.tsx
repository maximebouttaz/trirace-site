import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import EditRaceClient from './EditRaceClient'

export default async function AdminEditRacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', Number(id))
    .single()

  if (!race) notFound()

  return <EditRaceClient race={race} />
}
