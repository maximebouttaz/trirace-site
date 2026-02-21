import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, LayoutDashboard, Flag, PlusCircle, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'

interface Profile {
  id: string
  full_name: string | null
  organization_name: string | null
  email: string | null
  role: 'organizer' | 'admin'
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/dashboard/races', label: 'Mes courses', icon: Flag },
  { href: '/dashboard/races/new', label: 'Ajouter une course', icon: PlusCircle },
  { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, organization_name, email, role')
    .eq('id', session.user.id)
    .single<Profile>()

  const displayName =
    profile?.organization_name || profile?.full_name || session.user.email || 'Organisateur'

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 z-40 bg-gray-50 border-r border-gray-200">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <Trophy size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-zinc-900 tracking-tight">
            Tri<span className="text-red-500">Race</span>
          </span>
          <span className="ml-auto text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Pro
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
            >
              <Icon size={18} className="shrink-0 text-zinc-500 group-hover:text-red-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="shrink-0 border-t border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">
                {profile?.email || session.user.email}
              </p>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Trophy size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-zinc-900">
            Tri<span className="text-red-500">Race</span>
          </span>
        </Link>

        {/* Mobile nav — simple horizontal scroll of icon links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
            >
              <Icon size={18} />
            </Link>
          ))}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Se déconnecter"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-gray-100 transition-all"
            >
              <LogOut size={18} />
            </button>
          </form>
        </nav>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="p-6 md:p-10">{children}</div>
      </main>
    </div>
  )
}
