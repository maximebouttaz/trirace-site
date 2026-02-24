import { createClient } from '@/lib/supabase-server'
import AuditLogClient from './AuditLogClient'

export default async function AdminAuditPage() {
  const supabase = await createClient()

  // Fetch initial data
  const { data, count } = await supabase
    .from('admin_audit_log')
    .select('id, action, race_id, race_name, race_city, admin_email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 49)

  // Get unique admin emails for the filter dropdown
  const { data: adminRows } = await supabase
    .from('admin_audit_log')
    .select('admin_email')

  const uniqueEmails = [...new Set(
    (adminRows ?? [])
      .map(r => r.admin_email)
      .filter((e): e is string => !!e)
  )].sort()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Historique des actions</h1>
        <p className="text-zinc-500 mt-1">
          {(count ?? 0) === 0
            ? 'Aucune action enregistrée.'
            : `${count} action${(count ?? 0) > 1 ? 's' : ''} au total.`}
        </p>
      </div>

      <AuditLogClient
        initialData={data ?? []}
        initialTotal={count ?? 0}
        adminEmails={uniqueEmails}
      />
    </div>
  )
}
