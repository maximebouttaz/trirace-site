'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { formatDate, categoryLabel, categoryColor } from '@/lib/utils'
import type { Race } from '@/lib/types'
import InlineEditField from '@/components/admin/InlineEditField'
import GpxUpload from '@/components/admin/GpxUpload'

export default function AdminRaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [race, setRace] = useState<Race | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)

  const loadRace = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/races/${id}`)
    if (res.ok) {
      const data = await res.json()
      setRace(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadRace() }, [loadRace])

  async function handleApprove() {
    setActionLoading('approve')
    await fetch(`/api/admin/races/${id}/approve`, { method: 'POST' })
    router.push('/admin/sync')
  }

  async function handleReject() {
    if (!confirm('Supprimer définitivement cette course ?')) return
    setActionLoading('reject')
    await fetch(`/api/admin/races/${id}/reject`, { method: 'DELETE' })
    router.push('/admin/sync')
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4 pt-8">
        <div className="h-8 bg-gray-100 rounded-xl w-1/3" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (!race) {
    return (
      <div className="max-w-3xl mx-auto pt-16 text-center">
        <p className="text-zinc-500">Course introuvable.</p>
        <Link href="/admin/sync" className="text-violet-600 hover:underline mt-4 inline-block">
          Retour à la liste
        </Link>
      </div>
    )
  }

  function FieldRow({ label, field }: { label: string; field: string }) {
    return (
      <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
        <span className="w-40 shrink-0 text-xs font-medium text-zinc-400 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <InlineEditField
          raceId={Number(id)}
          field={field}
          value={(race?.[field as keyof Race] as string | number | null) ?? null}
          onSaved={(f, v) => setRace(prev => prev ? { ...prev, [f]: v } : prev)}
          className="flex-1"
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/admin/sync"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Retour à la liste
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={16} />
            {actionLoading === 'approve' ? 'Validation...' : 'Valider et publier'}
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <XCircle size={16} />
            {actionLoading === 'reject' ? 'Suppression...' : 'Rejeter'}
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{race.name}</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {race.city}{race.country !== 'France' ? `, ${race.country}` : ''} — {race.date ? formatDate(race.date) : '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${categoryColor(race.category)}`}>
              {categoryLabel(race.category)}
            </span>
            {race.sync_source && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                {race.sync_source}
              </span>
            )}
          </div>
        </div>

        {/* Image preview */}
        {race.image_url && (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={race.image_url}
              alt={race.name}
              className="w-full h-40 object-cover rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 mb-6">
        <div className="px-5 py-3 bg-gray-50 rounded-t-2xl">
          <h2 className="text-sm font-semibold text-zinc-700">Informations — cliquer pour éditer</h2>
        </div>
        <div className="px-5 py-2">
          <FieldRow label="Nom" field="name" />
          <FieldRow label="Ville" field="city" />
          <FieldRow label="Pays" field="country" />
          <FieldRow label="Date" field="date" />
          <FieldRow label="Catégorie" field="category" />
          <FieldRow label="Région" field="region" />
          <FieldRow label="Département" field="department" />
          <FieldRow label="Description" field="description" />
          <FieldRow label="Tagline" field="tagline" />
          <FieldRow label="Site web" field="website_url" />
          <FieldRow label="Prix (€)" field="price_euros" />
          <FieldRow label="Natation (m)" field="swim_distance" />
          <FieldRow label="Vélo (m)" field="bike_distance" />
          <FieldRow label="Course (m)" field="run_distance" />
          <FieldRow label="Dénivelé (m)" field="total_elevation" />
          <FieldRow label="Latitude" field="latitude" />
          <FieldRow label="Longitude" field="longitude" />
        </div>
      </div>

      {/* GPX Upload */}
      <GpxUpload
        raceId={Number(id)}
        existingSegments={{
          swim: !!race.track_geojson?.swim,
          bike: !!race.track_geojson?.bike,
          run: !!race.track_geojson?.run,
        }}
        onUploaded={loadRace}
      />

      {/* Formats */}
      {race.formats && race.formats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 mb-6">
          <div className="px-5 py-3 bg-gray-50 rounded-t-2xl border-b border-gray-200">
            <h2 className="text-sm font-semibold text-zinc-700">Formats ({race.formats.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {race.formats.map((fmt, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{fmt.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {fmt.swim ? `${fmt.swim}m nat.` : ''}{' '}
                    {fmt.bike ? `${Math.round(fmt.bike / 1000)}km vélo` : ''}{' '}
                    {fmt.run ? `${Math.round(fmt.run / 1000)}km course` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  {fmt.price && <span>{fmt.price}€</span>}
                  {fmt.is_relay && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Relais</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
