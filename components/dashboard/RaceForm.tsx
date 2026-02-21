'use client'

import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import type { Race } from '@/lib/types'

export type RaceFormData = {
  name: string
  date: string
  city: string
  department: string
  region: string
  country: string
  category: string
  discipline: string
  swim_distance: string
  bike_distance: string
  run_distance: string
  total_elevation: string
  price_euros: string
  max_participants: string
  time_limit_hours: string
  description: string
  website_url: string
  status: string
}

interface RaceFormProps {
  initialData?: Partial<Race>
  onSubmit: (data: RaceFormData) => Promise<void>
  isLoading?: boolean
}

const CATEGORIES = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'Sprint' },
  { value: 'M', label: 'Olympique' },
  { value: 'L', label: 'Longue Distance' },
  { value: '70.3', label: '70.3' },
  { value: 'XL', label: 'XL' },
  { value: 'Ironman', label: 'Ironman' },
]

const STATUSES = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'pending', label: 'En attente de validation' },
  { value: 'published', label: 'Publié' },
]

function metersToKm(val: string): string {
  const n = parseFloat(val)
  if (!val || isNaN(n)) return ''
  return `${val} m → ${(n / 1000).toFixed(2).replace(/\.?0+$/, '')} km`
}

const inputClass =
  'bg-white border border-gray-200 text-zinc-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 w-full placeholder-zinc-400 transition-colors'
const labelClass = 'text-zinc-500 text-sm mb-1 block'

