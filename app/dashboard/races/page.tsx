import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusCircle, Flag, Pencil, Calendar, MapPin, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import StatusBadge from '@/components/dashboard/StatusBadge'

interface Race {
  id: number
  slug: string
  name: string
  date: string | null
  city: string
  category: string
  status: 'published' | 'pending' | 'draft'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function RacesPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: racesData } = await supabase
    .from('races')
    .select('id, slug, name, date, city, category, status')
    .eq('organizer_id', session.user.id)
    .order('date', { ascending: false })

  const races = (racesData || []) as Race[]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Dashboard</p>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">Mes courses</h1>
        </div>
        <Link
          href="/dashboard/races/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all shrink-0"
        >
          <PlusCircle size={16} />
          Ajouter une course
        </Link>
      </div>

      {/* Table / empty state */}
      <div className="bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden">
        {races.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-5">
              <Flag size={28} className="text-zinc-400" />
            </div>
            <p className="text-zinc-900 font-bold text-lg mb-2">Aucune course enregistrée</p>
            <p className="text-sm text-zinc-500 mb-8 max-w-xs">
              Vous n&apos;avez pas encore ajouté de course. Commencez par en créer une !
            </p>
            <Link
              href="/dashboard/races/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all"
            >
              <PlusCircle size={16} />
              Ajouter ma première course
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {races.map((race) => (
                    <tr
                      key={race.id}
                      className="hover:bg-gray-100/40 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-900">{race.name}</p>
                      </td>
                      <td className="px-4 py-4 text-zinc-400 whitespace-nowrap">
                        {formatDate(race.date)}
                      </td>
                      <td className="px-4 py-4 text-zinc-400">{race.city}</td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-mono font-bold text-zinc-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                          {race.category}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={race.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {race.slug && (
                            <Link
                              href={`/courses/${race.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Voir la page publique"
                              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-gray-200 transition-all"
                            >
                              <ExternalLink size={15} />
                            </Link>
                          )}
                          <Link
                            href={`/dashboard/races/${race.id}/edit`}
                            title="Modifier"
                            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-gray-200 transition-all"
                          >
                            <Pencil size={15} />
                          </Link>
                          <DeleteButton raceId={race.id} raceName={race.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-200">
              {races.map((race) => (
                <div key={race.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-zinc-900 leading-tight">{race.name}</p>
                    <StatusBadge status={race.status} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(race.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {race.city}
                    </span>
                    <span className="font-mono font-bold text-zinc-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                      {race.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {race.slug && (
                      <Link
                        href={`/courses/${race.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 bg-gray-100 hover:bg-gray-200 transition-all"
                      >
                        <ExternalLink size={12} />
                        Voir
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/races/${race.id}/edit`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 bg-gray-100 hover:bg-gray-200 transition-all"
                    >
                      <Pencil size={12} />
                      Modifier
                    </Link>
                    <DeleteButton raceId={race.id} raceName={race.name} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Delete button (client island) ───────────────────────────────────────────
// This is a tiny client component embedded in a server page via a named export.
// We keep it in the same file to avoid an extra file for a single button.
import DeleteRaceButton from '@/components/dashboard/DeleteRaceButton'

function DeleteButton({ raceId, raceName }: { raceId: number; raceName: string }) {
  return <DeleteRaceButton raceId={raceId} raceName={raceName} />
}
