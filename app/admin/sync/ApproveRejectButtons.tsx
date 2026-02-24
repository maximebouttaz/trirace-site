'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'

export default function ApproveRejectButtons({ id }: { id: number }) {
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
