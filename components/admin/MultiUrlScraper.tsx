'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, X, Loader2, Check, AlertCircle, ArrowRight, SkipForward } from 'lucide-react'
import type { ScrapedFields, ConflictItem } from '@/lib/scrape-fields'
import { SCRAPABLE_FIELD_META } from '@/lib/scrape-fields'

interface UrlEntry {
  id: string
  url: string
  status: 'pending' | 'loading' | 'done' | 'error'
  data: ScrapedFields | null
  error: string | null
}

interface MultiUrlScraperProps {
  onMergedData: (data: Partial<ScrapedFields>, scrapedKeys: Set<string>) => void
  initialUrl?: string
}

function truncateDomain(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    return host.length > 30 ? host.slice(0, 27) + '...' : host
  } catch {
    return url.slice(0, 30)
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  return false
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.length > 80 ? value.slice(0, 77) + '...' : value
  return String(value)
}

export default function MultiUrlScraper({ onMergedData, initialUrl }: MultiUrlScraperProps) {
  const [urls, setUrls] = useState<UrlEntry[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!initialUrl) return
    setUrls([{ id: crypto.randomUUID(), url: initialUrl, status: 'pending', data: null, error: null }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'input' | 'resolving' | 'done'>('input')
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [mergedPreview, setMergedPreview] = useState<Partial<ScrapedFields>>({})
  const [scraping, setScraping] = useState(false)

  const addUrl = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return
    if (urls.some((u) => u.url === trimmed)) return
    setUrls((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url: trimmed, status: 'pending', data: null, error: null },
    ])
    setInput('')
  }, [input, urls])

  function removeUrl(id: string) {
    setUrls((prev) => prev.filter((u) => u.id !== id))
  }

  async function scrapeAll() {
    if (urls.length === 0) return
    setScraping(true)

    // Set all to loading
    setUrls((prev) => prev.map((u) => ({ ...u, status: 'loading' as const, data: null, error: null })))

    const results = await Promise.allSettled(
      urls.map(async (entry) => {
        const res = await fetch('/api/admin/scrape-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: entry.url }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        return { id: entry.id, data: (await res.json()) as ScrapedFields }
      })
    )

    const updated = urls.map((entry, i) => {
      const result = results[i]
      if (result.status === 'fulfilled') {
        return { ...entry, status: 'done' as const, data: result.value.data, error: null }
      } else {
        return { ...entry, status: 'error' as const, data: null, error: (result.reason as Error).message }
      }
    })

    setUrls(updated)
    setScraping(false)

    // Merge
    const successEntries = updated.filter((u) => u.status === 'done' && u.data)
    if (successEntries.length === 0) return

    const merged: Partial<ScrapedFields> = {}
    const newConflicts: ConflictItem[] = []

    for (const meta of SCRAPABLE_FIELD_META) {
      const field = meta.key as keyof ScrapedFields
      const values: { url: string; value: unknown }[] = []

      for (const entry of successEntries) {
        const val = entry.data?.[field]
        if (val !== null && val !== undefined && val !== '') {
          values.push({ url: entry.url, value: val })
        }
      }

      if (values.length === 0) continue

      // Check if all values are the same
      const allSame = values.every((v) => valuesEqual(v.value, values[0].value))

      if (allSame) {
        ;(merged as Record<string, unknown>)[field] = values[0].value
      } else {
        // Conflict
        newConflicts.push({
          field,
          label: meta.label,
          options: values,
          chosenIndex: 0,
        })
        ;(merged as Record<string, unknown>)[field] = values[0].value
      }
    }

    // Pass through non-displayable object fields (GPX data) from first successful source
    const firstSuccess = successEntries[0]
    if (firstSuccess?.data) {
      const hiddenFields = ['track_geojson', 'elevation_profile'] as const
      for (const field of hiddenFields) {
        const val = (firstSuccess.data as unknown as Record<string, unknown>)[field]
        if (val != null) {
          ;(merged as Record<string, unknown>)[field] = val
        }
      }
    }

    setMergedPreview(merged)
    setConflicts(newConflicts)
    setPhase('resolving')
  }

  function setConflictChoice(fieldKey: keyof ScrapedFields, index: number) {
    setConflicts((prev) =>
      prev.map((c) => (c.field === fieldKey ? { ...c, chosenIndex: index } : c))
    )
  }

  function applyAndFinish() {
    const final: Partial<ScrapedFields> = { ...mergedPreview }

    // Apply conflict choices
    for (const conflict of conflicts) {
      const chosen = conflict.options[conflict.chosenIndex]
      if (chosen) {
        ;(final as Record<string, unknown>)[conflict.field] = chosen.value
      }
    }

    const scrapedKeys = new Set(Object.keys(final).filter((k) => final[k as keyof ScrapedFields] != null))
    setPhase('done')
    onMergedData(final, scrapedKeys)
  }

  function skipScraping() {
    onMergedData({}, new Set())
    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-700">
        Donnees appliquees au formulaire ci-dessous.
      </div>
    )
  }

  if (phase === 'resolving') {
    const successCount = urls.filter((u) => u.status === 'done').length
    const filledFields = Object.keys(mergedPreview).filter(
      (k) => mergedPreview[k as keyof ScrapedFields] != null
    ).length

    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Resolution des donnees</h3>
          <p className="text-sm text-zinc-500 mt-1">
            {filledFields} champ{filledFields > 1 ? 's' : ''} trouve{filledFields > 1 ? 's' : ''} sur {successCount} source{successCount > 1 ? 's' : ''}
          </p>
        </div>

        {/* Non-conflicting fields */}
        {SCRAPABLE_FIELD_META.map((meta) => {
          const field = meta.key as keyof ScrapedFields
          const val = mergedPreview[field]
          const hasConflict = conflicts.some((c) => c.field === field)
          if (val == null && !hasConflict) return null
          if (hasConflict) return null

          return (
            <div key={field} className="flex items-center gap-3 text-sm">
              <Check size={16} className="text-green-500 shrink-0" />
              <span className="font-medium text-zinc-700 w-32 shrink-0">{meta.label}</span>
              <span className="text-zinc-900 truncate">{formatValue(val)}</span>
            </div>
          )
        })}

        {/* Conflicts */}
        {conflicts.map((conflict) => (
          <div key={conflict.field} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-amber-800">{conflict.label} — conflit</span>
            </div>
            <div className="space-y-2">
              {conflict.options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    conflict.chosenIndex === i
                      ? 'bg-white border border-amber-300'
                      : 'hover:bg-amber-100/50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`conflict-${conflict.field}`}
                    checked={conflict.chosenIndex === i}
                    onChange={() => setConflictChoice(conflict.field, i)}
                    className="mt-0.5 text-amber-600 focus:ring-amber-400"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-900 break-all">{formatValue(opt.value)}</p>
                    <p className="text-xs text-zinc-400 truncate">{truncateDomain(opt.url)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <button
            onClick={applyAndFinish}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Appliquer et remplir le formulaire
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // Phase: input
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">Scraping multi-URL</h3>
        <p className="text-sm text-zinc-500 mt-1">
          Ajoutez des URLs de la course pour pre-remplir le formulaire automatiquement.
        </p>
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          placeholder="https://ironman.com/im703-nice"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrl()
            }
          }}
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={!input.trim() || !input.startsWith('http')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* URL chips */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-sm border transition-colors ${
                entry.status === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : entry.status === 'done'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : entry.status === 'loading'
                  ? 'bg-violet-50 border-violet-200 text-violet-700'
                  : 'bg-white border-gray-200 text-zinc-700'
              }`}
            >
              {entry.status === 'loading' && <Loader2 size={14} className="animate-spin" />}
              {entry.status === 'done' && <Check size={14} />}
              {entry.status === 'error' && <AlertCircle size={14} />}
              <span className="truncate max-w-[200px]">{truncateDomain(entry.url)}</span>
              {entry.status !== 'loading' && (
                <button
                  type="button"
                  onClick={() => removeUrl(entry.id)}
                  className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error messages */}
      {urls.some((u) => u.status === 'error') && (
        <div className="space-y-1">
          {urls
            .filter((u) => u.status === 'error')
            .map((u) => (
              <p key={u.id} className="text-xs text-red-500">
                {truncateDomain(u.url)} : {u.error}
              </p>
            ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={scrapeAll}
          disabled={urls.length === 0 || scraping}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {scraping && <Loader2 size={16} className="animate-spin" />}
          Analyser {urls.length} URL{urls.length > 1 ? 's' : ''}
        </button>
        <button
          type="button"
          onClick={skipScraping}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-zinc-500 text-sm font-medium hover:text-zinc-700 hover:bg-gray-100 transition-colors"
        >
          <SkipForward size={16} />
          Passer cette etape
        </button>
      </div>
    </div>
  )
}
