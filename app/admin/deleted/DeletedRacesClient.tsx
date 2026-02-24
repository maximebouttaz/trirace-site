'use client'

import { useState } from 'react'
import { RotateCcw, Trash2, Check, X } from 'lucide-react'
import { formatDate, categoryLabel, categoryColor } from '@/lib/utils'
import type { DeletedRace } from './page'

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor(diff / 60_000)
  if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`
  if (hours > 0) return `il y a ${hours}h`
  return `il y a ${minutes} min`
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-zinc-300 text-xs">—</span>
  const key = source.split(':')[0]
  const styles: Record<string, string> = {
    milesrepublic: 'bg-violet-50 text-violet-700 border-violet-200',
    finishers: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[key] ?? 'bg-gray-100 text-zinc-600 border-gray-200'}`}>
      {key}
    </span>
  )
}

function RestoreButton({ raceId, onRestored }: { raceId: number; onRestored: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const res = await fetch(`/api/admin/races/${raceId}/restore`, { method: 'POST' })
    if (res.ok) onRestored()
    else setLoading(false)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      title="Restaurer la course"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
    >
      <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
      Restaurer
    </button>
  )
}

function DestroyButton({ raceId, onDestroyed }: { raceId: number; onDestroyed: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const res = await fetch(`/api/admin/races/${raceId}/destroy`, { method: 'DELETE' })
    if (res.ok) onDestroyed()
    else setLoading(false)
    setConfirm(false)
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-red-600 font-medium whitespace-nowrap">Définitif ?</span>
        <button
          onClick={handle}
          disabled={loading}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Supprimer définitivement"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
    >
      <Trash2 size={13} />
      Supprimer
    </button>
  )
}

export default function DeletedRacesClient({ initialRaces }: { initialRaces: DeletedRace[] }) {
  const [races, setRaces] = useState<DeletedRace[]>(initialRaces)

  function remove(id: number) {
    setRaces((prev) => prev.filter((r) => r.id !== id))
  }

  if (races.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
        <p className="text-zinc-400 text-sm">La corbeille est vide.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Course</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Date</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Catégorie</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Source</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Supprimée</th>
            <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {races.map((race) => (
            <tr key={race.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900 truncate max-w-[220px]">{race.name}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{race.city}, {race.country}</p>
              </td>
              <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                {race.date ? formatDate(race.date) : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(race.category)}`}>
                  {categoryLabel(race.category)}
                </span>
              </td>
              <td className="px-4 py-3">
                <SourceBadge source={race.sync_source} />
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                {timeAgo(race.deleted_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <RestoreButton raceId={race.id} onRestored={() => remove(race.id)} />
                  <DestroyButton raceId={race.id} onDestroyed={() => remove(race.id)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
