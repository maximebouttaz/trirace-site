'use client'

import { useState } from 'react'
import { Sparkles, X, Check, ChevronDown } from 'lucide-react'

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

type ScrapeSource = 'finishers' | 'milesrepublic' | 'website'

interface Props {
  raceId: number
  raceName: string
  syncSource: string | null
  finishersUrl: string | null
  websiteUrl: string | null
  onScraped?: () => void
}

function truncate(text: string | null, max = 120) {
  if (!text) return null
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function ScrapePickerButton({
  raceId,
  raceName,
  syncSource,
  finishersUrl,
  websiteUrl,
  onScraped,
}: Props) {
  const [open, setOpen] = useState(false)
  const [scraping, setScraping] = useState<ScrapeSource | null>(null)
  const [result, setResult] = useState<EnrichResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  const isMilesRepublic = !!syncSource?.startsWith('milesrepublic:')

  const sources: { id: ScrapeSource; label: string; available: boolean; pill: string }[] = [
    {
      id: 'finishers',
      label: 'Finishers',
      available: !!finishersUrl,
      pill: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    },
    {
      id: 'milesrepublic',
      label: 'MilesRepublic',
      available: isMilesRepublic,
      pill: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
    },
    {
      id: 'website',
      label: 'Site web',
      available: !!websiteUrl,
      pill: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    },
  ]

  const hasAny = sources.some((s) => s.available)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleScrape(source: ScrapeSource) {
    setOpen(false)
    setScraping(source)
    try {
      const res = await fetch(`/api/admin/enrich/${raceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!res.ok) throw new Error()
      const data: EnrichResult = await res.json()
      if (data.updated_fields.length === 0) {
        showToast('Aucune donnée nouvelle trouvée')
      } else {
        setResult(data)
      }
    } catch {
      showToast('Erreur lors du scraping')
    }
    setScraping(null)
  }

  async function handleApply() {
    if (!result) return
    setApplying(true)
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
      if (!res.ok) throw new Error()
      setDone(true)
      showToast('Données appliquées')
      onScraped?.()
      setTimeout(() => {
        setResult(null)
        setDone(false)
        setApplying(false)
      }, 1500)
    } catch {
      showToast("Erreur lors de l'application")
      setApplying(false)
    }
  }

  function handleCancel() {
    setResult(null)
    setDone(false)
    setApplying(false)
  }

  return (
    <>
      {/* Trigger + dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={!hasAny || !!scraping}
          title={hasAny ? 'Scraper depuis une source' : 'Aucune source disponible'}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={12} className={scraping ? 'animate-pulse' : ''} />
          {scraping ? '…' : 'Scraper'}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden min-w-[160px]">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => s.available && handleScrape(s.id)}
                  disabled={!s.available}
                  title={!s.available ? 'URL non disponible' : `Scraper depuis ${s.label}`}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    s.available ? s.pill : 'text-zinc-300 cursor-not-allowed bg-white'
                  }`}
                >
                  {s.label}
                  {!s.available && <span className="ml-1 text-zinc-300 text-[10px]">indisponible</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Diff modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Données trouvées</h3>
                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{raceName}</p>
              </div>
              <button
                onClick={handleCancel}
                disabled={applying}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Diff fields */}
            <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
              {result.updated_fields.includes('image_url') && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Image</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Avant</p>
                      {result.before.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={result.before.image_url} alt="avant" className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-zinc-400 border border-gray-200">vide</div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Après</p>
                      {result.after.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={result.after.image_url} alt="après" className="w-full h-20 object-cover rounded-lg border border-violet-200" />
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-zinc-400 border border-gray-200">vide</div>
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
                        {truncate(result.before.description) ?? <span className="italic">vide</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Après</p>
                      <p className="text-xs text-zinc-700 bg-violet-50 rounded-lg p-2 min-h-[48px] border border-violet-100">
                        {truncate(result.after.description) ?? <span className="italic">vide</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(result.updated_fields.includes('latitude') || result.updated_fields.includes('longitude')) && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Coordonnées GPS</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Avant</p>
                      <p className="text-xs font-mono text-zinc-500 bg-gray-50 rounded-lg p-2 border border-gray-200">
                        {result.before.latitude != null
                          ? `${result.before.latitude.toFixed(5)}, ${result.before.longitude?.toFixed(5)}`
                          : <span className="not-italic italic">vide</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Après</p>
                      <p className="text-xs font-mono text-violet-700 bg-violet-50 rounded-lg p-2 border border-violet-100">
                        {result.after.latitude != null
                          ? `${result.after.latitude.toFixed(5)}, ${result.after.longitude?.toFixed(5)}`
                          : <span className="not-italic italic">vide</span>}
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
                disabled={applying || done}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 transition-colors"
              >
                {applying ? (
                  <><Sparkles size={15} className="animate-pulse" /> Application…</>
                ) : done ? (
                  <><Check size={15} /> Appliqué</>
                ) : (
                  <><Check size={15} /> Appliquer</>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={applying}
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
