'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ExternalLink } from 'lucide-react'
import GpxUpload from '@/components/admin/GpxUpload'
import MultiUrlScraper from '@/components/admin/MultiUrlScraper'
import AdminRaceForm, { type AdminRaceFormData, EMPTY_FORM_DATA } from '@/components/admin/AdminRaceForm'
import type { ScrapedFields } from '@/lib/scrape-fields'

export default function NewRaceClient() {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<AdminRaceFormData>>({})
  const [scrapedFields, setScrapedFields] = useState<Set<string>>(new Set())
  const [scraperDone, setScraperDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<{ slug: string; id: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMergedData = useCallback(
    (data: Partial<ScrapedFields>, keys: Set<string>) => {
      // Convert ScrapedFields to form data (strings)
      const partial: Partial<AdminRaceFormData> = {}
      for (const [k, v] of Object.entries(data)) {
        if (v != null) {
          (partial as Record<string, string>)[k] = String(v)
        }
      }
      setFormData(partial)
      setScrapedFields(keys)
      setScraperDone(true)
    },
    []
  )

  async function handleSubmit(data: AdminRaceFormData) {
    setSaving(true)
    setError(null)

    // Convert form strings to proper types for API
    const payload: Record<string, unknown> = { ...data }

    // Booleans
    payload.is_wetsuit_allowed = data.is_wetsuit_allowed === 'true' ? true : data.is_wetsuit_allowed === 'false' ? false : null
    payload.is_draft_legal = data.is_draft_legal === 'true' ? true : data.is_draft_legal === 'false' ? false : null

    // Remove empty strings
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null
    }

    try {
      const res = await fetch('/api/admin/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Erreur inconnue.')
        setSaving(false)
        return
      }

      setSuccess({ slug: json.race.slug, id: json.race.id })
      setSaving(false)
    } catch {
      setError('Erreur reseau.')
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <CheckCircle size={48} className="text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-900">Course creee !</h2>
        <p className="text-sm text-zinc-500">
          La course a ete publiee et est accessible sur le site.
        </p>
        <div className="max-w-md mx-auto mt-6">
          <GpxUpload raceId={success.id} existingSegments={{}} />
        </div>
        <div className="flex items-center justify-center gap-3 pt-4">
          <a
            href={`/courses/${success.slug}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Voir la course
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => {
              setSuccess(null)
              setScraperDone(false)
              setFormData({})
              setScrapedFields(new Set())
              setError(null)
            }}
            className="px-5 py-2.5 rounded-xl text-zinc-500 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Creer une autre course
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Ajouter une course</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Scrapez des URLs ou remplissez directement le formulaire.
        </p>
      </div>

      <MultiUrlScraper onMergedData={handleMergedData} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {scraperDone && (
        <AdminRaceForm
          initialData={{ ...EMPTY_FORM_DATA, ...formData }}
          scrapedFields={scrapedFields}
          onSubmit={handleSubmit}
          isLoading={saving}
        />
      )}
    </div>
  )
}
