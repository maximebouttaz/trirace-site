import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RacesListClient from './RacesListClient'

export default async function AdminRacesPage() {
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

  // Initial fetch: first 50 races ordered by updated_at desc
  const { data: races, count } = await supabase
    .from('races')
    .select(
      'id, slug, name, city, country, category, date, swim_distance, bike_distance, run_distance, description, image_url, website_url',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(0, 49)

  return <RacesListClient initialRaces={races ?? []} initialTotal={count ?? 0} />
}
