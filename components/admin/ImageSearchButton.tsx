'use client'

import { useState } from 'react'
import { Image, Loader2, X, Check } from 'lucide-react'

interface ImageSearchButtonProps {
  raceId: number
  websiteUrl: string | null
  currentImageUrl: string | null
  onUpdated?: () => void
}

export default function ImageSearchButton({
  raceId,
  websiteUrl,
  currentImageUrl,
  onUpdated,
}: ImageSearchButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foundImageUrl, setFoundImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSearch() {
    if (!websiteUrl) return
    setLoading(true)
    setError(null)
    setFoundImageUrl(null)
    setSaved(false)

    try {
      const res = await fetch('/api/admin/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, race_id: raceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de l\'analyse.')
      } else if (data.image_url) {
        setFoundImageUrl(data.image_url)
      } else {
        setError('Aucune image trouvée sur ce site.')
      }
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUseImage() {
    if (!foundImageUrl) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: foundImageUrl }),
      })
      if (res.ok) {
        setSaved(true)
        setFoundImageUrl(null)
        onUpdated?.()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setFoundImageUrl(null)
    setError(null)
    setSaved(false)
  }

  const disabled = !websiteUrl || loading

  return (
    <>
      <button
        onClick={handleSearch}
        disabled={disabled}
        title={!websiteUrl ? 'Pas d\'URL de site' : 'Chercher une image sur le site'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Image size={13} />
        )}
        {loading ? 'Recherche...' : 'Chercher image'}
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {saved && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <Check size={12} /> Image mise à jour.
        </p>
      )}

      {/* Modal image preview */}
      {foundImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900">Image trouvée</h3>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {currentImageUrl ? (
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Actuelle</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImageUrl}
                    alt="Image actuelle"
                    className="w-full h-36 object-cover rounded-xl border border-gray-200"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Proposée</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foundImageUrl}
                    alt="Image proposée"
                    className="w-full h-36 object-cover rounded-xl border border-gray-200"
                  />
                </div>
              </div>
            ) : (
              <div className="mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foundImageUrl}
                  alt="Image trouvée"
                  className="w-full h-48 object-cover rounded-xl border border-gray-200"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleUseImage}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Sauvegarde...' : 'Utiliser cette image'}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
