'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Image,
  MapPin,
  FileText,
  DollarSign,
  Ruler,
  Map,
  Globe,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Link2,
  Check,
  X,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  Mountain,
  Droplets,
  Trophy,
  Clock,
  Users,
  Timer,
  Waves,
  Medal,
  List,
  Grid3x3,
} from 'lucide-react'
import { formatDate, categoryLabel, categoryColor } from '@/lib/utils'
import type { IncompleteRace, CompletenessStats } from './page'
import GeocodeButton from '@/components/admin/GeocodeButton'
import BulkEnrichBar from '@/components/admin/BulkEnrichBar'
import CompletenessMatrix from '@/components/admin/CompletenessMatrix'
import ScrapePickerButton from '@/components/admin/ScrapePickerButton'
import InlineEditField from '@/components/admin/InlineEditField'

// ── Completeness helpers ──────────────────────────────────────────────────────

const COMPLETENESS_FIELDS = [
  'name', 'city', 'date', 'category', 'latitude', 'longitude',
  'description', 'price_euros', 'swim_distance', 'bike_distance',
  'run_distance', 'image_url', 'website_url', 'formats', 'region',
  // Premium fields
  'total_elevation', 'bike_elevation', 'avg_water_temp_celsius',
  'qualification_for', 'registration_deadline', 'finishers_count',
  'time_limit_hours', 'max_participants', 'swim_type', 'record_men', 'record_women',
] as const

function completenessScore(race: IncompleteRace): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => {
    const val = race[f as keyof IncompleteRace]
    if (val === null || val === undefined) return false
    if (typeof val === 'string' && val.trim() === '') return false
    if (Array.isArray(val) && val.length === 0) return false
    return true
  }).length
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100)
}

function getMissingFields(race: IncompleteRace): string[] {
  const missing: string[] = []
  if (!race.name) missing.push('Nom')
  if (!race.city) missing.push('Ville')
  if (!race.date) missing.push('Date')
  if (!race.category) missing.push('Catégorie')
  if (!race.latitude || !race.longitude) missing.push('GPS')
  if (!race.description) missing.push('Description')
  if (!race.price_euros) missing.push('Prix')
  if (!race.swim_distance) missing.push('Nat. distance')
  if (!race.bike_distance) missing.push('Vélo distance')
  if (!race.run_distance) missing.push('CAP distance')
  if (!race.image_url) missing.push('Image')
  if (!race.website_url) missing.push('Site web')
  if (!race.formats || race.formats.length === 0) missing.push('Formats')
  if (!race.region) missing.push('Région')
  if (!race.total_elevation) missing.push('Dénivelé total')
  if (!race.bike_elevation) missing.push('Dénivelé vélo')
  if (!race.avg_water_temp_celsius) missing.push('Temp. eau')
  if (!race.qualification_for) missing.push('Qualification')
  if (!race.registration_deadline) missing.push('Date inscr.')
  if (!race.finishers_count) missing.push('Nb finishers')
  if (!race.time_limit_hours) missing.push('Temps limite')
  if (!race.max_participants) missing.push('Max participants')
  if (!race.swim_type) missing.push('Type natation')
  if (!race.record_men) missing.push('Record hommes')
  if (!race.record_women) missing.push('Record femmes')
  return missing
}

