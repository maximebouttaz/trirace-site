'use client'

import { useState } from 'react'
import { MapPin, X, Check } from 'lucide-react'

interface GeocodeResult {
  lat: string
  lon: string
  display_name: string
}

interface GeocodeButtonProps {
  raceId: number
  city: string
  country: string
  onGeocoded?: () => void
}

type State = 'idle' | 'loading' | 'modal-open' | 'confirming' | 'done'

export default function GeocodeButton({ raceId, city, country, onGeocoded }: GeocodeButtonProps) {
  const [state, setState] = useState<State>('idle')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [selected, setSelected] = useState<number>(0)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleGeocode() {
    setState('loading')
    try {
      const res = await fetch(`/api/admin/geocode/${raceId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Erreur serveur')
      const data: { results: GeocodeResult[] } = await res.json()
      if (!data.results || data.results.length === 0) {
        showToast(`Aucun résultat pour ${city}, ${country}`)
        setState('idle')
        return
      }
      setResults(data.results.slice(0, 3))
      setSelected(0)
      setState('modal-open')
    } catch {
      showToast('Erreur lors du géocodage')
      setState('idle')
    }
  }

  async function handleConfirm() {
    const chosen = results[selected]
    if (!chosen) return
    setState('confirming')
    try {
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: parseFloat(chosen.lat),
          longitude: parseFloat(chosen.lon),
        }),
      })
      if (!res.ok) throw new Error('Erreur mise à jour')
      setState('done')
      showToast('Coordonnées enregistrées')
      onGeocoded?.()
      setTimeout(() => {
        setState('idle')
        setResults([])
      }, 1500)
    } catch {
      showToast('Erreur lors de l\'enregistrement')
      setState('modal-open')
    }
  }

  function handleCancel() {
    setState('idle')
    setResults([])
  }

  const isLoading = state === 'loading' || state === 'confirming'
  const isModalOpen = state === 'modal-open' || state === 'confirming' || state === 'done'

  return (
    <>
      <button
        onClick={handleGeocode}
        disabled={isLoading || state === 'done'}
        title="Géocoder la ville"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <MapPin size={13} className={state === 'loading' ? 'animate-pulse' : ''} />
        {state === 'loading' ? '...' : state === 'done' ? 'Fait' : 'Géocoder'}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCancel}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Choisir un résultat GPS</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{city}, {country}</p>
              </div>
              <button
                onClick={handleCancel}
                disabled={state === 'confirming'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results list */}
            <div className="px-5 py-4 space-y-2">
              {results.map((r, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected === i
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`geocode-result-${raceId}`}
                    checked={selected === i}
                    onChange={() => setSelected(i)}
                    className="mt-0.5 text-green-600 focus:ring-green-500 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 leading-relaxed">
                      {r.display_name}
                    </p>
                    <p className="text-xs font-mono text-zinc-500 mt-1">
                      {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
              <button
                onClick={handleConfirm}
                disabled={state === 'confirming' || state === 'done'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {state === 'confirming' ? (
                  <><MapPin size={15} className="animate-pulse" /> Enregistrement...</>
                ) : state === 'done' ? (
                  <><Check size={15} /> Enregistre</>
                ) : (
                  <><Check size={15} /> Confirmer</>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={state === 'confirming'}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
