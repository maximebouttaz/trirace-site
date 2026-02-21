'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Pencil } from 'lucide-react'
import RaceForm, { type RaceFormData } from '@/components/dashboard/RaceForm'
import type { Race } from '@/lib/types'

interface Props {
  race: Race & { status?: string }
}

export default function EditRaceClient({ race }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: RaceFormData) {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/races/${race.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }

      router.push('/dashboard/races?success=updated')
    } catch {
      setError('Impossible de contacter le serveur. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-900 transition-colors">
          Tableau de bord
        </Link>
        <ChevronRight size={14} className="shrink-0" />
        <Link href="/dashboard/races" className="hover:text-zinc-900 transition-colors">
          Mes courses
        </Link>
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-zinc-700">Modifier</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
          <Pencil size={20} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Modifier la course</h1>
          <p className="text-sm text-zinc-500 mt-0.5 truncate max-w-xs">{race.name}</p>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <RaceForm initialData={race} onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  )
}