function CompletenessBar({ score, missingFields }: { score: number; missingFields: string[] }) {
  const fillColor =
    score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const tooltip = missingFields.length > 0 ? `Manquants : ${missingFields.join(', ')}` : 'Complet'
  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <div className="w-16 bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${fillColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-500">{score}%</span>
    </div>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-zinc-400 text-xs">—</span>
  const styles: Record<string, string> = {
    milesrepublic: 'bg-violet-50 text-violet-700 border-violet-200',
    finishers: 'bg-orange-50 text-orange-700 border-orange-200',
    manual: 'bg-gray-100 text-zinc-600 border-gray-200',
  }
  const cls = styles[source] ?? 'bg-gray-100 text-zinc-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {source}
    </span>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  missing,
  total,
  iconClass,
  isActive,
  onClick,
}: {
  icon: React.ElementType
  label: string
  missing: number
  total?: number
  iconClass: string
  isActive?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-2xl border p-4 flex items-center gap-3 transition-all ${
        isActive
          ? 'bg-violet-50 border-violet-400 ring-2 ring-violet-300'
          : 'bg-white border-gray-200 hover:border-violet-300 hover:bg-violet-50/40'
      }`}
    >
      <div className={`p-2.5 rounded-xl shrink-0 ${iconClass}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-zinc-900">
          {missing}
          {total != null && (
            <span className="text-xs font-normal text-zinc-400 ml-1">/ {total}</span>
          )}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        {total != null && total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
            <div
              className={`h-1 rounded-full ${
                missing / total > 0.5 ? 'bg-red-400' : missing / total > 0.2 ? 'bg-amber-400' : 'bg-green-400'
              }`}
              style={{ width: `${Math.round((missing / total) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </button>
  )
}

// ── Missing field icons ───────────────────────────────────────────────────────

function MissingFieldIcons({ race }: { race: IncompleteRace }) {
  return (
    <div className="flex items-center gap-1.5">
      {!race.image_url && (
        <span title="Image manquante">
          <Image size={14} className="text-zinc-300" />
        </span>
      )}
      {(!race.latitude || !race.longitude) && (
        <span title="GPS manquant">
          <MapPin size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.description && (
        <span title="Description manquante">
          <FileText size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.price_euros && (
        <span title="Prix manquant">
          <DollarSign size={14} className="text-zinc-300" />
        </span>
      )}
      {(!race.swim_distance || !race.bike_distance || !race.run_distance) && (
        <span title="Distances manquantes">
          <Ruler size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.region && (
        <span title="Région manquante">
          <Map size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.website_url && (
        <span title="Site web manquant">
          <Globe size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.total_elevation && (
        <span title="Dénivelé manquant">
          <Mountain size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.avg_water_temp_celsius && (
        <span title="Temp. eau manquante">
          <Droplets size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.time_limit_hours && (
        <span title="Temps limite manquant">
          <Clock size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.swim_type && (
        <span title="Type natation manquant">
          <Waves size={14} className="text-zinc-300" />
        </span>
      )}
      {!race.record_men && (
        <span title="Records manquants">
          <Medal size={14} className="text-zinc-300" />
        </span>
      )}
    </div>
  )
}

// ── Add URL button ────────────────────────────────────────────────────────────

function AddUrlButton({
  raceId,
  currentUrl,
  onSaved,
  defaultOpen = false,
}: {
  raceId: number
  currentUrl: string | null
  onSaved: (url: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState(currentUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    const trimmed = draft.trim()
    if (!trimmed) return
    // Basic URL validation
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError(true)
      return
    }
    setError(false)
    setSaving(true)
    const res = await fetch(`/api/admin/races/${raceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website_url: trimmed }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(trimmed)
      setOpen(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') {
      setDraft(currentUrl ?? '')
      setError(false)
      setOpen(false)
    }
  }

  if (currentUrl && !open) {
    return (
      <a
        href={currentUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={currentUrl}
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors"
      >
        <Globe size={13} />
      </a>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => { setDraft(''); setOpen(true) }}
        title="Ajouter une URL"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-cyan-50 hover:text-cyan-600 transition-colors"
      >
        <Link2 size={13} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="url"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(false) }}
        onKeyDown={handleKeyDown}
        placeholder="https://..."
        disabled={saving}
        className={`w-44 text-xs rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-300'
            : 'border-violet-300 bg-white focus:ring-violet-400'
        }`}
      />
      <button
        onClick={save}
        disabled={saving}
        title="Valider"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 transition-colors"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => { setOpen(false); setError(false) }}
        title="Annuler"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Links button ──────────────────────────────────────────────────────────────

function LinksButton({
  websiteUrl,
  finishersUrl,
  syncSource,
  slug,
  asMenuItem,
  onClose,
}: {
  websiteUrl: string | null
  finishersUrl: string | null
  syncSource: string | null
  slug: string
  asMenuItem?: boolean
  onClose?: () => void
}) {
  const [open, setOpen] = useState(false)

  const isMilesRepublic = syncSource?.startsWith('milesrepublic:')

  const links: { label: string; url: string }[] = []

  if (websiteUrl) {
    links.push({
      label: isMilesRepublic ? 'MilesRepublic' : 'Site web',
      url: websiteUrl,
    })
  }

  if (finishersUrl) {
    links.push({
      label: 'Finishers',
      url: finishersUrl,
    })
  }

  links.push({
    label: 'Page TriRace',
    url: `/courses/${slug}`,
  })

  // When used as a menu item inside ActionsDropdown
  if (asMenuItem) {
    return (
      <>
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-600 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={13} className="text-zinc-400" />
            {link.label}
          </a>
        ))}
      </>
    )
  }

  if (links.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Voir les liens"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 hover:text-zinc-600 transition-colors"
      >
        <ExternalLink size={13} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden min-w-[200px]">
            <p className="px-3 py-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-gray-100">
              Liens disponibles
            </p>
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-zinc-600 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <span>{link.label}</span>
                <ExternalLink size={11} className="shrink-0 opacity-60" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Delete button ─────────────────────────────────────────────────────────────

function DeleteButton({ raceId, onDeleted }: { raceId: number; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/races/${raceId}/reject`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted()
    }
    setDeleting(false)
    setConfirm(false)
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-red-600 font-medium whitespace-nowrap">Supprimer ?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Confirmer la suppression"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setConfirm(false)}
          title="Annuler"
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Supprimer la course"
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
    >
      <Trash2 size={13} />
    </button>
  )
}

// ── Generic add-field button ──────────────────────────────────────────────────

function AddFieldButton({
  raceId,
  field,
  currentValue,
  type = 'text',
  placeholder,
  icon: Icon,
  iconClass,
  buttonTitle,
  inputWidth = 'w-32',
  onSaved,
  defaultOpen = false,
}: {
  raceId: number
  field: string
  currentValue: string | number | null
  type?: 'text' | 'number' | 'url'
  placeholder: string
  icon: React.ElementType
  iconClass: string
  buttonTitle: string
  inputWidth?: string
  onSaved: (value: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState(String(currentValue ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (type === 'url' && !trimmed.startsWith('http')) { setError(true); return }
    setError(false)
    setSaving(true)
    const saveValue = type === 'number' ? parseFloat(trimmed) : trimmed
    const res = await fetch(`/api/admin/races/${raceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: saveValue }),
    })
    setSaving(false)
    if (res.ok) { onSaved(trimmed); setOpen(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setDraft(String(currentValue ?? '')); setError(false); setOpen(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setDraft(String(currentValue ?? '')); setOpen(true) }}
        title={buttonTitle}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${iconClass}`}
      >
        <Icon size={13} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(false) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={saving}
        className={`${inputWidth} text-xs rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 ${
          error ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-violet-300 bg-white focus:ring-violet-400'
        }`}
      />
      <button
        onClick={save}
        disabled={saving}
        title="Valider"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => { setOpen(false); setError(false) }}
        title="Annuler"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Set distances button ───────────────────────────────────────────────────────

function SetDistancesButton({
  raceId,
  swim,
  bike,
  run,
  onSaved,
  defaultOpen = false,
}: {
  raceId: number
  swim: number | null
  bike: number | null
  run: number | null
  onSaved: () => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  // swim stored in meters, displayed in meters; bike/run in meters, displayed in km
  const [swimM, setSwimM] = useState(swim != null ? String(swim) : '')
  const [bikeKm, setBikeKm] = useState(bike != null ? String(bike / 1000) : '')
  const [runKm, setRunKm] = useState(run != null ? String(run / 1000) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const body: Record<string, number> = {}
    if (swimM) body.swim_distance = parseFloat(swimM)
    if (bikeKm) body.bike_distance = parseFloat(bikeKm) * 1000
    if (runKm) body.run_distance = parseFloat(runKm) * 1000
    if (Object.keys(body).length === 0) return
    setSaving(true)
    const res = await fetch(`/api/admin/races/${raceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) { onSaved(); setOpen(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ajouter les distances"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
      >
        <Ruler size={13} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="number"
        value={swimM}
        onChange={(e) => setSwimM(e.target.value)}
        placeholder="Nat. m"
        disabled={saving}
        title="Natation (mètres)"
        className="w-16 text-xs rounded-lg px-2 py-1.5 border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <input
        type="number"
        value={bikeKm}
        onChange={(e) => setBikeKm(e.target.value)}
        placeholder="Vélo km"
        disabled={saving}
        title="Vélo (km)"
        className="w-16 text-xs rounded-lg px-2 py-1.5 border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <input
        type="number"
        value={runKm}
        onChange={(e) => setRunKm(e.target.value)}
        placeholder="Cap km"
        disabled={saving}
        title="Course à pied (km)"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
        className="w-16 text-xs rounded-lg px-2 py-1.5 border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <button
        onClick={save}
        disabled={saving}
        title="Valider"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => setOpen(false)}
        title="Annuler"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Actions dropdown ─────────────────────────────────────────────────────────

type InlineEditor = 'url' | 'region' | 'distances' | 'price' | 'image' | 'description' | null

interface DropdownAction {
  key: InlineEditor
  label: string
  icon: React.ElementType
  iconClass: string
}

function ActionsDropdown({
  race,
  onSelect,
  onDelete,
}: {
  race: IncompleteRace
  onSelect: (editor: InlineEditor) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  const missingUrl = !race.website_url
  const missingRegion = !race.region
  const missingDistances = !race.swim_distance || !race.bike_distance || !race.run_distance
  const missingPrice = !race.price_euros
  const missingImage = !race.image_url
  const missingDescription = !race.description

  const completeActions: DropdownAction[] = []
  if (missingUrl) completeActions.push({ key: 'url', label: 'Ajouter URL', icon: Link2, iconClass: 'text-cyan-500' })
  if (missingRegion) completeActions.push({ key: 'region', label: 'Ajouter région', icon: Map, iconClass: 'text-orange-500' })
  if (missingDistances) completeActions.push({ key: 'distances', label: 'Ajouter distances', icon: Ruler, iconClass: 'text-amber-500' })
  if (missingPrice) completeActions.push({ key: 'price', label: 'Ajouter prix', icon: DollarSign, iconClass: 'text-green-500' })
  if (missingImage) completeActions.push({ key: 'image', label: 'Ajouter image', icon: Image, iconClass: 'text-pink-500' })
  if (missingDescription) completeActions.push({ key: 'description', label: 'Ajouter description', icon: FileText, iconClass: 'text-violet-500' })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Actions"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 hover:text-zinc-600 transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden min-w-[200px]">
            {/* Compléter section */}
            {completeActions.length > 0 && (
              <>
                <p className="px-3 py-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-gray-100">
                  Compléter
                </p>
                {completeActions.map(({ key, label, icon: Icon, iconClass }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setOpen(false)
                      onSelect(key)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-600 hover:bg-gray-50 transition-colors"
                  >
                    <Icon size={13} className={iconClass} />
                    {label}
                  </button>
                ))}
              </>
            )}

            {/* Autres section */}
            <p className="px-3 py-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-gray-100 border-t">
              Autres
            </p>
            <LinksButton
              websiteUrl={race.website_url}
              finishersUrl={race.finishers_url}
              syncSource={race.sync_source}
              slug={race.slug}
              asMenuItem
              onClose={() => setOpen(false)}
            />
            <button
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Race row component ───────────────────────────────────────────────────────

function RaceRow({
  race,
  selected,
  onToggleSelect,
  onFieldSaved,
  onDeleted,
}: {
  race: IncompleteRace
  selected: boolean
  onToggleSelect: () => void
  onFieldSaved: (field: string, value: string) => void
  onDeleted: () => void
}) {
  const [activeInline, setActiveInline] = useState<InlineEditor>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const score = completenessScore(race)
  const missingGps = !race.latitude || !race.longitude
  const hasAnySource = !!race.finishers_url || !!race.sync_source?.startsWith('milesrepublic:') || !!race.website_url

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/races/${race.id}/reject`, { method: 'DELETE' })
    if (res.ok) onDeleted()
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <CompletenessBar score={score} missingFields={getMissingFields(race)} />
      </td>
      <td className="px-4 py-3 max-w-[180px]">
        <InlineEditField
          raceId={race.id}
          field="name"
          value={race.name}
          onSaved={(field, value) => onFieldSaved(field, value)}
        />
        <Link
          href={`/courses/${race.slug}`}
          target="_blank"
          className="text-xs text-zinc-400 hover:text-violet-500 transition-colors"
        >
          /{race.slug}
        </Link>
      </td>
      <td className="px-4 py-3 max-w-[120px]">
        <InlineEditField
          raceId={race.id}
          field="city"
          value={race.city}
          onSaved={(field, value) => onFieldSaved(field, value)}
        />
        <span className="text-xs text-zinc-400">{race.country}</span>
      </td>
      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
        {race.date ? formatDate(race.date) : '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(race.category)}`}
        >
          {categoryLabel(race.category)}
        </span>
      </td>
      <td className="px-4 py-3">
        <SourceBadge source={race.sync_source} />
      </td>
      <td className="px-4 py-3">
        <MissingFieldIcons race={race} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="rounded border-gray-300 text-violet-500 focus:ring-violet-400 cursor-pointer"
            title="Sélectionner pour enrichissement en masse"
          />
          {missingGps && (
            <GeocodeButton
              raceId={race.id}
              city={race.city}
              country={race.country}
              onGeocoded={() => onFieldSaved('__refresh__', '')}
            />
          )}
          {hasAnySource && (
            <ScrapePickerButton
              raceId={race.id}
              raceName={race.name}
              syncSource={race.sync_source}
              finishersUrl={race.finishers_url}
              websiteUrl={race.website_url}
              onScraped={() => onFieldSaved('__refresh__', '')}
            />
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">Supprimer ?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                title="Confirmer"
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                title="Annuler"
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-zinc-400 hover:bg-gray-200 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <ActionsDropdown
              race={race}
              onSelect={setActiveInline}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </div>

        {/* Inline editors triggered by dropdown */}
        {activeInline && (
          <div className="mt-2 flex items-center justify-end">
            {activeInline === 'url' && (
              <AddUrlButton
                raceId={race.id}
                currentUrl={race.website_url}
                defaultOpen
                onSaved={(url) => { onFieldSaved('website_url', url); setActiveInline(null) }}
              />
            )}
            {activeInline === 'region' && (
              <AddFieldButton
                raceId={race.id}
                field="region"
                currentValue={race.region}
                type="text"
                placeholder="Bretagne..."
                icon={Map}
                iconClass="bg-orange-50 text-orange-500 hover:bg-orange-100"
                buttonTitle="Ajouter une région"
                inputWidth="w-28"
                defaultOpen
                onSaved={(v) => { onFieldSaved('region', v); setActiveInline(null) }}
              />
            )}
            {activeInline === 'distances' && (
              <SetDistancesButton
                raceId={race.id}
                swim={race.swim_distance}
                bike={race.bike_distance}
                run={race.run_distance}
                defaultOpen
                onSaved={() => { onFieldSaved('__refresh__', ''); setActiveInline(null) }}
              />
            )}
            {activeInline === 'price' && (
              <AddFieldButton
                raceId={race.id}
                field="price_euros"
                currentValue={race.price_euros}
                type="number"
                placeholder="85"
                icon={DollarSign}
                iconClass="bg-green-50 text-green-600 hover:bg-green-100"
                buttonTitle="Ajouter un prix (€)"
                inputWidth="w-20"
                defaultOpen
                onSaved={(v) => { onFieldSaved('price_euros', v); setActiveInline(null) }}
              />
            )}
            {activeInline === 'image' && (
              <AddFieldButton
                raceId={race.id}
                field="image_url"
                currentValue={race.image_url}
                type="url"
                placeholder="https://..."
                icon={Image}
                iconClass="bg-pink-50 text-pink-500 hover:bg-pink-100"
                buttonTitle="Ajouter une image (URL)"
                inputWidth="w-44"
                defaultOpen
                onSaved={(v) => { onFieldSaved('image_url', v); setActiveInline(null) }}
              />
            )}
            {activeInline === 'description' && (
              <AddFieldButton
                raceId={race.id}
                field="description"
                currentValue={race.description}
                type="text"
                placeholder="Description de la course..."
                icon={FileText}
                iconClass="bg-violet-50 text-violet-500 hover:bg-violet-100"
                buttonTitle="Ajouter une description"
                inputWidth="w-52"
                defaultOpen
                onSaved={(v) => { onFieldSaved('description', v); setActiveInline(null) }}
              />
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────

const MISSING_FIELD_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'image', label: 'Image' },
  { value: 'gps', label: 'GPS' },
  { value: 'description', label: 'Description' },
  { value: 'price', label: 'Prix' },
  { value: 'distances', label: 'Distances' },
  { value: 'region', label: 'Région' },
  { value: 'elevation', label: 'Dénivelé' },
  { value: 'water_temp', label: 'Temp. eau' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'registration_deadline', label: 'Date inscription' },
  { value: 'finishers_count', label: 'Nb finishers' },
  { value: 'time_limit', label: 'Temps limite' },
  { value: 'max_participants', label: 'Max participants' },
  { value: 'swim_type', label: 'Type natation' },
  { value: 'records', label: 'Records' },
] as const

const MAX_SCORE_OPTIONS = [
  { value: 100, label: 'Tous' },
  { value: 80, label: '<80%' },
  { value: 50, label: '<50%' },
  { value: 25, label: '<25%' },
] as const

// ── Main component ────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'olympic', label: 'Olympique' },
  { value: 'half', label: 'Half/70.3' },
  { value: 'full', label: 'Ironman/XL' },
] as const

interface Props {
  initialRaces: IncompleteRace[]
  initialTotal: number
  initialTotalPages: number
  stats: CompletenessStats | null
  avgScore: number
  perfectCount: number
  totalPublished: number
}

export default function IncompleteRacesClient({
  initialRaces,
  initialTotal,
  initialTotalPages,
  stats,
  avgScore,
  perfectCount,
  totalPublished,
}: Props) {
  const [races, setRaces] = useState<IncompleteRace[]>(initialRaces)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [page, setPage] = useState(1)
  const [missingField, setMissingField] = useState<string>('')
  const [maxScore, setMaxScore] = useState<number>(100)
  const [category, setCategory] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table')

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchRaces = useCallback(
    async (nextPage: number, field: string, score: number, cat: string) => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(nextPage), limit: '24' })
      if (field) params.set('missing_field', field)
      if (score < 100) params.set('max_score', String(score))
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/admin/incomplete?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRaces(data.data)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(data.page)
      }
      setLoading(false)
    },
    []
  )

  function handleMissingFieldChange(field: string) {
    setMissingField(field)
    fetchRaces(1, field, maxScore, category)
  }

  function handleMaxScoreChange(score: number) {
    setMaxScore(score)
    fetchRaces(1, missingField, score, category)
  }

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    fetchRaces(1, missingField, maxScore, cat)
  }

  function handlePageChange(nextPage: number) {
    fetchRaces(nextPage, missingField, maxScore, category)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleFieldSaved(raceId: number, field: string, value: string) {
    setRaces((prev) =>
      prev.map((r) => (r.id === raceId ? { ...r, [field]: value } : r))
    )
  }

  async function handleExportCSV() {
    const res = await fetch('/api/admin/export-csv')
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'courses-incompletes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Global completeness bar */}
      <div className="mb-6 p-5 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-zinc-700">Complétude globale</span>
          <span className="text-2xl font-bold text-zinc-900">{avgScore}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-3 rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${avgScore}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          {perfectCount} / {totalPublished} courses complètes à 100%
        </p>
      </div>

      {/* ── Stats grid — Basic ── */}
      {stats && (
        <>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="flex-1 h-px bg-gray-200" />
            Champs de base
            <span className="flex-1 h-px bg-gray-200" />
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-3">
            <StatCard
              icon={Image}
              label="Sans image"
              missing={stats.by_field.image}
              total={stats.total_published}
              iconClass="bg-pink-50 text-pink-500"
              isActive={missingField === 'image'}
              onClick={() => handleMissingFieldChange(missingField === 'image' ? '' : 'image')}
            />
            <StatCard
              icon={MapPin}
              label="Sans GPS"
              missing={stats.by_field.gps}
              total={stats.total_published}
              iconClass="bg-blue-50 text-blue-500"
              isActive={missingField === 'gps'}
              onClick={() => handleMissingFieldChange(missingField === 'gps' ? '' : 'gps')}
            />
            <StatCard
              icon={FileText}
              label="Sans description"
              missing={stats.by_field.description}
              total={stats.total_published}
              iconClass="bg-violet-50 text-violet-500"
              isActive={missingField === 'description'}
              onClick={() => handleMissingFieldChange(missingField === 'description' ? '' : 'description')}
            />
            <StatCard
              icon={DollarSign}
              label="Sans prix"
              missing={stats.by_field.price}
              total={stats.total_published}
              iconClass="bg-green-50 text-green-600"
              isActive={missingField === 'price'}
              onClick={() => handleMissingFieldChange(missingField === 'price' ? '' : 'price')}
            />
            <StatCard
              icon={Ruler}
              label="Sans distances"
              missing={stats.by_field.distances}
              total={stats.total_published}
              iconClass="bg-amber-50 text-amber-600"
              isActive={missingField === 'distances'}
              onClick={() => handleMissingFieldChange(missingField === 'distances' ? '' : 'distances')}
            />
            <StatCard
              icon={Map}
              label="Sans région"
              missing={stats.by_field.region}
              total={stats.total_published}
              iconClass="bg-orange-50 text-orange-500"
              isActive={missingField === 'region'}
              onClick={() => handleMissingFieldChange(missingField === 'region' ? '' : 'region')}
            />
            <StatCard
              icon={Globe}
              label="Sans site web"
              missing={stats.by_field.website}
              total={stats.total_published}
              iconClass="bg-cyan-50 text-cyan-600"
              isActive={missingField === 'website'}
              onClick={() => handleMissingFieldChange(missingField === 'website' ? '' : 'website')}
            />
          </div>

          {/* ── Stats grid — Premium (RaceCard) — collapsible ── */}
          <button
            onClick={() => setPremiumOpen(v => !v)}
            className="w-full flex items-center gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 hover:text-zinc-600 transition-colors"
          >
            <span className="flex-1 h-px bg-gray-200" />
            Champs premium (RaceCard)
            <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${premiumOpen ? 'rotate-180' : ''}`} />
            <span className="flex-1 h-px bg-gray-200" />
          </button>

          {premiumOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3 mb-6">
              <StatCard
                icon={Mountain}
                label="Sans dénivelé"
                missing={stats.by_field.elevation}
                total={stats.total_published}
                iconClass="bg-emerald-50 text-emerald-600"
                isActive={missingField === 'elevation'}
                onClick={() => handleMissingFieldChange(missingField === 'elevation' ? '' : 'elevation')}
              />
              <StatCard
                icon={Droplets}
                label="Sans temp. eau"
                missing={stats.by_field.water_temp}
                total={stats.total_published}
                iconClass="bg-cyan-50 text-cyan-600"
                isActive={missingField === 'water_temp'}
                onClick={() => handleMissingFieldChange(missingField === 'water_temp' ? '' : 'water_temp')}
              />
              <StatCard
                icon={Trophy}
                label="Sans qualification"
                missing={stats.by_field.qualification}
                total={stats.total_published}
                iconClass="bg-amber-50 text-amber-600"
                isActive={missingField === 'qualification'}
                onClick={() => handleMissingFieldChange(missingField === 'qualification' ? '' : 'qualification')}
              />
              <StatCard
                icon={Timer}
                label="Sans date inscr."
                missing={stats.by_field.registration_deadline}
                total={stats.total_published}
                iconClass="bg-red-50 text-red-500"
                isActive={missingField === 'registration_deadline'}
                onClick={() => handleMissingFieldChange(missingField === 'registration_deadline' ? '' : 'registration_deadline')}
              />
              <StatCard
                icon={Users}
                label="Sans nb finishers"
                missing={stats.by_field.finishers_count}
                total={stats.total_published}
                iconClass="bg-indigo-50 text-indigo-500"
                isActive={missingField === 'finishers_count'}
                onClick={() => handleMissingFieldChange(missingField === 'finishers_count' ? '' : 'finishers_count')}
              />
              <StatCard
                icon={Clock}
                label="Sans temps limite"
                missing={stats.by_field.time_limit}
                total={stats.total_published}
                iconClass="bg-purple-50 text-purple-500"
                isActive={missingField === 'time_limit'}
                onClick={() => handleMissingFieldChange(missingField === 'time_limit' ? '' : 'time_limit')}
              />
              <StatCard
                icon={Users}
                label="Sans max partic."
                missing={stats.by_field.max_participants}
                total={stats.total_published}
                iconClass="bg-teal-50 text-teal-500"
                isActive={missingField === 'max_participants'}
                onClick={() => handleMissingFieldChange(missingField === 'max_participants' ? '' : 'max_participants')}
              />
              <StatCard
                icon={Waves}
                label="Sans type nata."
                missing={stats.by_field.swim_type}
                total={stats.total_published}
                iconClass="bg-sky-50 text-sky-500"
                isActive={missingField === 'swim_type'}
                onClick={() => handleMissingFieldChange(missingField === 'swim_type' ? '' : 'swim_type')}
              />
              <StatCard
                icon={Medal}
                label="Sans records"
                missing={stats.by_field.records}
                total={stats.total_published}
                iconClass="bg-yellow-50 text-yellow-600"
                isActive={missingField === 'records'}
                onClick={() => handleMissingFieldChange(missingField === 'records' ? '' : 'records')}
              />
            </div>
          )}
        </>
      )}

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        {/* Missing field filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Champ manquant
          </span>
          <select
            value={missingField}
            onChange={(e) => handleMissingFieldChange(e.target.value)}
            className="text-xs font-medium bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {MISSING_FIELD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Catégorie
          </span>
          <div className="flex gap-1">
            {CATEGORY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleCategoryChange(o.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  category === o.value
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Max score filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Complétude max.
          </span>
          <div className="flex gap-1">
            {MAX_SCORE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleMaxScoreChange(o.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  maxScore === o.value
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-zinc-500 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {total} course{total > 1 ? 's' : ''} affichée{total > 1 ? 's' : ''}
          </span>

          {/* View mode toggle */}
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              title="Vue tableau"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-violet-600 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              title="Vue matrice"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-white text-violet-600 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Grid3x3 size={14} />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Table / Matrix ── */}
      {viewMode === 'matrix' ? (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <CompletenessMatrix
            races={races}
            onColumnFilter={(field) => handleMissingFieldChange(field)}
          />
        </div>
      ) : (
        <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Score</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Ville</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Catégorie</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Manquants</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {races.map((race) => (
                <RaceRow
                  key={race.id}
                  race={race}
                  selected={selected.has(race.id)}
                  onToggleSelect={() => toggleSelect(race.id)}
                  onFieldSaved={(field, value) => handleFieldSaved(race.id, field, value)}
                  onDeleted={() => {
                    setRaces((prev) => prev.filter((r) => r.id !== race.id))
                    setTotal((prev) => prev - 1)
                  }}
                />
              ))}
            </tbody>
          </table>

          {races.length === 0 && !loading && (
            <div className="py-12 text-center text-zinc-400 text-sm">
              Aucune course ne correspond aux filtres actifs.
            </div>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
            Précédent
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── Bulk enrich bar ── */}
      <BulkEnrichBar
        selectedIds={[...selected]}
        onDone={() => {
          setSelected(new Set())
          fetchRaces(page, missingField, maxScore, category)
        }}
        onClearSelection={() => setSelected(new Set())}
      />
    </>
  )
}
