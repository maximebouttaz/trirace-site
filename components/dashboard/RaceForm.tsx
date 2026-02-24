'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Loader2, AlertCircle, Upload, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  image_url: string
  status: string
  swim_type: string
  bike_type: string
  is_wetsuit_allowed: boolean
  is_draft_legal: boolean
  registration_deadline: string
  label: string
  organizer_name: string
  qualification_for: string
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

// ── Step Indicator ──────────────────────────────────────────────────────────

interface StepIndicatorProps {
  step: number
  setStep: (s: number) => void
  isEditMode: boolean
  isStep1Valid: boolean
}

function StepIndicator({ step, setStep, isEditMode, isStep1Valid }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Basique' },
    { number: 2, label: 'Distances' },
    { number: 3, label: 'Enrichissement' },
  ]

  function canNavigateTo(target: number): boolean {
    if (isEditMode) return true
    if (target === 1) return true
    if (target === 2) return isStep1Valid
    if (target === 3) return isStep1Valid
    return false
  }

  return (
    <div className="flex items-center justify-between mb-2">
      {steps.map((s, idx) => {
        const isActive = step === s.number
        const isCompleted = step > s.number
        const isAccessible = canNavigateTo(s.number)

        return (
          <div key={s.number} className="flex items-center flex-1">
            {/* Step circle + label */}
            <button
              type="button"
              disabled={!isAccessible}
              onClick={() => isAccessible && setStep(s.number)}
              className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed group"
            >
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-violet-500 text-white'
                      : 'bg-gray-200 text-zinc-400',
                ].join(' ')}
              >
                {isCompleted ? <Check size={14} /> : s.number}
              </div>
              <span
                className={[
                  'text-xs transition-colors whitespace-nowrap',
                  isActive
                    ? 'font-semibold text-violet-600'
                    : isCompleted
                      ? 'font-medium text-green-600'
                      : 'text-zinc-400',
                ].join(' ')}
              >
                {s.label}
              </span>
            </button>

            {/* Connector line (not after last step) */}
            {idx < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-3 mb-5 rounded-full transition-colors',
                  step > s.number ? 'bg-violet-500' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 — Basique ────────────────────────────────────────────────────────

interface StepProps {
  form: RaceFormData
  errors: Partial<Record<keyof RaceFormData, string>>
  set: (field: keyof RaceFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

function StepBasic({ form, errors, set }: StepProps) {
  return (
    <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-zinc-900 font-semibold text-base mb-2">Informations essentielles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Nom */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Nom de la course <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
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
            value={form.date}
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
          <select value={form.category} onChange={set('category')} className={inputClass}>
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
            value={form.city}
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

        {/* Pays */}
        <div>
          <label className={labelClass}>Pays</label>
          <input
            type="text"
            value={form.country}
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
            value={form.discipline}
            onChange={set('discipline')}
            placeholder="triathlon"
            className={inputClass}
          />
        </div>

      </div>
    </section>
  )
}

// ── Step 2 — Distances & Détails ────────────────────────────────────────────

function StepDistances({ form, errors, set }: StepProps) {
  return (
    <div className="space-y-5">
      {/* Distances */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Distances</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Natation */}
          <div>
            <label className={labelClass}>Natation (mètres)</label>
            <input
              type="number"
              min="0"
              value={form.swim_distance}
              onChange={set('swim_distance')}
              placeholder="Ex : 1500"
              className={inputClass}
            />
            {form.swim_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">{metersToKm(form.swim_distance)}</p>
            )}
          </div>

          {/* Vélo */}
          <div>
            <label className={labelClass}>Vélo (mètres)</label>
            <input
              type="number"
              min="0"
              value={form.bike_distance}
              onChange={set('bike_distance')}
              placeholder="Ex : 40000"
              className={inputClass}
            />
            {form.bike_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">{metersToKm(form.bike_distance)}</p>
            )}
          </div>

          {/* Course à pied */}
          <div>
            <label className={labelClass}>Course à pied (mètres)</label>
            <input
              type="number"
              min="0"
              value={form.run_distance}
              onChange={set('run_distance')}
              placeholder="Ex : 10000"
              className={inputClass}
            />
            {form.run_distance && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">{metersToKm(form.run_distance)}</p>
            )}
          </div>

          {/* Dénivelé */}
          <div>
            <label className={labelClass}>Dénivelé positif total (mètres)</label>
            <input
              type="number"
              min="0"
              value={form.total_elevation}
              onChange={set('total_elevation')}
              placeholder="Ex : 800"
              className={inputClass}
            />
            {form.total_elevation && (
              <p className="mt-1 text-zinc-500 text-xs font-mono">{form.total_elevation} m D+</p>
            )}
          </div>

        </div>
      </section>

      {/* Infos pratiques */}
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
              value={form.price_euros}
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
              value={form.max_participants}
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
              value={form.time_limit_hours}
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
              value={form.website_url}
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

      {/* Description */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Description</h2>
        <div>
          <label className={labelClass}>Description de la course</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={6}
            placeholder="Décrivez votre course, le cadre, les points forts, les services proposés..."
            className={inputClass + ' resize-y min-h-[120px]'}
          />
        </div>
      </section>
    </div>
  )
}

// ── Step 3 — Enrichissement ─────────────────────────────────────────────────

interface StepEnrichProps extends StepProps {
  setBool: (field: keyof RaceFormData) => (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeImage: () => void
  uploading: boolean
}

function StepEnrich({ form, errors, set, setBool, fileInputRef, handleImageUpload, removeImage, uploading }: StepEnrichProps) {
  return (
    <div className="space-y-5">
      {/* Localisation complémentaire */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Localisation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Département */}
          <div>
            <label className={labelClass}>Département</label>
            <input
              type="text"
              value={form.department}
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
              value={form.region}
              onChange={set('region')}
              placeholder="Ex : Auvergne-Rhône-Alpes"
              className={inputClass}
            />
          </div>

        </div>
      </section>

      {/* Photo */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Photo de la course</h2>
        {form.image_url ? (
          <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200">
            <Image
              src={form.image_url}
              alt="Photo de la course"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-red-400 hover:text-red-500 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Upload size={24} />
            )}
            <span className="text-sm font-medium">
              {uploading ? 'Upload en cours...' : 'Cliquer pour ajouter une photo'}
            </span>
            <span className="text-xs">JPEG, PNG ou WebP — 5 Mo max</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        {errors.image_url && (
          <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
            <AlertCircle size={12} /> {errors.image_url}
          </p>
        )}
      </section>

      {/* Informations complémentaires */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-zinc-900 font-semibold text-base mb-2">Informations complémentaires</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Type de natation */}
          <div>
            <label className={labelClass}>Type de natation</label>
            <select value={form.swim_type} onChange={set('swim_type')} className={inputClass}>
              <option value="">Non renseigné</option>
              <option value="lac">Lac</option>
              <option value="mer">Mer</option>
              <option value="rivière">Rivière</option>
              <option value="piscine">Piscine</option>
              <option value="étang">Étang</option>
              <option value="open water">Open water</option>
            </select>
          </div>

          {/* Type de vélo */}
          <div>
            <label className={labelClass}>Type de parcours vélo</label>
            <select value={form.bike_type} onChange={set('bike_type')} className={inputClass}>
              <option value="">Non renseigné</option>
              <option value="route">Route</option>
              <option value="gravel">Gravel</option>
              <option value="mixte">Mixte</option>
              <option value="vtt">VTT</option>
            </select>
          </div>

          {/* Label */}
          <div>
            <label className={labelClass}>Label / Série</label>
            <input
              type="text"
              value={form.label}
              onChange={set('label')}
              placeholder="Ex : FFTRI, Ironman, Challenge..."
              className={inputClass}
            />
          </div>

          {/* Organisateur */}
          <div>
            <label className={labelClass}>Nom de l&apos;organisateur</label>
            <input
              type="text"
              value={form.organizer_name}
              onChange={set('organizer_name')}
              placeholder="Ex : Association Triathlon du Lac"
              className={inputClass}
            />
          </div>

          {/* Date limite d'inscription */}
          <div>
            <label className={labelClass}>Date limite d&apos;inscription</label>
            <input
              type="date"
              value={form.registration_deadline}
              onChange={set('registration_deadline')}
              className={inputClass + ' [color-scheme:light]'}
            />
          </div>

          {/* Qualification pour */}
          <div>
            <label className={labelClass}>Qualificatif pour</label>
            <input
              type="text"
              value={form.qualification_for}
              onChange={set('qualification_for')}
              placeholder="Ex : Kona, Championnat du Monde..."
              className={inputClass}
            />
          </div>

          {/* Checkboxes */}
          <div className="md:col-span-2 flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.is_wetsuit_allowed}
                onChange={setBool('is_wetsuit_allowed')}
                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                Combinaison autorisée
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.is_draft_legal}
                onChange={setBool('is_draft_legal')}
                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                Draft légal (aspiration vélo autorisée)
              </span>
            </label>
          </div>

          {/* Statut */}
          <div className="md:col-span-2">
            <label className={labelClass}>Statut</label>
            <select value={form.status} onChange={set('status')} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

        </div>
      </section>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function RaceForm({ initialData, onSubmit, isLoading = false }: RaceFormProps) {
  const [step, setStep] = useState(1)
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
    image_url: initialData?.image_url ?? '',
    status: (initialData as { status?: string })?.status ?? 'pending',
    swim_type: (initialData as { swim_type?: string })?.swim_type ?? '',
    bike_type: (initialData as { bike_type?: string })?.bike_type ?? '',
    is_wetsuit_allowed: (initialData as { is_wetsuit_allowed?: boolean })?.is_wetsuit_allowed ?? false,
    is_draft_legal: (initialData as { is_draft_legal?: boolean })?.is_draft_legal ?? false,
    registration_deadline: (initialData as { registration_deadline?: string })?.registration_deadline ?? '',
    label: (initialData as { label?: string })?.label ?? '',
    organizer_name: (initialData as { organizer_name?: string })?.organizer_name ?? '',
    qualification_for: (initialData as { qualification_for?: string })?.qualification_for ?? '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof RaceFormData, string>>>({})
  const [uploading, setUploading] = useState(false)
  const [draftBanner, setDraftBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditMode = !!initialData
  const draftKey = `trirace_draft_${(initialData as { id?: string | number })?.id ?? 'new'}`

  // Load draft on mount — creation mode only
  useEffect(() => {
    if (isEditMode) return
    const saved = localStorage.getItem(draftKey)
    if (saved) {
      setDraftBanner(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ formData, step }))
    }, 500)
    return () => clearTimeout(timer)
  }, [formData, step, draftKey])

  function restoreDraft() {
    const saved = localStorage.getItem(draftKey)
    if (saved) {
      try {
        const { formData: savedForm, step: savedStep } = JSON.parse(saved)
        setFormData(savedForm)
        setStep(savedStep)
      } catch {
        // malformed draft — ignore
      }
    }
    setDraftBanner(false)
  }

  function ignoreDraft() {
    localStorage.removeItem(draftKey)
    setDraftBanner(false)
  }

  function set(field: keyof RaceFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function setBool(field: keyof RaceFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.checked }))
    }
  }

  function validateStep1(): boolean {
    const newErrors: Partial<Record<keyof RaceFormData, string>> = {}
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis.'
    if (!formData.date) newErrors.date = 'La date est requise.'
    if (!formData.city.trim()) newErrors.city = 'La ville est requise.'
    if (!formData.category) newErrors.category = 'La catégorie est requise.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function validateStep2(): boolean {
    const newErrors: Partial<Record<keyof RaceFormData, string>> = {}
    if (formData.website_url && !/^https?:\/\/.+/.test(formData.website_url)) {
      newErrors.website_url = "L'URL doit commencer par http:// ou https://"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => Math.min(s + 1, 3))
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep1()) {
      setStep(1)
      return
    }
    await onSubmit(formData)
    localStorage.removeItem(draftKey)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image_url: 'Format accepté : JPEG, PNG ou WebP.' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image_url: 'La taille maximale est de 5 Mo.' }))
      return
    }

    setUploading(true)
    setErrors((prev) => ({ ...prev, image_url: undefined }))

    const ext = file.name.split('.').pop()
    const filePath = `races/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage.from('race-images').upload(filePath, file)
    if (error) {
      setErrors((prev) => ({ ...prev, image_url: "Erreur lors de l'upload." }))
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('race-images').getPublicUrl(filePath)
    setFormData((prev) => ({ ...prev, image_url: urlData.publicUrl }))
    setUploading(false)
  }

  function removeImage() {
    setFormData((prev) => ({ ...prev, image_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isStep1Valid = !!(
    formData.name.trim() &&
    formData.date &&
    formData.city.trim() &&
    formData.category
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Draft banner */}
      {draftBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-700">Un brouillon a été trouvé.</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Reprendre
            </button>
            <button
              type="button"
              onClick={ignoreDraft}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-zinc-600 hover:bg-gray-50 transition-colors"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <StepIndicator
        step={step}
        setStep={setStep}
        isEditMode={isEditMode}
        isStep1Valid={isStep1Valid}
      />

      {/* Step content */}
      {step === 1 && (
        <StepBasic form={formData} errors={errors} set={set} />
      )}
      {step === 2 && (
        <StepDistances form={formData} errors={errors} set={set} />
      )}
      {step === 3 && (
        <StepEnrich
          form={formData}
          errors={errors}
          set={set}
          setBool={setBool}
          fileInputRef={fileInputRef}
          handleImageUpload={handleImageUpload}
          removeImage={removeImage}
          uploading={uploading}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={prevStep}
            className="bg-white border border-gray-200 text-zinc-600 hover:border-gray-300 font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Précédent
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={nextStep}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Suivant
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {isLoading ? 'Enregistrement...' : 'Enregistrer la course'}
          </button>
        )}
      </div>

    </form>
  )
}
