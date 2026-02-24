'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface AuditEntry {
  id: number
  action: 'approve' | 'reject'
  race_id: number | null
  race_name: string | null
  race_city: string | null
  admin_email: string | null
  created_at: string
}

interface Props {
  initialData: AuditEntry[]
  initialTotal: number
  adminEmails: string[]
}

function ActionBadge({ action }: { action: 'approve' | 'reject' }) {
  if (action === 'approve') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        Validée
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      Rejetée
    </span>
  )
}

function formatDatetime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const PAGE_SIZE = 50

type SortCol = 'created_at' | 'action' | 'race_name' | 'admin_email'

export default function AuditLogClient({ initialData, initialTotal, adminEmails }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / PAGE_SIZE))
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [adminFilter, setAdminFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Debounce search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEntries = useCallback(
    async (p: number, s: string, action: string, admin: string, df: string, dt: string) => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (s) params.set('search', s)
      if (action) params.set('action', action)
      if (admin) params.set('admin', admin)
      if (df) params.set('date_from', df)
      if (dt) params.set('date_to', dt)
      const res = await fetch(`/api/admin/audit?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(data.page)
      }
      setLoading(false)
    },
    []
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      fetchEntries(1, value, actionFilter, adminFilter, dateFrom, dateTo)
    }, 300)
  }

  function handleActionChange(value: string) {
    setActionFilter(value)
    fetchEntries(1, search, value, adminFilter, dateFrom, dateTo)
  }

  function handleAdminChange(value: string) {
    setAdminFilter(value)
    fetchEntries(1, search, actionFilter, value, dateFrom, dateTo)
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value)
    fetchEntries(1, search, actionFilter, adminFilter, value, dateTo)
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    fetchEntries(1, search, actionFilter, adminFilter, dateFrom, value)
  }

  function handlePageChange(nextPage: number) {
    fetchEntries(nextPage, search, actionFilter, adminFilter, dateFrom, dateTo)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'created_at' ? 'desc' : 'asc')
    }
  }

  // Client-side sort (server already sorts by created_at desc, but we allow re-sort)
  const sortedEntries = [...entries].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    } else if (sortCol === 'action') {
      cmp = (a.action ?? '').localeCompare(b.action ?? '')
    } else if (sortCol === 'race_name') {
      cmp = (a.race_name ?? '').localeCompare(b.race_name ?? '')
    } else if (sortCol === 'admin_email') {
      cmp = (a.admin_email ?? '').localeCompare(b.admin_email ?? '')
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown size={12} className="text-zinc-300" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-violet-500" />
      : <ArrowDown size={12} className="text-violet-500" />
  }

  async function handleExportCSV() {
    // Fetch all entries without pagination
    const params = new URLSearchParams({ limit: '10000' })
    if (search) params.set('search', search)
    if (actionFilter) params.set('action', actionFilter)
    if (adminFilter) params.set('admin', adminFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)

    const res = await fetch(`/api/admin/audit?${params}`)
    if (!res.ok) return

    const json = await res.json()
    const rows: AuditEntry[] = json.data

    // Build CSV
    const header = 'Date,Action,Course,Ville,Admin'
    const csvRows = rows.map(e =>
      [
        formatDatetime(e.created_at),
        e.action === 'approve' ? 'Validée' : 'Rejetée',
        `"${(e.race_name ?? '').replace(/"/g, '""')}"`,
        `"${(e.race_city ?? '').replace(/"/g, '""')}"`,
        e.admin_email ?? '',
      ].join(',')
    )
    const csv = [header, ...csvRows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Rechercher une course..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-400 w-48"
          />
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Action filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action</span>
          <select
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
            className="text-xs font-medium bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">Toutes</option>
            <option value="approve">Validées</option>
            <option value="reject">Rejetées</option>
          </select>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Admin filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Admin</span>
          <select
            value={adminFilter}
            onChange={(e) => handleAdminChange(e.target.value)}
            className="text-xs font-medium bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">Tous</option>
            {adminEmails.map(email => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Période</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="text-xs font-medium bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <span className="text-xs text-zinc-400">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="text-xs font-medium bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {total} entrée{total > 1 ? 's' : ''}
          </span>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                onClick={() => handleSort('created_at')}
                className="text-left px-4 py-3 font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 select-none"
              >
                <span className="inline-flex items-center gap-1">
                  Date / Heure
                  <SortIcon col="created_at" />
                </span>
              </th>
              <th
                onClick={() => handleSort('action')}
                className="text-left px-4 py-3 font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 select-none"
              >
                <span className="inline-flex items-center gap-1">
                  Action
                  <SortIcon col="action" />
                </span>
              </th>
              <th
                onClick={() => handleSort('race_name')}
                className="text-left px-4 py-3 font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 select-none"
              >
                <span className="inline-flex items-center gap-1">
                  Course
                  <SortIcon col="race_name" />
                </span>
              </th>
              <th
                onClick={() => handleSort('admin_email')}
                className="text-left px-4 py-3 font-semibold text-zinc-600 cursor-pointer hover:text-zinc-900 select-none"
              >
                <span className="inline-flex items-center gap-1">
                  Admin
                  <SortIcon col="admin_email" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                  {formatDatetime(entry.created_at)}
                </td>
                <td className="px-4 py-3">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {entry.race_name ?? <span className="text-zinc-400">—</span>}
                  {entry.race_city && (
                    <span className="text-zinc-500 font-normal ml-1">({entry.race_city})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {entry.admin_email ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedEntries.length === 0 && !loading && (
          <div className="py-12 text-center text-zinc-400 text-sm">
            Aucune entrée ne correspond aux filtres actifs.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
            Précédent
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </>
  )
}