export default function RaceForm({ initialData, onSubmit, isLoading = false }: RaceFormProps) {
  const [formData, setFormData] = useState<RaceFormData>({
    name: initialData?.name ?? '',
    date: initialData?.date ?? '',
    city: initialData?.city ?? '',
    department: initialData?.department ?? '',
    region: initialData?.region ?? '',
    country: initialData?.country ?? 'France',
    category: initialData?.category ?? '',
    discipline: initialData?.discipline ?? 'triathlon',
    swim_distance: initialData?.swim_distance?.toString() ?? '',
    bike_distance: initialData?.bike_distance?.toString() ?? '',
    run_distance: initialData?.run_distance?.toString() ?? '',
    total_elevation: initialData?.total_elevation?.toString() ?? '',
    price_euros: initialData?.price_euros?.toString() ?? '',
    max_participants: initialData?.max_participants?.toString() ?? '',
    time_limit_hours: initialData?.time_limit_hours?.toString() ?? '',
    description: initialData?.description ?? '',
    website_url: initialData?.website_url ?? '',
    status: (initialData as { status?: string })?.status ?? 'pending',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof RaceFormData, string>>>({})

  function set(field: keyof RaceFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof RaceFormData, string>> = {}
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis.'
    if (!formData.date) newErrors.date = 'La date est requise.'
    if (!formData.city.trim()) newErrors.city = 'La ville est requise.'
    if (!formData.category) newErrors.category = 'La catégorie est requise.'
    if (formData.website_url && !/^https?:\/\/.+/.test(formData.website_url)) {
      newErrors.website_url = "L'URL doit commencer par http:// ou https://"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Section: Informations générales ── */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Informations générales</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Nom */}
          <div className="md:col-span-2">
            <label className={labelClass}>
              Nom de la course <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={set('name')}
              placeholder="Ex : Triathlon des Volcans"
              className={inputClass}
            />
            {errors.name && (
              <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {errors.name}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={set('date')}
              className={inputClass + ' [color-scheme:light]'}
            />
            {errors.date && (
              <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {errors.date}
              </p>
            )}
          </div>

          {/* Catégorie */}
          <div>
            <label className={labelClass}>
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={set('category')}
              className={inputClass}
            >
              <option value="" disabled>
                Sélectionner une catégorie
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {errors.category}
              </p>
            )}
          </div>

          {/* Ville */}
          <div>
            <label className={labelClass}>
              Ville <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={set('city')}
              placeholder="Ex : Clermont-Ferrand"
              className={inputClass}
            />
            {errors.city && (
              <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {errors.city}
              </p>
            )}
          </div>

          {/* Département */}
          <div>
            <label className={labelClass}>Département</label>
            <input
              type="text"
              value={formData.department}
              onChange={set('department')}
              placeholder="Ex : Puy-de-Dôme"
              className={inputClass}
            />
          </div>

          {/* Région */}
          <div>
            <label className={labelClass}>Région</label>
            <input
              type="text"
              value={formData.region}
              onChange={set('region')}
              placeholder="Ex : Auvergne-Rhône-Alpes"
              className={inputClass}
            />
          </div>

          {/* Pays */}
          <div>
            <label className={labelClass}>Pays</label>
            <input
              type="text"
              value={formData.country}
              onChange={set('country')}
              placeholder="France"
              className={inputClass}
            />
          </div>

          {/* Discipline */}
          <div>
            <label className={labelClass}>Discipline</label>
            <input
              type="text"
              value={formData.discipline}
              onChange={set('discipline')}
              placeholder="triathlon"
              className={inputClass}
            />
          </div>

          {/* Statut */}
          <div>
            <label className={labelClass}>Statut</label>
            <select value={formData.status} onChange={set('status')} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Section: Distances ── */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Distances</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Natation */}
          <div>
            <label className={labelClass}>Natation (mètres)</label>
            <input
              type="number"
              min="0"
              value={formData.swim_distance}
              onChange={set('swim_distance')}
              placeholder="Ex : 1500"
              className={inputClass}
            />
            {formData.swim_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">
                {metersToKm(formData.swim_distance)}
              </p>
            )}
          </div>

          {/* Vélo */}
          <div>
            <label className={labelClass}>Vélo (mètres)</label>
            <input
              type="number"
              min="0"
              value={formData.bike_distance}
              onChange={set('bike_distance')}
              placeholder="Ex : 40000"
              className={inputClass}
            />
            {formData.bike_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">
                {metersToKm(formData.bike_distance)}
              </p>
            )}
          </div>

          {/* Course à pied */}
          <div>
            <label className={labelClass}>Course à pied (mètres)</label>
            <input
              type="number"
              min="0"
              value={formData.run_distance}
              onChange={set('run_distance')}
              placeholder="Ex : 10000"
              className={inputClass}
            />
            {formData.run_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">
                {metersToKm(formData.run_distance)}
              </p>
            )}
          </div>

          {/* Dénivelé total */}
          <div>
            <label className={labelClass}>Dénivelé positif total (mètres)</label>
            <input
              type="number"
              min="0"
              value={formData.total_elevation}
              onChange={set('total_elevation')}
              placeholder="Ex : 800"
              className={inputClass}
            />
            {formData.total_elevation && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">
                {formData.total_elevation} m D+
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Section: Infos pratiques ── */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Infos pratiques</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Prix */}
          <div>
            <label className={labelClass}>Prix d&apos;inscription (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.price_euros}
              onChange={set('price_euros')}
              placeholder="Ex : 65"
              className={inputClass}
            />
          </div>

          {/* Participants max */}
          <div>
            <label className={labelClass}>Participants maximum</label>
            <input
              type="number"
              min="0"
              value={formData.max_participants}
              onChange={set('max_participants')}
              placeholder="Ex : 1000"
              className={inputClass}
            />
          </div>

          {/* Temps limite */}
          <div>
            <label className={labelClass}>Temps limite (heures)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={formData.time_limit_hours}
              onChange={set('time_limit_hours')}
              placeholder="Ex : 5.5"
              className={inputClass}
            />
          </div>

          {/* Site web */}
          <div className="md:col-span-3">
            <label className={labelClass}>Site web officiel</label>
            <input
              type="url"
              value={formData.website_url}
              onChange={set('website_url')}
              placeholder="https://www.mon-triathlon.fr"
              className={inputClass}
            />
            {errors.website_url && (
              <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {errors.website_url}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Section: Description ── */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Description</h2>
        <div>
          <label className={labelClass}>Description de la course</label>
          <textarea
            value={formData.description}
            onChange={set('description')}
            rows={6}
            placeholder="Décrivez votre course, le cadre, les points forts, les services proposés..."
            className={inputClass + ' resize-y min-h-[120px]'}
          />
        </div>
      </section>

      {/* ── Submit ── */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? 'Enregistrement...' : 'Enregistrer la course'}
        </button>
      </div>
    </form>
  )
}
