'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Database,
  AlertTriangle,
} from 'lucide-react'
import { formatDate, categoryLabel, categoryColor } from '@/lib/utils'
import RacePreviewDrawer from '@/components/admin/RacePreviewDrawer'

export interface RaceRowFull {
  id: number
  name: string
  city: string
  country: string
  date: string | null
  category: string
  sync_source: string | null
  formats: Array<{ name: string }> | null
  created_at: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  price_euros: number | null
  swim_distance: number | null
  bike_distance: number | null
  run_distance: number | null
  image_url: string | null
  website_url: string | null
  region: string | null
}

// ── Completeness score ───────────────────────────────────────────────────────

const COMPLETENESS_FIELDS: (keyof RaceRowFull)[] = [
  'name',
  'city',
  'date',
  'category',
  'latitude',
  'longitude',
  'description',
  'price_euros',
  'swim_distance',
  'bike_distance',
  'run_distance',
  'image_url',
  'website_url',
  'formats',
  'region',
]

function completenessScore(race: RaceRowFull): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => {
    const val = race[f]
    if (val === null || val === undefined) return false
    if (typeof val === 'string' && val.trim() === '') return false
    if (Array.isArray(val) && val.length === 0) return false
    return true
  }).length
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-500">{score}%</span>
    </div>
  )
}

// ── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-zinc-400 text-xs">—</span>
  const prefix = source.split(':')[0]
  const styles: Record<string, string> = {
    milesrepublic: 'bg-violet-50 text-violet-700 border-violet-200',
    finishers: 'bg-orange-50 text-orange-700 border-orange-200',
    ironman: 'bg-rose-50 text-rose-700 border-rose-200',
    manual: 'bg-gray-100 text-zinc-600 border-gray-200',
  }
  const labels: Record<string, string> = {
    milesrepublic: 'MilesRepublic',
    finishers: 'Finishers',
    ironman: 'Ironman',
    manual: 'Manuel',
  }
  const cls = styles[prefix] ?? 'bg-gray-100 text-zinc-600 border-gray-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {labels[prefix] ?? prefix}
    </span>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  pending: number
  approved_this_month: number
  rejected_this_month: number
  by_source: Record<string, number>
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  iconClass: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconClass}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Sort types ───────────────────────────────────────────────────────────────

type SortKey = 'name' | 'date' | 'category' | 'sync_source' | 'completeness'
type SortDir = 'asc' | 'desc'

function SortIcon({
  col,
  active,
  dir,
}: {
  col: SortKey
  active: SortKey
  dir: SortDir
}) {
  if (col !== active) return <ChevronsUpDown size={13} className="text-zinc-400" />
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-violet-500" />
  ) : (
    <ChevronDown size={13} className="text-violet-500" />
  )
}

// ── Bulk actions bar ─────────────────────────────────────────────────────────

function BulkBar({
  count,
  onApprove,
  onReject,
  loading,
}: {
  count: number
  onApprove: () => void
  onReject: () => void
  loading: boolean
}) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-white rounded-2xl border border-gray-200 shadow-xl">
      <span className="text-sm font-semibold text-zinc-700">
        {count} course{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
      </span>
      <button
        onClick={onApprove}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        <CheckCircle size={15} />
        Valider {count}
      </button>
      <button
        onClick={onReject}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        <XCircle size={15} />
        Rejeter {count}
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const COMPLETENESS_OPTIONS = [0, 25, 50, 75] as const
const SOURCE_OPTIONS = ['all', 'milesrepublic', 'finishers', 'ironman'] as const
const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'sprint', label: 'Sprint', cats: ['XS', 'S'] },
  { value: 'olympic', label: 'Olympique', cats: ['M'] },
  { value: 'half', label: 'Half / 70.3', cats: ['L', '70.3'] },
  { value: 'full', label: 'Ironman / XL', cats: ['XL', 'Ironman'] },
] as const

interface DuplicateCandidate {
  id: number
  name: string
  slug: string
}

interface DuplicatesMap {
  [id: number]: { possible_duplicate: DuplicateCandidate | null }
}

