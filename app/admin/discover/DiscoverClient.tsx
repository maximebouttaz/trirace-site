'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Compass,
  Search,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogRaceWithStatus {
  name: string
  url: string
  date: string | null
  city: string | null
  country: string | null
  format: 'full' | '70.3' | null
  source: string
  status: 'new' | 'exists' | 'pending'
  db_id?: number
  db_slug?: string
}

interface CatalogStats {
  total: number
  new: number
  existing: number
  pending: number
}

interface CatalogResponse {
  catalog: CatalogRaceWithStatus[]
  stats: CatalogStats
  scraped_at: string
}

type TabFilter = 'all' | 'new' | 'exists' | 'pending'
type AddState = 'idle' | 'loading' | 'success' | 'error'

interface AddStateMap {
  [url: string]: { state: AddState; message?: string }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CatalogRaceWithStatus['status'] }) {
  if (status === 'new') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
        Nouvelle
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
        En attente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-zinc-500">
      Deja presente
    </span>
  )
}

function FormatBadge({ format }: { format: CatalogRaceWithStatus['format'] }) {
  if (!format) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        format === 'full'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-orange-50 text-orange-700'
      }`}
    >
      {format === 'full' ? 'Full' : '70.3'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DiscoverClient() {
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [catalog, setCatalog] = useState<CatalogRaceWithStatus[]>([])
  const [stats, setStats] = useState<CatalogStats | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [addStates, setAddStates] = useState<AddStateMap>({})
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)

  // ── Scan ──────────────────────────────────────────────────────────────────

  async function handleScan() {
    setScanState('loading')
    setScanError(null)
    try {
      const res = await fetch('/api/admin/catalog/ironman')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Erreur ${res.status}`)
      }
      const data: CatalogResponse = await res.json()
      setCatalog(data.catalog)
      setStats(data.stats)
      setScanState('done')
      setTabFilter('new')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Erreur inconnue')
      setScanState('error')
    }
  }

  // ── Add single race ───────────────────────────────────────────────────────

  async function handleAdd(race: CatalogRaceWithStatus) {
    setAddStates((prev) => ({ ...prev, [race.url]: { state: 'loading' } }))
    try {
      const res = await fetch('/api/admin/catalog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: race.url,
          name: race.name,
          city: race.city ?? undefined,
          country: race.country ?? undefined,
          format: race.format ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Erreur ${res.status}`)
      }
      setAddStates((prev) => ({ ...prev, [race.url]: { state: 'success' } }))
      // Update local catalog status
      setCatalog((prev) =>
        prev.map((r) => (r.url === race.url ? { ...r, status: 'pending' } : r))
      )
      setStats((prev) =>
        prev
          ? { ...prev, new: Math.max(0, prev.new - 1), pending: prev.pending + 1 }
          : prev
      )
    } catch (err) {
      setAddStates((prev) => ({
        ...prev,
        [race.url]: {
          state: 'error',
          message: err instanceof Error ? err.message : 'Erreur inconnue',
        },
      }))
    }
  }

  // ── Add all new races ─────────────────────────────────────────────────────

  async function handleAddAll() {
    const newRaces = catalog.filter((r) => r.status === 'new')
    if (newRaces.length === 0) return
    if (
      !confirm(
        `Ajouter les ${newRaces.length} nouvelles courses Ironman en attente de validation ?`
      )
    )
      return

    setBulkProgress({ current: 0, total: newRaces.length })

    for (let i = 0; i < newRaces.length; i++) {
      const race = newRaces[i]
      setBulkProgress({ current: i + 1, total: newRaces.length })
      await handleAdd(race)
    }

    setBulkProgress(null)
  }

  // ── Filtered catalog ──────────────────────────────────────────────────────

  const filteredCatalog =
    tabFilter === 'all'
      ? catalog
      : catalog.filter((r) => r.status === tabFilter)

  const newCount = stats?.new ?? 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Compass size={22} className="text-violet-500" />
            <h1 className="text-2xl font-bold text-zinc-900">Decouverte de courses</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Scannez le catalogue Ironman pour decouvrir les courses non presentes dans votre base.
          </p>
        </div>

        {scanState === 'done' && newCount > 0 && !bulkProgress && (
          <button
            onClick={handleAddAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <Plus size={15} />
            Tout ajouter ({newCount})
          </button>
        )}

        {bulkProgress && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-100 text-zinc-600 shrink-0">
            <Loader2 size={15} className="animate-spin" />
            Ajout en cours... ({bulkProgress.current}/{bulkProgress.total})
          </div>
        )}
      </div>

      {/* Scan section */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Sources
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleScan}
            disabled={scanState === 'loading'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanState === 'loading' ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Scanner...
              </>
            ) : (
              <>
                <Search size={15} />
                Scanner Ironman
              </>
            )}
          </button>

          {scanState === 'loading' && (
            <p className="text-sm text-zinc-500">
              Scan en cours... (peut prendre 15-20 secondes)
            </p>
          )}

          {scanState === 'error' && scanError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={15} />
              {scanError}
            </div>
          )}

          {scanState === 'idle' && (
            <p className="text-sm text-zinc-400">
              Scannez le catalogue Ironman pour decouvrir les courses non presentes dans votre base
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {scanState === 'done' && stats && (
        <>
          {/* Stats band */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{stats.new}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Nouvelles courses</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-zinc-500">{stats.existing}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Deja presentes</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-zinc-500 mt-0.5">En attente de validation</p>
            </div>
          </div>

          {/* Tab filters */}
          <div className="flex gap-1 mb-4">
            {(
              [
                { key: 'all', label: 'Toutes', count: stats.total },
                { key: 'new', label: 'Nouvelles', count: stats.new, badge: true },
                { key: 'exists', label: 'Deja presentes', count: stats.existing },
                { key: 'pending', label: 'En attente', count: stats.pending },
              ] as const
            ).map(({ key, label, count, ...rest }) => {
              const badge = 'badge' in rest ? rest.badge : false
              return (
                <button
                  key={key}
                  onClick={() => setTabFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    tabFilter === key
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        tabFilter === key
                          ? 'bg-white/20 text-white'
                          : badge
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-zinc-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Race list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {filteredCatalog.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-sm">
                Aucune course dans cette categorie.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredCatalog.map((race) => {
                  const addState = addStates[race.url]
                  const isAdded =
                    addState?.state === 'success' || race.status === 'pending'
                  const isLoading = addState?.state === 'loading'
                  const isError = addState?.state === 'error'

                  return (
                    <li
                      key={race.url}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      {/* Status badge */}
                      <StatusBadge status={race.status} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-900 truncate">
                            {race.name}
                          </span>
                          <FormatBadge format={race.format} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                          {race.date && <span>{race.date}</span>}
                          {race.city && (
                            <>
                              {race.date && <span>·</span>}
                              <span>
                                {race.city}
                                {race.country ? `, ${race.country}` : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={race.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                          title="Voir sur ironman.com"
                        >
                          <ExternalLink size={12} />
                        </a>

                        {race.status === 'new' && !isAdded && (
                          <button
                            onClick={() => handleAdd(race)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Ajout...
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                Ajouter
                              </>
                            )}
                          </button>
                        )}

                        {isAdded && (
                          <Link
                            href="/admin/sync"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                          >
                            <CheckCircle size={12} />
                            Ajoutee ! Valider →
                          </Link>
                        )}

                        {isError && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-red-600"
                            title={addState?.message}
                          >
                            <AlertCircle size={13} />
                            Echec
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
