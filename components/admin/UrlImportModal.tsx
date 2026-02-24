'use client'

import { useState } from 'react'
import { X, Link, Loader2, Check, Image, FileText, Type, Calendar } from 'lucide-react'

interface UrlImportModalProps {
  raceId: number
  isOpen: boolean
  onClose: () => void
  onImported?: () => void
}

interface ScrapedData {
  image_url?: string | null
  description?: string | null
  name?: string | null
  date?: string | null
}

type FieldKey = keyof ScrapedData

const FIELD_CONFIG: { key: FieldKey; label: string; icon: React.ReactNode }[] = [
  { key: 'image_url', label: 'Image', icon: <Image size={14} /> },
  { key: 'description', label: 'Description', icon: <FileText size={14} /> },
  { key: 'name', label: 'Nom', icon: <Type size={14} /> },
  { key: 'date', label: 'Date', icon: <Calendar size={14} /> },
]

export default function UrlImportModal({
  raceId,
  isOpen,
  onClose,
  onImported,
}: UrlImportModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scraped, setScraped] = useState<ScrapedData | null>(null)
  const [selected, setSelected] = useState<Set<FieldKey>>(new Set())
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  async function handleAnalyze() {
    if (!url) return
    setLoading(true)
    setError(null)
    setScraped(null)
    setSelected(new Set())

    try {
      const res = await fetch('/api/admin/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, race_id: raceId }),
      })
      const data: ScrapedData & { error?: string } = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de l\'analyse.')
        return
      }
      setScraped(data)
      // Pre-select all found fields
      const found = new Set<FieldKey>()
      for (const { key } of FIELD_CONFIG) {
        if (data[key]) found.add(key)
      }
      setSelected(found)
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  function toggleField(key: FieldKey) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleImport() {
    if (!scraped || selected.size === 0) return
    setSaving(true)

    const patch: Record<string, unknown> = {}
    for (const key of selected) {
      if (scraped[key] != null) {
        patch[key] = scraped[key]
      }
    }

    try {
      await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onImported?.()
      handleClose()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setUrl('')
    setError(null)
    setScraped(null)
    setSelected(new Set())
    onClose()
  }

  const hasResults = scraped !== null
  const hasAnyField = FIELD_CONFIG.some(({ key }) => scraped?.[key])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-zinc-900">Importer depuis une URL</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* URL input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="https://www.finishers.com/course/..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !url}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Analyse...' : 'Analyser'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Results */}
          {hasResults && !hasAnyField && (
            <p className="text-sm text-zinc-500">Aucun champ trouvé sur cette page.</p>
          )}

          {hasResults && hasAnyField && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Champs trouvés — cochez ceux à importer
              </p>
              {FIELD_CONFIG.map(({ key, label, icon }) => {
                const value = scraped?.[key]
                if (!value) return null
                const isChecked = selected.has(key)
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleField(key)}
                      className="mt-0.5 accent-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-1">
                        {icon}
                        {label}
                      </div>
                      {key === 'image_url' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={value as string}
                          alt="Preview"
                          className="w-24 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <p className="text-xs text-zinc-500 truncate">
                          {String(value).length > 100
                            ? `${String(value).slice(0, 100)}...`
                            : String(value)}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && hasAnyField && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleImport}
              disabled={saving || selected.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Importation...' : `Importer ${selected.size} champ${selected.size > 1 ? 's' : ''}`}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
