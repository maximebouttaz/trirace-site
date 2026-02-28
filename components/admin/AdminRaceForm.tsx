'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, Loader2, AlertCircle, Sparkles } from 'lucide-react'

export interface AdminRaceFormData {
  name: string
  date: string
  category: string
  city: string
  country: string
  discipline: string
  swim_distance: string
  bike_distance: string
  run_distance: string
  total_elevation: string
  bike_elevation: string
  run_elevation: string
  price_euros: string
  max_participants: string
  time_limit_hours: string
  website_url: string
  finishers_url: string
  region: string
  department: string
  latitude: string
  longitude: string
  description: string
  tagline: string
  image_url: string
  image_gradient: string
  tags: string
  swim_type: string
  bike_type: string
  run_type: string
  label: string
  organizer_name: string
  registration_deadline: string
  qualification_for: string
  is_wetsuit_allowed: string
  is_draft_legal: string
  record_men: string
  record_women: string
  avg_temp_high_celsius: string
  avg_temp_low_celsius: string
  avg_water_temp_celsius: string
  avg_wind_kmh: string
  finishers_count: string
  swim_cutoff_minutes: string
  bike_cutoff_minutes: string
  run_cutoff_minutes: string
  run_laps: string
  gpx_url: string
  swim_gpx_url: string
  bike_gpx_url: string
  run_gpx_url: string
  registration_status: string
}

export const EMPTY_FORM_DATA: AdminRaceFormData = {
  name: '',
  date: '',
  category: '',
  city: '',
  country: 'France',
  discipline: 'triathlon',
  swim_distance: '',
  bike_distance: '',
  run_distance: '',
  total_elevation: '',
  bike_elevation: '',
  run_elevation: '',
  price_euros: '',
  max_participants: '',
  time_limit_hours: '',
  website_url: '',
  finishers_url: '',
  region: '',
  department: '',
  latitude: '',
  longitude: '',
  description: '',
  tagline: '',
  image_url: '',
  image_gradient: '',
  tags: '',
  swim_type: '',
  bike_type: '',
  run_type: '',
  label: '',
  organizer_name: '',
  registration_deadline: '',
  qualification_for: '',
  is_wetsuit_allowed: '',
  is_draft_legal: '',
  record_men: '',
  record_women: '',
  avg_temp_high_celsius: '',
  avg_temp_low_celsius: '',
  avg_water_temp_celsius: '',
  avg_wind_kmh: '',
  finishers_count: '',
  swim_cutoff_minutes: '',
  bike_cutoff_minutes: '',
  run_cutoff_minutes: '',
  run_laps: '',
  gpx_url: '',
  swim_gpx_url: '',
  bike_gpx_url: '',
  run_gpx_url: '',
  registration_status: '',
}

interface AdminRaceFormProps {
  initialData: Partial<AdminRaceFormData>
  scrapedFields: Set<string>
  onSubmit: (data: AdminRaceFormData) => Promise<void>
  isLoading: boolean
  raceId?: number
}

const CATEGORIES = [
  { value: '', label: 'Choisir...' },
  { value: 'XS', label: 'XS (Super Sprint)' },
  { value: 'S', label: 'S (Sprint)' },
  { value: 'M', label: 'M (Olympique)' },
  { value: 'L', label: 'L (Long Distance)' },
  { value: '70.3', label: '70.3 (Half / Ironman 70.3)' },
  { value: 'XL', label: 'XL' },
  { value: 'Ironman', label: 'Ironman (XXL)' },
]

const SWIM_TYPES = [
  { value: '', label: '-' },
  { value: 'lac', label: 'Lac' },
  { value: 'mer', label: 'Mer' },
  { value: 'ocean', label: 'Océan' },
  { value: 'riviere', label: 'Rivière' },
  { value: 'baie', label: 'Baie' },
]

const TERRAIN_TYPES = [
  { value: '', label: '-' },
  { value: 'flat', label: 'Plat' },
  { value: 'rolling', label: 'Roulant' },
  { value: 'hilly', label: 'Vallonné' },
]

