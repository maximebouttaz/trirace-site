'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Clock, TrendingUp, Database, Eye } from 'lucide-react'
import { formatDate, categoryLabel, categoryColor } from '@/lib/utils'
import ApproveRejectButtons from './ApproveRejectButtons'
import RacePreviewDrawer from '@/components/admin/RacePreviewDrawer'

interface RaceRow {
  id: number
  name: string
  city: string
  country: string
  date: string | null
  category: string
  sync_source: string | null
  formats: Array<{ name: string }> | null
  created_at: string | null
}

interface Stats {
  pending: number
  approved_this_month: number
  rejected_this_month: number
  by_source: Record<string, number>
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-zinc-400 text-xs">—</span>
  const styles: Record<string, string> = {
    milesrepublic: 'bg-violet-50 text-violet-700 border-violet-200',
    finishers: 'bg-orange-50 text-orange-700 border-orange-200',
    manual: 'bg-gray-100 text-zinc-600 border-gray-200',
  }
  const cls = styles[source] ?? 'bg-gray-100 text-zinc-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {source}
    </span>
  )
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
      <div className={`p-2.5 rounded-xl ${iconClass}`}>
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

export default function SyncPageClient({ initialRaces }: { initialRaces: RaceRow[] }) {
  const [races, setRaces] = useState<RaceRow[]>(initialRaces)
  const [stats, setStats] = useState<Stats | null>(null)
  const [drawerRaceId, setDrawerRaceId] = useState<number | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // Stats are non-critical, ignore errors
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  function handleApprove(id: number) {
    setRaces(prev => prev.filter(r => r.id !== id))
    setDrawerRaceId(null)
    setStats(prev => prev ? { ...prev, pending: Math.max(0, prev.pending - 1), approved_this_month: prev.approved_this_month + 1 } : prev)
  }

  function handleReject(id: number) {
    setRaces(prev => prev.filter(r => r.id !== id))
    setDrawerRaceId(null)
    setStats(prev => prev ? { ...prev, pending: Math.max(0, prev.pending - 1) } : prev)
  }

  const topSource = stats
    ? Object.entries(stats.by_source).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <>
      {/* Stats banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Clock}
          label="En attente de validation"
          value={stats ? stats.pending : races.length}
          iconClass="bg-violet-50 text-violet-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Validees ce mois"
          value={stats?.approved_this_month ?? '—'}
          iconClass="bg-green-50 text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Rejetees ce mois"
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

      {/* Table */}
      {races.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle size={48} className="text-green-400 mb-4" />
          <p className="text-lg font-semibold text-zinc-700">Tout est a jour !</p>
          <p className="text-zinc-500 text-sm mt-1">Aucune course a valider pour le moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Ville</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Categorie</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Formats</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {races.map((race) => (
                <tr key={race.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900 max-w-[220px] truncate">
                    {race.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {race.city}{race.country !== 'France' ? `, ${race.country}` : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {race.date ? formatDate(race.date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(race.category)}`}>
                      {categoryLabel(race.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge source={race.sync_source} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {race.formats ? `${race.formats.length} format${race.formats.length > 1 ? 's' : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDrawerRaceId(race.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Eye size={13} />
                        Detail
                      </button>
                      <ApproveRejectButtons id={race.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over drawer */}
      <RacePreviewDrawer
        raceId={drawerRaceId}
        onClose={() => setDrawerRaceId(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  )
}
