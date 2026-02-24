'use client'

import { useState } from 'react'
import { Sparkles, X, Check } from 'lucide-react'

interface EnrichDiff {
  image_url: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
}

interface EnrichResult {
  before: EnrichDiff
  after: EnrichDiff
  updated_fields: string[]
}

interface EnrichButtonProps {
  raceId: number
  raceName: string
  syncSource: string | null
  finishersUrl: string | null
  onEnriched?: () => void
}

type State = 'idle' | 'loading' | 'modal-open' | 'applying' | 'done'

function truncate(text: string | null, max = 120): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '...' : text
}

function canEnrich(syncSource: string | null, finishersUrl: string | null): boolean {
  if (finishersUrl) return true
  if (!syncSource) return false
  return syncSource.includes('milesrepublic:') || syncSource.includes('finishers:')
}

export default function EnrichButton({
  raceId,
  raceName,
  syncSource,
  finishersUrl,
  onEnriched,
}: EnrichButtonProps) {
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<EnrichResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const enabled = canEnrich(syncSource, finishersUrl)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleEnrich() {
    if (!enabled) return
    setState('loading')
    try {
      const res = await fetch(`/api/admin/enrich/${raceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'auto' }),
      })
      if (!res.ok) throw new Error('Erreur serveur')
      const data: EnrichResult = await res.json()
      if (data.updated_fields.length === 0) {
        showToast('Aucune donnée nouvelle trouvée')
        setState('idle')
        return
      }
      setResult(data)
      setState('modal-open')
    } catch {
      showToast('Erreur lors de l\'enrichissement')
      setState('idle')
    }
  }

  async function handleApply() {
    if (!result) return
    setState('applying')
    try {
      const patch: Record<string, unknown> = {}
      for (const field of result.updated_fields) {
        patch[field] = result.after[field as keyof EnrichDiff]
      }
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Erreur lors de la mise à jour')
      setState('done')
      showToast('Données appliquées')
      onEnriched?.()
      setTimeout(() => {
        setState('idle')
        setResult(null)
      }, 1500)
    } catch {
      showToast('Erreur lors de l\'application')
      setState('modal-open')
    }
  }

  function handleCancel() {
    setState('idle')
    setResult(null)
  }

  const isLoading = state === 'loading' || state === 'applying'
  const isModalOpen = state === 'modal-open' || state === 'applying' || state === 'done'

  return (
    <>
      <button
        onClick={handleEnrich}
        disabled={!enabled || isLoading || state === 'done'}
        title={!enabled ? 'Source inconnue' : 'Enrichir depuis la source'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Sparkles size={13} className={isLoading ? 'animate-pulse' : ''} />
        {state === 'loading' ? '...' : state === 'done' ? 'Fait' : 'Enrichir'}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCancel}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Données trouvées</h3>
                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{raceName}</p>
              </div>
              <button
                onClick={handleCancel}
                disabled={state === 'applying'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Fields diff */}
            <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
              {result.updated_fields.includes('image_url') && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Image</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Avant</p>
                      {result.before.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.before.image_url}
                          alt="avant"
                          className="w-full h-20 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-zinc-400 border border-gray-200">
                          vide
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Apres</p>
                      {result.after.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.after.image_url}
                          alt="apres"
                          className="w-full h-20 object-cover rounded-lg border border-violet-200"
                        />
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-zinc-400 border border-gray-200">
                          vide
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.updated_fields.includes('description') && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Description</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Avant</p>
                      <p className="text-xs text-zinc-500 bg-gray-50 rounded-lg p-2 min-h-[48px] border border-gray-200">
                        {truncate(result.before.description) || <span className="italic">vide</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Apres</p>
                      <p className="text-xs text-zinc-700 bg-violet-50 rounded-lg p-2 min-h-[48px] border border-violet-100">
                        {truncate(result.after.description) || <span className="italic">vide</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(result.updated_fields.includes('latitude') || result.updated_fields.includes('longitude')) && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Coordonnees GPS</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Avant</p>
                      <p className="text-xs font-mono text-zinc-500 bg-gray-50 rounded-lg p-2 border border-gray-200">
                        {result.before.latitude != null && result.before.longitude != null
                          ? `${result.before.latitude.toFixed(5)}, ${result.before.longitude.toFixed(5)}`
                          : <span className="italic not-italic">vide</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Apres</p>
                      <p className="text-xs font-mono text-violet-700 bg-violet-50 rounded-lg p-2 border border-violet-100">
                        {result.after.latitude != null && result.after.longitude != null
                          ? `${result.after.latitude.toFixed(5)}, ${result.after.longitude.toFixed(5)}`
                          : <span className="italic not-italic">vide</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
              <button
                onClick={handleApply}
                disabled={state === 'applying' || state === 'done'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 transition-colors"
              >
                {state === 'applying' ? (
                  <><Sparkles size={15} className="animate-pulse" /> Application...</>
                ) : state === 'done' ? (
                  <><Check size={15} /> Applique</>
                ) : (
                  <><Check size={15} /> Appliquer</>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={state === 'applying'}
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