export default function AdminRaceForm({
  initialData,
  scrapedFields,
  onSubmit,
  isLoading,
  raceId,
}: AdminRaceFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<AdminRaceFormData>({
    ...EMPTY_FORM_DATA,
    ...initialData,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof AdminRaceFormData, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [meteoLoading, setMeteoLoading] = useState(false)
  const [meteoError,   setMeteoError]   = useState<string | null>(null)

  useEffect(() => {
    if (form.latitude && form.longitude) return
    if (!form.city || form.city.trim().length < 3) return

    const timer = setTimeout(async () => {
      setIsGeocoding(true)
      try {
        const raw: Record<string, string> = {
          city:    form.city.trim(),
          country: form.country || 'France',
          format:  'json',
          limit:   '1',
        }
        if (form.region)     raw.state  = form.region.trim()
        if (form.department) raw.county = form.department.trim()
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${new URLSearchParams(raw)}`,
          { headers: { 'User-Agent': 'TriRace/1.0 admin-form' } }
        )
        if (res.ok) {
          const data = await res.json()
          if (data?.[0]) {
            setForm(prev => ({
              ...prev,
              latitude:  String(data[0].lat),
              longitude: String(data[0].lon),
            }))
            setGeocodeResult(data[0].display_name)
          }
        }
      } catch {
        // Silencieux
      } finally {
        setIsGeocoding(false)
      }
    }, 1000)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city, form.country, form.region, form.department])

  function set(field: keyof AdminRaceFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof AdminRaceFormData, string>> = {}
    if (!form.name.trim()) e.name = 'Requis'
    if (!form.date) e.date = 'Requis'
    if (!form.city.trim()) e.city = 'Requis'
    if (!form.category) e.category = 'Requis'
    if (form.website_url && !form.website_url.match(/^https?:\/\//)) e.website_url = 'Doit commencer par http(s)://'
    if (form.finishers_url && !form.finishers_url.match(/^https?:\/\//)) e.finishers_url = 'Doit commencer par http(s)://'
    setErrors(e)

    const errorKeys = Object.keys(e)
    if (errorKeys.length > 0) {
      // Scroll to first error field
      const firstErrorField = formRef.current?.querySelector(`[data-field="${errorKeys[0]}"]`)
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setSubmitError(`${errorKeys.length} champ${errorKeys.length > 1 ? 's' : ''} requis manquant${errorKeys.length > 1 ? 's' : ''}`)
      return false
    }

    setSubmitError(null)
    return true
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    await onSubmit(form)
  }

  async function handleGeocode() {
    if (!form.city.trim()) return
    setGeocoding(true)
    setGeocodeResult(null)
    try {
      const raw: Record<string, string> = {
        city:    form.city.trim(),
        country: form.country || 'France',
        format:  'json',
        limit:   '1',
      }
      if (form.region)     raw.state  = form.region.trim()
      if (form.department) raw.county = form.department.trim()
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams(raw)}`,
        { headers: { 'User-Agent': 'TriRace/1.0' } }
      )
      const data = await res.json()
      if (data?.[0]) {
        setForm((prev) => ({
          ...prev,
          latitude:  String(data[0].lat),
          longitude: String(data[0].lon),
        }))
        setGeocodeResult(data[0].display_name)
      } else {
        setGeocodeResult('Aucun résultat — vérifiez la ville et le pays.')
      }
    } catch {
      setGeocodeResult('Erreur de connexion à Nominatim.')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleGenerateDescription() {
    setGeneratingDesc(true)
    try {
      const res = await fetch('/api/admin/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const { description } = await res.json()
        if (description) set('description', description)
      }
    } catch {
      // ignore
    } finally {
      setGeneratingDesc(false)
    }
  }

  async function fetchMeteo() {
    if (!form.latitude || !form.longitude || !form.date) {
      setMeteoError('Renseignez la date et les coordonnées GPS d\'abord.')
      return
    }
    setMeteoLoading(true)
    setMeteoError(null)
    try {
      const base = `lat=${form.latitude}&lng=${form.longitude}&date=${form.date}`
      const fetches: Promise<Response>[] = [
        fetch(`/api/admin/weather?${base}`),
        ...(raceId ? [fetch(`/api/admin/water-temp/${raceId}?${base}`)] : []),
      ]
      const [weatherRes, waterRes] = await Promise.all(fetches)

      const errors: string[] = []

      const weatherData = await weatherRes.json()
      if (weatherRes.ok) {
        if (weatherData.avg_temp_high_celsius != null) set('avg_temp_high_celsius', String(weatherData.avg_temp_high_celsius))
        if (weatherData.avg_temp_low_celsius  != null) set('avg_temp_low_celsius',  String(weatherData.avg_temp_low_celsius))
        if (weatherData.avg_wind_kmh          != null) set('avg_wind_kmh',          String(weatherData.avg_wind_kmh))
      } else {
        errors.push(weatherData.error ?? 'Erreur météo.')
      }

      if (waterRes) {
        const waterData = await waterRes.json()
        if (waterRes.ok) {
          if (waterData.avg_water_temp_celsius != null) set('avg_water_temp_celsius', String(waterData.avg_water_temp_celsius))
        } else {
          errors.push(waterData.error ?? 'Erreur temp. eau.')
        }
      }

      if (errors.length > 0) setMeteoError(errors.join(' '))
    } catch {
      setMeteoError('Impossible de contacter l\'API.')
    } finally {
      setMeteoLoading(false)
    }
  }

  function scraped(field: string) {
    return scrapedFields.has(field)
  }

  const labelClass = 'block text-sm font-medium text-zinc-700 mb-1'
  const inputClass =
    'w-full px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-colors'
  const selectClass = inputClass

  function FieldLabel({ label, field, required }: { label: string; field: string; required?: boolean }) {
    return (
      <label className={labelClass}>
        {scraped(field) && (
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1.5 -translate-y-px" title="Pre-rempli par scraping" />
        )}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )
  }

  function ErrorMsg({ field }: { field: keyof AdminRaceFormData }) {
    return errors[field] ? <p className="text-xs text-red-500 mt-1">{errors[field]}</p> : null
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Section 1: Informations essentielles */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Informations essentielles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div data-field="name">
            <FieldLabel label="Nom" field="name" required />
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ironman Nice" />
            <ErrorMsg field="name" />
          </div>
          <div data-field="date">
            <FieldLabel label="Date" field="date" required />
            <input type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
            <ErrorMsg field="date" />
          </div>
          <div data-field="category">
            <FieldLabel label="Format" field="category" required />
            <select className={selectClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <ErrorMsg field="category" />
          </div>
          <div data-field="city">
            <FieldLabel label="Ville" field="city" required />
            <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Nice" />
            <ErrorMsg field="city" />
          </div>
          <div>
            <FieldLabel label="Pays" field="country" />
            <input className={inputClass} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="France" />
          </div>
          <div>
            <FieldLabel label="Discipline" field="discipline" />
            <input className={inputClass} value={form.discipline} onChange={(e) => set('discipline', e.target.value)} placeholder="triathlon" />
          </div>
        </div>
      </section>

      {/* Section 2: Distances */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Distances</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Natation (m)" field="swim_distance" />
            <input type="number" className={inputClass} value={form.swim_distance} onChange={(e) => set('swim_distance', e.target.value)} placeholder="1500" />
          </div>
          <div>
            <FieldLabel label="Velo (m)" field="bike_distance" />
            <input type="number" className={inputClass} value={form.bike_distance} onChange={(e) => set('bike_distance', e.target.value)} placeholder="40000" />
          </div>
          <div>
            <FieldLabel label="Course (m)" field="run_distance" />
            <input type="number" className={inputClass} value={form.run_distance} onChange={(e) => set('run_distance', e.target.value)} placeholder="10000" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Denivele total (m)" field="total_elevation" />
            <input type="number" className={inputClass} value={form.total_elevation} onChange={(e) => set('total_elevation', e.target.value)} placeholder="850" />
          </div>
          <div>
            <FieldLabel label="D+ velo (m)" field="bike_elevation" />
            <input type="number" className={inputClass} value={form.bike_elevation} onChange={(e) => set('bike_elevation', e.target.value)} placeholder="600" />
          </div>
          <div>
            <FieldLabel label="D+ course (m)" field="run_elevation" />
            <input type="number" className={inputClass} value={form.run_elevation} onChange={(e) => set('run_elevation', e.target.value)} placeholder="250" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Barriere natation (min)" field="swim_cutoff_minutes" />
            <input type="number" className={inputClass} value={form.swim_cutoff_minutes} onChange={(e) => set('swim_cutoff_minutes', e.target.value)} placeholder="70" />
            <p className="text-xs text-zinc-400 mt-1">ex: 70 = 1h10</p>
          </div>
          <div>
            <FieldLabel label="Barriere velo (min)" field="bike_cutoff_minutes" />
            <input type="number" className={inputClass} value={form.bike_cutoff_minutes} onChange={(e) => set('bike_cutoff_minutes', e.target.value)} placeholder="330" />
            <p className="text-xs text-zinc-400 mt-1">ex: 330 = 5h30</p>
          </div>
          <div>
            <FieldLabel label="Barriere course (min)" field="run_cutoff_minutes" />
            <input type="number" className={inputClass} value={form.run_cutoff_minutes} onChange={(e) => set('run_cutoff_minutes', e.target.value)} placeholder="510" />
            <p className="text-xs text-zinc-400 mt-1">ex: 510 = 8h30</p>
          </div>
          <div>
            <FieldLabel label="Boucles course (nb)" field="run_laps" />
            <input type="number" min="1" className={inputClass} value={form.run_laps} onChange={(e) => set('run_laps', e.target.value)} placeholder="ex: 3" />
            <p className="text-xs text-zinc-400 mt-1">Nombre de boucles du parcours run</p>
          </div>
        </div>
      </section>

      {/* Section 3: Infos pratiques */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Infos pratiques</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <FieldLabel label="Prix (EUR)" field="price_euros" />
            <input type="number" className={inputClass} value={form.price_euros} onChange={(e) => set('price_euros', e.target.value)} placeholder="120" />
          </div>
          <div>
            <FieldLabel label="Participants max" field="max_participants" />
            <input type="number" className={inputClass} value={form.max_participants} onChange={(e) => set('max_participants', e.target.value)} placeholder="2500" />
          </div>
          <div>
            <FieldLabel label="Barriere horaire (h)" field="time_limit_hours" />
            <input type="number" step="0.5" className={inputClass} value={form.time_limit_hours} onChange={(e) => set('time_limit_hours', e.target.value)} placeholder="16" />
          </div>
          <div>
            <FieldLabel label="Finishers (derniere ed.)" field="finishers_count" />
            <input type="number" className={inputClass} value={form.finishers_count} onChange={(e) => set('finishers_count', e.target.value)} placeholder="1200" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div data-field="website_url">
            <FieldLabel label="Site web" field="website_url" />
            <input type="text" className={inputClass} value={form.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="https://..." />
            <ErrorMsg field="website_url" />
          </div>
          <div data-field="finishers_url">
            <FieldLabel label="URL resultats" field="finishers_url" />
            <input type="text" className={inputClass} value={form.finishers_url} onChange={(e) => set('finishers_url', e.target.value)} placeholder="https://..." />
            <ErrorMsg field="finishers_url" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
              Statut inscription
            </label>
            <select
              value={form.registration_status}
              onChange={(e) => set('registration_status', e.target.value)}
              className={inputClass}
            >
              <option value="">Inconnu</option>
              <option value="open">Ouvert</option>
              <option value="sold_out">Sold Out</option>
              <option value="closed">Ferme</option>
            </select>
          </div>
        </div>
      </section>

      {/* Section 4: Localisation */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Localisation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Region" field="region" />
            <input className={inputClass} value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="Provence-Alpes-Cote d'Azur" />
          </div>
          <div>
            <FieldLabel label="Departement" field="department" />
            <input className={inputClass} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Alpes-Maritimes" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className={labelClass}>
              {geocoding || isGeocoding ? (
                <span className="inline-flex items-center gap-1">
                  Latitude
                  <span className="ml-1 text-xs text-blue-500 animate-pulse">Geocodage...</span>
                </span>
              ) : (
                'Latitude'
              )}
            </label>
            <input type="number" step="any" className={inputClass} value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="43.7102" />
          </div>
          <div>
            <label className={labelClass}>
              {geocoding || isGeocoding ? (
                <span className="inline-flex items-center gap-1">
                  Longitude
                  <span className="ml-1 text-xs text-blue-500 animate-pulse">Geocodage...</span>
                </span>
              ) : (
                'Longitude'
              )}
            </label>
            <input type="number" step="any" className={inputClass} value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="7.2620" />
          </div>
          <div>
            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocoding || isGeocoding || !form.city.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              {geocoding || isGeocoding ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              Geocoder
            </button>
          </div>
        </div>
        {geocodeResult && (
          <p className="text-xs text-zinc-500 truncate">
            <span className="font-medium text-zinc-700">Résultat :</span> {geocodeResult}
          </p>
        )}
      </section>

      {/* Section 5: Contenu */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Contenu</h3>
        <div>
          <FieldLabel label="Tagline" field="tagline" />
          <input className={inputClass} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Le triathlon le plus mythique de la Cote d'Azur" />
          <p className="text-xs text-zinc-400 mt-1">Citation courte affichee en italique sur la page course</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-zinc-700">Description</label>
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={generatingDesc || !form.name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-colors"
              title={!form.name ? 'Remplissez le nom de la course d\'abord' : 'Générer une description SEO avec IA'}
            >
              {generatingDesc
                ? <Loader2 size={13} className="animate-spin" />
                : <Sparkles size={13} />
              }
              {generatingDesc ? 'Génération…' : 'Générer avec IA'}
            </button>
          </div>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Decrivez la course..."
          />
          <p className="text-xs text-zinc-400 mt-1">Le bouton IA génère ~150 mots en français, optimisés SEO.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Image URL" field="image_url" />
            <input type="text" className={inputClass} value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />
            {form.image_url && (
              <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>
          <div>
            <FieldLabel label="Gradient fallback" field="image_gradient" />
            <select className={selectClass} value={form.image_gradient} onChange={(e) => set('image_gradient', e.target.value)}>
              <option value="">Aucun (gris par defaut)</option>
              <option value="bg-gradient-to-br from-cyan-500 to-blue-600">Bleu ocean</option>
              <option value="bg-gradient-to-br from-red-500 to-orange-500">Rouge orange</option>
              <option value="bg-gradient-to-br from-emerald-500 to-teal-600">Vert nature</option>
              <option value="bg-gradient-to-br from-amber-400 to-orange-500">Ambre soleil</option>
              <option value="bg-gradient-to-br from-purple-500 to-indigo-600">Violet nuit</option>
              <option value="bg-gradient-to-br from-rose-400 to-red-600">Rose intense</option>
            </select>
            <p className="text-xs text-zinc-400 mt-1">Hero de la page si pas d&apos;image</p>
            {form.image_gradient && (
              <div className={`mt-2 h-16 rounded-xl ${form.image_gradient}`} />
            )}
          </div>
        </div>
        <div>
          <FieldLabel label="Tags" field="tags" />
          <input className={inputClass} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="ironman, nice, cote-azur, qualification" />
          <p className="text-xs text-zinc-400 mt-1">Separes par des virgules</p>
        </div>
      </section>

      {/* Section 6: Meteo */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Météo typique</h3>
          <button
            type="button"
            onClick={fetchMeteo}
            disabled={meteoLoading || !form.latitude || !form.longitude || !form.date}
            title="Moyenne historique 3 ans via Open-Meteo (air + mer)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-colors"
          >
            {meteoLoading
              ? <Loader2 size={12} className="animate-spin" />
              : <Sparkles size={12} />
            }
            {meteoLoading ? 'Chargement…' : 'Récupérer la météo'}
          </button>
        </div>
        {meteoError && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} />
            {meteoError}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Temp. max (°C)" field="avg_temp_high_celsius" />
            <input type="number" step="0.1" className={inputClass} value={form.avg_temp_high_celsius} onChange={(e) => set('avg_temp_high_celsius', e.target.value)} placeholder="28" />
            <FieldLabel label="Temp. min (°C)" field="avg_temp_low_celsius" />
            <input type="number" step="0.1" className={inputClass} value={form.avg_temp_low_celsius} onChange={(e) => set('avg_temp_low_celsius', e.target.value)} placeholder="18" />
          </div>
          <div>
            <FieldLabel label="Vent moyen (km/h)" field="avg_wind_kmh" />
            <input type="number" step="0.1" className={inputClass} value={form.avg_wind_kmh} onChange={(e) => set('avg_wind_kmh', e.target.value)} placeholder="15" />
            <FieldLabel label="Temp. eau (°C)" field="avg_water_temp_celsius" />
            <input type="number" step="0.1" className={inputClass} value={form.avg_water_temp_celsius} onChange={(e) => set('avg_water_temp_celsius', e.target.value)} placeholder="18" />
          </div>
        </div>
      </section>

      {/* Section 7: Records */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Records du parcours</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Record hommes" field="record_men" />
            <input className={inputClass} value={form.record_men} onChange={(e) => set('record_men', e.target.value)} placeholder="7h42:15" />
          </div>
          <div>
            <FieldLabel label="Record femmes" field="record_women" />
            <input className={inputClass} value={form.record_women} onChange={(e) => set('record_women', e.target.value)} placeholder="8h31:22" />
          </div>
        </div>
      </section>

      {/* Section 8: Complementaire */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Complementaire</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Type natation" field="swim_type" />
            <select className={selectClass} value={form.swim_type} onChange={(e) => set('swim_type', e.target.value)}>
              {SWIM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Profil vélo" field="bike_type" />
            <select className={selectClass} value={form.bike_type} onChange={(e) => set('bike_type', e.target.value)}>
              {TERRAIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Profil course à pied" field="run_type" />
            <select className={selectClass} value={form.run_type} onChange={(e) => set('run_type', e.target.value)}>
              {TERRAIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Label" field="label" />
            <input className={inputClass} value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Label FFTri, Ironman..." />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Organisateur" field="organizer_name" />
            <input className={inputClass} value={form.organizer_name} onChange={(e) => set('organizer_name', e.target.value)} placeholder="ASO, Ironman..." />
          </div>
          <div>
            <FieldLabel label="Date limite inscription" field="registration_deadline" />
            <input type="date" className={inputClass} value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Qualification pour" field="qualification_for" />
            <input className={inputClass} value={form.qualification_for} onChange={(e) => set('qualification_for', e.target.value)} placeholder="Ironman World Championship..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_wetsuit_allowed === 'true'}
              onChange={(e) => set('is_wetsuit_allowed', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
            />
            Combinaison autorisee
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_draft_legal === 'true'}
              onChange={(e) => set('is_draft_legal', e.target.checked ? 'true' : '')}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-400"
            />
            Drafting autorise
          </label>
        </div>
      </section>

      {/* Submit */}
      {submitError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {submitError}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          Creer la course
        </button>
      </div>
    </form>
  )
}
