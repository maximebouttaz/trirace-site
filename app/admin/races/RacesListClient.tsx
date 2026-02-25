'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { categoryLabel, categoryColor, formatDate } from '@/lib/utils'

interface RaceRow {
  id: number
  slug: string
  name: string
  city: string
  country: string
  category: string
  date: string | null
  swim_distance: number | null
  bike_distance: number | null
  run_distance: number | null
  description: string | null
  image_url: string | null
  website_url: string | null
}

interface Props {
  initialRaces: RaceRow[]
  initialTotal: number
}

const PAGE_SIZE = 50

export default function RacesListClient({ initialRaces, initialTotal }: Props) {
  const [races, setRaces] = useState<RaceRow[]>(initialRaces)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleDelete(race: RaceRow) {
    if (!confirm(`Supprimer "${race.name}" ?\n\nLa course sera déplacée dans la corbeille.`)) return
    setDeletingId(race.id)
    const res = await fetch(`/api/admin/races/${race.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      setRaces((prev) => prev.filter((r) => r.id !== race.id))
      setTotal((prev) => prev - 1)
    }
  }

  const fetchRaces = useCallback(async (q: string, cat: string, p: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(p * PAGE_SIZE))
    if (q) params.set('search', q)
    if (cat) params.set('category', cat)
    const res = await fetch(`/api/admin/races-list?${params}`)
    if (res.ok) {
      const json = await res.json()
      setRaces(json.data ?? [])
      setTotal(json.total ?? 0)
    }
    setLoading(false)
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0)
      fetchRaces(search, category, 0)
    }, 300)
    return () => clearTimeout(t)
  }, [search, category, fetchRaces])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handlePage(newPage: number) {
    setPage(newPage)
    fetchRaces(search, category, newPage)
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Courses</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {total} course{total > 1 ? 's' : ''} au total
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">Toutes categories</option>
          <option value="XS">XS</option>
          <option value="S">S (Sprint)</option>
          <option value="M">M (Olympique)</option>
          <option value="L">L</option>
          <option value="70.3">70.3</option>
          <option value="XL">XL</option>
          <option value="Ironman">Ironman</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">Chargement...</div>
        ) : races.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">Aucune course trouvee.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                  Ville
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                  Categorie
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {races.map((race) => (
                <tr key={race.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 truncate max-w-[220px]">{race.name}</p>
                    <p className="text-xs text-zinc-400 md:hidden">
                      {race.city} · {categoryLabel(race.category)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">{race.city}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColor(race.category)}`}
                    >
                      {categoryLabel(race.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                    {race.date ? formatDate(race.date) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/races/${race.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
                      >
                        <Pencil size={12} />
                        Modifier
                      </Link>
                      <button
                        onClick={() => handleDelete(race)}
                        disabled={deletingId === race.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40 transition-colors"
                        title="Supprimer (corbeille)"
                      >
                        <Trash2 size={12} />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-zinc-500">
            Page {page + 1} / {totalPages} · {total} resultats
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePage(page - 1)}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} /> Prec.
            </button>
            <button
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Suiv. <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
