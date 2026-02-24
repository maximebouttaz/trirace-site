import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminSidebar from '@/components/admin/AdminSidebar'

interface Profile {
  id: string
  role: 'organizer' | 'admin'
  full_name: string | null
  email: string | null
}

export default async function AdminLayout({
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
    .select('id, role, full_name, email')
    .eq('id', session.user.id)
    .single<Profile>()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const displayName = profile?.full_name || session.user.email || 'Admin'

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar
        displayName={displayName}
        email={profile?.email || session.user.email || ''}
      />

      {/* Main content */}
      <main className="flex-1 md:ml-56 min-h-screen">
        <div className="px-6 pt-20 pb-6 md:px-10 md:pt-10 md:pb-10">{children}</div>
      </main>
    </div>
  )
}
