import { createClient } from '@/lib/supabase-server'
import { CheckCircle } from 'lucide-react'
import RaceQueueClient, { type RaceRowFull } from './RaceQueueClient'
import SyncControls from './SyncControls'

export default async function AdminSyncPage() {
  const supabase = await createClient()

  const { data: races } = await supabase
    .from('races')
    .select(
      'id, name, city, country, date, category, sync_source, formats, created_at, latitude, longitude, description, price_euros, swim_distance, bike_distance, run_distance, image_url, website_url, region'
    )
    .eq('needs_review', true)
    .order('created_at', { ascending: false })
    .returns<RaceRowFull[]>()

  const pending = races ?? []

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Validation des courses</h1>
          <p className="text-zinc-500 mt-1">
            {pending.length === 0
              ? 'Aucune course en attente de validation.'
              : `${pending.length} course${pending.length > 1 ? 's' : ''} en attente de validation.`}
          </p>
        </div>
        <SyncControls />
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle size={48} className="text-green-400 mb-4" />
          <p className="text-lg font-semibold text-zinc-700">Tout est à jour !</p>
          <p className="text-zinc-500 text-sm mt-1">Aucune course à valider pour le moment.</p>
        </div>
      ) : (
        <RaceQueueClient races={pending} />
      )}
    </div>
  )
}
