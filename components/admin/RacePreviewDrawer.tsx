'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle, XCircle, ExternalLink, MapPin, Waves, Bike, PersonStanding } from 'lucide-react'
import { formatDate, formatDistance, categoryLabel, categoryColor } from '@/lib/utils'
import type { Race } from '@/lib/types'

interface RacePreviewDrawerProps {
  raceId: number | null
  onClose: () => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
}

export default function RacePreviewDrawer({ raceId, onClose, onApprove, onReject }: RacePreviewDrawerProps) {
  const [race, setRace] = useState<Race | null>(null)
  const [loading, setLoading] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)

  const loadRace = useCallback(async (id: number) => {
    setLoading(true)
    setRace(null)
    setDescExpanded(false)
    const res = await fetch(`/api/races/${id}`)
    if (res.ok) {
      const data = await res.json()
      setRace(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (raceId !== null) {
      loadRace(raceId)
    }
  }, [raceId, loadRace])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (raceId !== null) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [raceId, onClose])

  async function handleApprove() {
    if (!race) return
    setActionLoading('approve')
    await fetch(`/api/admin/races/${race.id}/approve`, { method: 'POST' })
    setActionLoading(null)
    onApprove(race.id)
  }

  async function handleReject() {
    if (!race) return
    if (!confirm('Supprimer définitivement cette course ?')) return
    setActionLoading('reject')
    await fetch(`/api/admin/races/${race.id}/reject`, { method: 'DELETE' })
    setActionLoading(null)
    onReject(race.id)
  }

  const isOpen = raceId !== null

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-zinc-700">Apercu de la course</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="animate-pulse space-y-4 p-5">
              <div className="h-40 bg-gray-100 rounded-xl" />
              <div className="h-6 bg-gray-100 rounded-lg w-2/3" />
              <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
              <div className="h-4 bg-gray-100 rounded-lg w-1/3" />
            </div>
          )}

          {!loading && race && (
            <div className="p-5 space-y-5">
              {/* Image or gradient placeholder */}
              {race.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={race.image_url}
                  alt={race.name}
                  className="w-full h-44 object-cover rounded-xl"
                />
              ) : (
                <div className={`w-full h-44 rounded-xl flex items-center justify-center ${race.image_gradient ?? 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
                  <span className="text-white text-lg font-bold opacity-60">{race.name.charAt(0)}</span>
                </div>
              )}

              {/* Name + badges */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-zinc-900 leading-tight">{race.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${categoryColor(race.category)}`}>
                    {categoryLabel(race.category)}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  <MapPin size={13} className="inline mr-1 -mt-0.5" />
                  {race.city}{race.country !== 'France' ? `, ${race.country}` : ''}
                  {race.date && <span className="ml-2">— {formatDate(race.date)}</span>}
                </p>
                {race.sync_source && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                    {race.sync_source}
                  </span>
                )}
              </div>

              {/* Distances */}
              {(race.swim_distance || race.bike_distance || race.run_distance) && (
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <Waves size={16} className="mx-auto text-blue-500 mb-1" />
                    <p className="text-xs text-zinc-400">Natation</p>
                    <p className="text-sm font-semibold text-zinc-800">{formatDistance(race.swim_distance)}</p>
                  </div>
                  <div>
                    <Bike size={16} className="mx-auto text-amber-500 mb-1" />
                    <p className="text-xs text-zinc-400">Velo</p>
                    <p className="text-sm font-semibold text-zinc-800">{formatDistance(race.bike_distance)}</p>
                  </div>
                  <div>
                    <PersonStanding size={16} className="mx-auto text-green-500 mb-1" />
                    <p className="text-xs text-zinc-400">Course</p>
                    <p className="text-sm font-semibold text-zinc-800">{formatDistance(race.run_distance)}</p>
                  </div>
                </div>
              )}

              {/* Price + elevation */}
              {(race.price_euros || race.total_elevation) && (
                <div className="flex gap-4 text-sm">
                  {race.price_euros && (
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wide">Prix</p>
                      <p className="font-semibold text-zinc-800">{race.price_euros} €</p>
                    </div>
                  )}
                  {race.total_elevation && (
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wide">Denivele</p>
                      <p className="font-semibold text-zinc-800">{race.total_elevation} m D+</p>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {race.description && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {descExpanded || race.description.length <= 300
                      ? race.description
                      : `${race.description.slice(0, 300)}...`}
                  </p>
                  {race.description.length > 300 && (
                    <button
                      onClick={() => setDescExpanded(v => !v)}
                      className="text-xs text-violet-600 hover:text-violet-700 mt-1"
                    >
                      {descExpanded ? 'Voir moins' : 'Voir plus'}
                    </button>
                  )}
                </div>
              )}

              {/* GPS */}
              {race.latitude && race.longitude && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Coordonnees GPS</p>
                  <p className="text-sm text-zinc-600 font-mono">
                    {race.latitude.toFixed(5)}, {race.longitude.toFixed(5)}
                  </p>
                </div>
              )}

              {/* Website */}
              {race.website_url && (
                <a
                  href={race.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700"
                >
                  <ExternalLink size={14} />
                  Voir le site officiel
                </a>
              )}

              {/* Formats */}
              {race.formats && race.formats.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                    Formats ({race.formats.length})
                  </p>
                  <div className="space-y-2">
                    {race.formats.map((fmt, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{fmt.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {fmt.swim ? `${fmt.swim}m nat.` : ''}{' '}
                            {fmt.bike ? `${Math.round(fmt.bike / 1000)}km velo` : ''}{' '}
                            {fmt.run ? `${Math.round(fmt.run / 1000)}km course` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
                          {fmt.price && <span>{fmt.price}€</span>}
                          {fmt.is_relay && (
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Relais</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !race && raceId !== null && (
            <div className="p-5 text-center text-zinc-400 text-sm">Course introuvable.</div>
          )}
        </div>

        {/* Drawer footer — action buttons */}
        {race && (
          <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleApprove}
              disabled={actionLoading !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={16} />
              {actionLoading === 'approve' ? 'Validation...' : 'Valider et publier'}
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle size={16} />
              {actionLoading === 'reject' ? 'Suppression...' : 'Rejeter'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
