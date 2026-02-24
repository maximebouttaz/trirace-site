'use client'

import { useState, useRef } from 'react'
import { Sparkles, X, Square } from 'lucide-react'

interface BulkEnrichBarProps {
  selectedIds: number[]
  onDone?: () => void
  onClearSelection?: () => void
}

interface EnrichResult {
  updated_fields: string[]
  after: Record<string, unknown>
}

const CONCURRENCY = 5

export default function BulkEnrichBar({ selectedIds, onDone, onClearSelection }: BulkEnrichBarProps) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const cancelledRef = useRef(false)

  const count = selectedIds.length

  if (count === 0) return null

  async function handleEnrichAll() {
    if (running) return
    setRunning(true)
    setCancelled(false)
    cancelledRef.current = false

    const total = selectedIds.length
    let done = 0
    setProgress({ done: 0, total })

    const queue = [...selectedIds]

    async function worker() {
      while (queue.length > 0 && !cancelledRef.current) {
        const id = queue.shift()!
        try {
          const enrichRes = await fetch(`/api/admin/enrich/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'auto' }),
          })
          if (enrichRes.ok) {
            const data: EnrichResult = await enrichRes.json()
            if (data.updated_fields.length > 0) {
              const patch: Record<string, unknown> = {}
              for (const field of data.updated_fields) {
                patch[field] = data.after[field]
              }
              await fetch(`/api/admin/races/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
              })
            }
          }
        } catch {
          // continue on error — best effort
        }
        done++
        setProgress({ done, total })
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    const wasCancelled = cancelledRef.current
    setRunning(false)

    if (wasCancelled) {
      // Show cancelled state briefly, then reset
      setProgress({ done, total })
      setCancelled(true)
    } else {
      setProgress(null)
      onDone?.()
    }
  }

  function handleCancel() {
    cancelledRef.current = true
  }

  function handleDismissCancelled() {
    setProgress(null)
    setCancelled(false)
    onDone?.()
  }

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-white rounded-2xl border border-gray-200 shadow-xl">
      <span className="text-sm font-semibold text-zinc-700">
        {count} course{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
      </span>

      <div className="h-5 w-px bg-gray-200" />

      {/* Enrich button + progress */}
      <button
        onClick={cancelled ? handleDismissCancelled : handleEnrichAll}
        disabled={running}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-60 transition-colors"
      >
        <Sparkles size={15} className={running ? 'animate-pulse' : ''} />
        {cancelled && progress
          ? `${progress.done}/${progress.total} enrichies (annulé)`
          : running && progress
            ? `Enrichies : ${progress.done}/${progress.total}`
            : 'Enrichir tout'}
      </button>

      {/* Progress bar — visible during running or after cancel */}
      {progress && (
        <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${cancelled ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Cancel button during running / Clear selection when not running */}
      {running ? (
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <Square size={14} />
          Annuler
        </button>
      ) : (
        <button
          onClick={cancelled ? handleDismissCancelled : onClearSelection}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-500 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={14} />
          {cancelled ? 'Fermer' : 'Annuler la sélection'}
        </button>
      )}
    </div>
  )
}
