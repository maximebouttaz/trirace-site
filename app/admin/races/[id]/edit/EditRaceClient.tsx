'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import GpxUpload from '@/components/admin/GpxUpload'
import MultiUrlScraper from '@/components/admin/MultiUrlScraper'
import AdminRaceForm, { type AdminRaceFormData, EMPTY_FORM_DATA } from '@/components/admin/AdminRaceForm'
import type { ScrapedFields } from '@/lib/scrape-fields'
import type { Race } from '@/lib/types'

interface Props {
  race: Race & { id: number }
}

/** Convert a Race DB object into the string-based AdminRaceFormData */
function raceToFormData(race: Race): Partial<AdminRaceFormData> {
  const str = (v: unknown) => (v != null ? String(v) : '')
  return {
    name: str(race.name),
    date: race.date ?? '',
    category: race.category ?? '',
    city: race.city ?? '',
    country: race.country ?? 'France',
    discipline: race.discipline ?? 'triathlon',
    swim_distance: str(race.swim_distance),
    bike_distance: str(race.bike_distance),
    run_distance: str(race.run_distance),
    total_elevation: str(race.total_elevation),
    bike_elevation: str(race.bike_elevation),
    run_elevation: str(race.run_elevation),
    price_euros: str(race.price_euros),
    max_participants: str(race.max_participants),
    time_limit_hours: str(race.time_limit_hours),
    website_url: race.website_url ?? '',
    finishers_url: race.finishers_url ?? '',
    region: race.region ?? '',
    department: race.department ?? '',
    latitude: str(race.latitude),
    longitude: str(race.longitude),
    description: race.description ?? '',
    tagline: race.tagline ?? '',
    image_url: race.image_url ?? '',
    image_gradient: race.image_gradient ?? '',
    tags: Array.isArray(race.tags) ? race.tags.join(', ') : '',
    swim_type: race.swim_type ?? '',
    bike_type: race.bike_type ?? '',
    label: race.label ?? '',
    organizer_name: race.organizer_name ?? '',
    registration_deadline: race.registration_deadline ?? '',
    qualification_for: race.qualification_for ?? '',
    is_wetsuit_allowed: race.is_wetsuit_allowed != null ? String(race.is_wetsuit_allowed) : '',
    is_draft_legal: race.is_draft_legal != null ? String(race.is_draft_legal) : '',
    record_men: race.record_men ?? '',
    record_women: race.record_women ?? '',
    avg_temp_high_celsius: str(race.avg_temp_high_celsius),
    avg_temp_low_celsius: str(race.avg_temp_low_celsius),
    avg_water_temp_celsius: str(race.avg_water_temp_celsius),
    avg_wind_kmh: str(race.avg_wind_kmh),
    finishers_count: str(race.finishers_count),
    swim_cutoff_minutes: str(race.swim_cutoff_minutes),
    bike_cutoff_minutes: str(race.bike_cutoff_minutes),
    run_cutoff_minutes: str(race.run_cutoff_minutes),
    gpx_url: race.gpx_url ?? '',
    swim_gpx_url: race.swim_gpx_url ?? '',
    bike_gpx_url: race.bike_gpx_url ?? '',
    run_gpx_url: race.run_gpx_url ?? '',
    registration_status: race.registration_status ?? '',
  }
}

export default function EditRaceClient({ race }: Props) {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<AdminRaceFormData>>(raceToFormData(race))
  const [scrapedFields, setScrapedFields] = useState<Set<string>>(new Set())
  const [gpxData, setGpxData] = useState<{
    track_geojson?: Record<string, unknown>
    elevation_profile?: Record<string, unknown>
  }>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMergedData = useCallback(
    (data: Partial<ScrapedFields>, keys: Set<string>) => {
      const NON_STRING_FIELDS = ['track_geojson', 'elevation_profile']
      const newGpxData: typeof gpxData = {}
      const partial: Partial<AdminRaceFormData> = {}

      for (const [k, v] of Object.entries(data)) {
        if (v == null) continue
        if (NON_STRING_FIELDS.includes(k)) {
          newGpxData[k as 'track_geojson' | 'elevation_profile'] = v as Record<string, unknown>
          continue
        }
        ;(partial as Record<string, string>)[k] = String(v)
      }

      setFormData((prev) => ({ ...prev, ...partial }))
      setScrapedFields(keys)
      if (Object.keys(newGpxData).length > 0) setGpxData(newGpxData)
    },
    []
  )

  async function handleSubmit(data: AdminRaceFormData) {
    setSaving(true)
    setSaved(false)
    setError(null)

    const payload: Record<string, unknown> = { ...data }

    // Booleans
    payload.is_wetsuit_allowed =
      data.is_wetsuit_allowed === 'true'
        ? true
        : data.is_wetsuit_allowed === 'false'
        ? false
        : null
    payload.is_draft_legal =
      data.is_draft_legal === 'true' ? true : data.is_draft_legal === 'false' ? false : null

    // Tags : convertir la string CSV en tableau
    if (typeof payload.tags === 'string') {
      payload.tags = payload.tags ? payload.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : null
    }

    // Remove empty strings -> null
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null
    }

    // Attach GPX data if re-scraped
    if (gpxData.track_geojson) payload.track_geojson = gpxData.track_geojson
    if (gpxData.elevation_profile) payload.elevation_profile = gpxData.elevation_profile

    // Recalculate total_distance
    const swim = payload.swim_distance ? Number(payload.swim_distance) : null
    const bike = payload.bike_distance ? Number(payload.bike_distance) : null
    const run = payload.run_distance ? Number(payload.run_distance) : null
    if (swim != null || bike != null || run != null) {
      payload.total_distance = (swim ?? 0) + (bike ?? 0) + (run ?? 0)
    }

    try {
      const res = await fetch(`/api/admin/races/${race.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erreur inconnue.')
        setSaving(false)
        return
      }

      setSaved(true)
      setSaving(false)
      // Refresh page data after 1.5s to reflect changes
      setTimeout(() => router.refresh(), 1500)
    } catch {
      setError('Erreur reseau.')
      setSaving(false)
    }
  }

  const existingSegments = {
    swim: !!(
      race.track_geojson && (race.track_geojson as Record<string, unknown>).swim
    ),
    bike: !!(
      race.track_geojson && (race.track_geojson as Record<string, unknown>).bike
    ),
    run: !!(
      race.track_geojson && (race.track_geojson as Record<string, unknown>).run
    ),
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/races"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Retour aux courses
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Modifier la course</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {race.name} · {race.city}
            </p>
          </div>
          <a
            href={`/courses/${race.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-zinc-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            <ExternalLink size={12} /> Voir la course
          </a>
        </div>
      </div>

      {/* Scraper — optional re-scraping */}
      <MultiUrlScraper onMergedData={handleMergedData} />

      {/* GPX Upload */}
      <GpxUpload raceId={race.id} existingSegments={existingSegments} />

      {/* Success / Error banners */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} />
          Modifications enregistrees.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <AdminRaceForm
        initialData={{ ...EMPTY_FORM_DATA, ...formData }}
        scrapedFields={scrapedFields}
        onSubmit={handleSubmit}
        isLoading={saving}
      />
    </div>
  )
}
