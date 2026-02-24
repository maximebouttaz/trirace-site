import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(10000, Math.max(1, Number(searchParams.get('limit') ?? '50')))
  const action = searchParams.get('action') // 'approve' | 'reject' | null
  const admin = searchParams.get('admin') // email partial match
  const search = searchParams.get('search') // race_name partial match
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = supabase
    .from('admin_audit_log')
    .select('id, action, race_id, race_name, race_city, admin_email, created_at', { count: 'exact' })

  if (action === 'approve' || action === 'reject') {
    query = query.eq('action', action)
  }
  if (admin) {
    query = query.ilike('admin_email', `%${admin}%`)
  }
  if (search) {
    query = query.ilike('race_name', `%${search}%`)
  }
  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00`)
  }
  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59`)
  }

  const start = (page - 1) * limit

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(start, start + limit - 1)

  if (error) {
    console.error('[GET /api/admin/audit]', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({ data: data ?? [], total, page, totalPages })
}
