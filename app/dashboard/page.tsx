import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusCircle, Flag, CheckCircle2, Clock, FileEdit, ArrowRight, Calendar, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import StatusBadge from '@/components/dashboard/StatusBadge'

interface Profile {
  id: string
  full_name: string | null
  organization_name: string | null
  email: string | null
  role: 'organizer' | 'admin'
}

interface Race {
  id: number
  name: string
  date: string | null
  city: string
  category: string
  status: 'published' | 'pending' | 'draft'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, organization_name, email, role')
    .eq('id', session.user.id)
    .single<Profile>()

  const organizerName =
    profile?.organization_name || profile?.full_name || 'votre organisation'

  // Fetch all races for this organizer
  const { data: racesData } = await supabase
    .from('races')
    .select('id, name, date, city, category, status')
    .eq('organizer_id', session.user.id)
    .order('date', { ascending: false })

  const races = (racesData || []) as Race[]

  const totalRaces = races.length
  const publishedRaces = races.filter((r) => r.status === 'published').length
  const pendingRaces = races.filter((r) => r.status === 'pending').length
  const draftRaces = races.filter((r) => r.status === 'draft').length

  const recentRaces = races.slice(0, 5)

  const STATS = [
    {
      label: 'Total courses',
      value: totalRaces,
      icon: Flag,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Publiées',
      value: publishedRaces,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'En attente',
      value: pendingRaces,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Brouillons',
      value: draftRaces,
      icon: FileEdit,
      color: 'text-zinc-500',
      bg: 'bg-gray-200/50',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 font-medium mb-1">Tableau de bord</p>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
            Bienvenue,{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              {organizerName}
            </span>
          </h1>
        </div>
        <Link
          href="/dashboard/races/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all shrink-0"
        >
          <PlusCircle size={16} />
          Ajouter une course
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900">{value}</p>
              <p className="text-xs text-zinc-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent races */}
      <div className="bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-zinc-900">Courses récentes</h2>
          <Link
            href="/dashboard/races"
            className="flex items-center gap-1 text-sm font-semibold text-red-400 hover:text-red-300 transition"
          >
            Voir tout <ArrowRight size={14} />
          </Link>
        </div>

        {recentRaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Flag size={24} className="text-zinc-400" />
            </div>
            <p className="text-zinc-900 font-semibold mb-1">Aucune course pour le moment</p>
            <p className="text-sm text-zinc-500 mb-6">
              Commencez par ajouter votre première course.
            </p>
            <Link
              href="/dashboard/races/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all"
            >
              <PlusCircle size={16} />
              Ajouter une course
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentRaces.map((race) => (
              <div
                key={race.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-100/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{race.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Calendar size={11} />
                      {formatDate(race.date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin size={11} />
                      {race.city}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">{race.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <StatusBadge status={race.status} />
                  <Link
                    href={`/dashboard/races/${race.id}/edit`}
                    className="text-xs text-zinc-500 hover:text-zinc-900 transition opacity-0 group-hover:opacity-100"
                  >
                    Modifier
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