export default function RaceQueueClient({ races: initialRaces }: { races: RaceRowFull[] }) {
  const router = useRouter()

  // ── Races list (optimistic removal from drawer actions) ──
  const [races, setRaces] = useState<RaceRowFull[]>(initialRaces)

  // ── Stats ──
  const [stats, setStats] = useState<AdminStats | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Drawer ──
  const [drawerRaceId, setDrawerRaceId] = useState<number | null>(null)

  function handleDrawerApprove(id: number) {
    setRaces((prev) => prev.filter((r) => r.id !== id))
    setDrawerRaceId(null)
    setStats((prev) =>
      prev
        ? { ...prev, pending: Math.max(0, prev.pending - 1), approved_this_month: prev.approved_this_month + 1 }
        : prev
    )
  }

  function handleDrawerReject(id: number) {
    setRaces((prev) => prev.filter((r) => r.id !== id))
    setDrawerRaceId(null)
    setStats((prev) =>
      prev ? { ...prev, pending: Math.max(0, prev.pending - 1) } : prev
    )
  }

  // ── Duplicates state ──
  const [duplicates, setDuplicates] = useState<DuplicatesMap>({})

  useEffect(() => {
    if (races.length === 0) return
    const ids = races.map((r) => r.id)
    fetch(`/api/admin/duplicates?ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then(setDuplicates)
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races.map((r) => r.id).join(',')])

  // ── Filters state ──
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [minCompleteness, setMinCompleteness] = useState<number>(0)

  // ── Pagination state ──
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [sourceFilter, categoryFilter, minCompleteness])

  // ── Sort state ──
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // ── Selection state ──
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // ── Bulk loading ──
  const [bulkLoading, setBulkLoading] = useState(false)

  // ── Computed scores ──
  const racesWithScore = useMemo(
    () => races.map((r) => ({ ...r, _score: completenessScore(r) })),
    [races]
  )

  // ── Filtered ──
  const filtered = useMemo(() => {
    return racesWithScore.filter((r) => {
      if (sourceFilter !== 'all' && !(r.sync_source ?? '').startsWith(sourceFilter)) return false
      if (categoryFilter !== 'all') {
        const opt = CATEGORY_FILTER_OPTIONS.find((o) => o.value === categoryFilter)
        if (opt && 'cats' in opt && !opt.cats.includes(r.category as never)) return false
      }
      if (r._score < minCompleteness) return false
      return true
    })
  }, [racesWithScore, sourceFilter, categoryFilter, minCompleteness])

  // ── Sorted ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'fr')
      else if (sortKey === 'date') cmp = (a.date ?? '').localeCompare(b.date ?? '')
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category)
      else if (sortKey === 'sync_source')
        cmp = (a.sync_source ?? '').localeCompare(b.sync_source ?? '')
      else if (sortKey === 'completeness') cmp = a._score - b._score
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalFilteredCount = sorted.length
  const totalPaginatedPages = Math.ceil(totalFilteredCount / PAGE_SIZE)
  const paginated = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page]
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ── Selection helpers ──
  const allVisibleIds = paginated.map((r) => r.id)
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))
  const someChecked = allVisibleIds.some((id) => selected.has(id))

  function toggleAll() {
    if (allChecked) {
      setSelected((prev) => {
        const next = new Set(prev)
        allVisibleIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        allVisibleIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Bulk actions ──
  async function handleBulkApprove() {
    const ids = [...selected]
    setBulkLoading(true)
    for (const id of ids) {
      await fetch(`/api/admin/races/${id}/approve`, { method: 'POST' })
    }
    setSelected(new Set())
    setBulkLoading(false)
    router.refresh()
  }

  async function handleBulkReject() {
    const ids = [...selected]
    if (
      !confirm(
        `Supprimer définitivement ${ids.length} course${ids.length > 1 ? 's' : ''} ?`
      )
    )
      return
    setBulkLoading(true)
    for (const id of ids) {
      await fetch(`/api/admin/races/${id}/reject`, { method: 'DELETE' })
    }
    setSelected(new Set())
    setBulkLoading(false)
    router.refresh()
  }

  const selectedCount = [...selected].filter((id) =>
    sorted.some((r) => r.id === id)
  ).length

  const topSource = stats
    ? Object.entries(stats.by_source).sort((a, b) => b[1] - a[1])[0]
    : null

  // ── Render ──
  return (
    <>
      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Clock}
          label="En attente de validation"
          value={stats ? stats.pending : races.length}
          iconClass="bg-violet-50 text-violet-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Validées ce mois"
          value={stats?.approved_this_month ?? '—'}
          iconClass="bg-green-50 text-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Rejetées ce mois"
          value={stats?.rejected_this_month ?? '—'}
          iconClass="bg-red-50 text-red-500"
        />
        <StatCard
          icon={Database}
          label="Source principale"
          value={topSource ? topSource[0] : '—'}
          sub={topSource ? `${topSource[1]} course${topSource[1] > 1 ? 's' : ''}` : undefined}
          iconClass="bg-blue-50 text-blue-600"
        />
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        {/* Source */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Source
          </span>
          <div className="flex gap-1">
            {SOURCE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  sourceFilter === s
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {s === 'all' ? 'Toutes' : s === 'milesrepublic' ? 'MilesRepublic' : s === 'finishers' ? 'Finishers' : 'Ironman'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Catégorie
          </span>
          <div className="flex gap-1">
            {CATEGORY_FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setCategoryFilter(o.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  categoryFilter === o.value
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Completeness min */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Complétude min.
          </span>
          <div className="flex gap-1">
            {COMPLETENESS_OPTIONS.map((v) => (
              <button
                key={v}
                onClick={() => setMinCompleteness(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  minCompleteness === v
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {v === 0 ? 'Tout' : `≥${v}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto text-xs text-zinc-400">
          {totalFilteredCount} course{totalFilteredCount > 1 ? 's' : ''} · page {page}/{totalPaginatedPages || 1}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Checkbox select all */}
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked && !allChecked
                  }}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-violet-500 focus:ring-violet-400 cursor-pointer"
                />
              </th>
              {/* Sortable columns */}
              {(
                [
                  { key: 'name' as SortKey, label: 'Nom' },
                  { key: 'date' as SortKey, label: 'Date' },
                  { key: 'category' as SortKey, label: 'Catégorie' },
                  { key: 'sync_source' as SortKey, label: 'Source' },
                  { key: 'completeness' as SortKey, label: 'Complétude' },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="text-left px-4 py-3 font-semibold text-zinc-600 cursor-pointer select-none hover:text-zinc-900 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortIcon col={key} active={sortKey} dir={sortDir} />
                  </span>
                </th>
              ))}
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">
                Ville
              </th>
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">
                Formats
              </th>
              <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((race) => (
              <tr
                key={race.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selected.has(race.id) ? 'bg-violet-50/50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(race.id)}
                    onChange={() => toggleOne(race.id)}
                    className="rounded border-gray-300 text-violet-500 focus:ring-violet-400 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-zinc-900 truncate">{race.name}</span>
                    {duplicates[race.id]?.possible_duplicate && (
                      <Link
                        href={`/courses/${duplicates[race.id].possible_duplicate!.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        title={`Doublon possible : ${duplicates[race.id].possible_duplicate!.name}`}
                      >
                        <AlertTriangle size={10} />
                        Doublon
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                  {race.date ? formatDate(race.date) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(
                      race.category
                    )}`}
                  >
                    {categoryLabel(race.category)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={race.sync_source} />
                </td>
                <td className="px-4 py-3">
                  <CompletenessBar score={race._score} />
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {race.city}
                  {race.country !== 'France' ? `, ${race.country}` : ''}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {race.formats
                    ? `${race.formats.length} format${race.formats.length > 1 ? 's' : ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setDrawerRaceId(race.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <Eye size={13} />
                      Détail
                    </button>
                    <SingleApproveReject id={race.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginated.length === 0 && (
          <div className="py-12 text-center text-zinc-400 text-sm">
            Aucune course ne correspond aux filtres actifs.
          </div>
        )}
      </div>

      {/* ── Pagination controls ── */}
      {totalPaginatedPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            disabled={page <= 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
            Précédent
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPaginatedPages}
          </span>
          <button
            onClick={() => { setPage(p => Math.min(totalPaginatedPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            disabled={page >= totalPaginatedPages}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── Bulk action sticky bar ── */}
      <BulkBar
        count={selectedCount}
        onApprove={handleBulkApprove}
        onReject={handleBulkReject}
        loading={bulkLoading}
      />

      {/* ── Slide-over preview drawer ── */}
      <RacePreviewDrawer
        raceId={drawerRaceId}
        onClose={() => setDrawerRaceId(null)}
        onApprove={handleDrawerApprove}
        onReject={handleDrawerReject}
      />
    </>
  )
}

// ── Inline single-row approve/reject (no router reload conflict with bulk) ────

function SingleApproveReject({ id }: { id: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function handleApprove() {
    setLoading('approve')
    await fetch(`/api/admin/races/${id}/approve`, { method: 'POST' })
    router.refresh()
    setLoading(null)
  }

  async function handleReject() {
    if (!confirm('Supprimer définitivement cette course ?')) return
    setLoading('reject')
    await fetch(`/api/admin/races/${id}/reject`, { method: 'DELETE' })
    router.refresh()
    setLoading(null)
  }

  return (
    <>
      <button
        onClick={handleApprove}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 transition-colors"
      >
        <CheckCircle size={13} />
        {loading === 'approve' ? '...' : 'Valider'}
      </button>
      <button
        onClick={handleReject}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        <XCircle size={13} />
        {loading === 'reject' ? '...' : 'Rejeter'}
      </button>
    </>
  )
}
