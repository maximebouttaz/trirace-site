import { createClient } from '@/lib/supabase-server'
import DeletedRacesClient from './DeletedRacesClient'

export interface DeletedRace {
  id: number
  slug: string
  name: string
  city: string
  country: string
  date: string | null
  category: string
  sync_source: string | null
  deleted_at: string
  needs_review: boolean
}

export default async function AdminDeletedPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('races')
    .select('id, slug, name, city, country, date, category, sync_source, deleted_at, needs_review')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  const races = (data ?? []) as DeletedRace[]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Courses supprimées</h1>
        <p className="text-zinc-500 mt-1">
          {races.length} course{races.length > 1 ? 's' : ''} dans la corbeille.
          Restaurez-les ou supprimez-les définitivement.
        </p>
      </div>
      <DeletedRacesClient initialRaces={races} />
    </div>
  )
}
