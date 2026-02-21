'use client'

import { useEffect, useState } from 'react'
import { User, Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

interface Profile {
  id: string
  full_name: string | null
  organization_name: string | null
  email: string | null
  role: 'organizer' | 'admin'
}

type ToastState = { type: 'success' | 'error'; message: string } | null

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/login'
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, organization_name, email, role')
        .eq('id', session.user.id)
        .single<Profile>()

      if (data) {
        setProfile(data)
        setFullName(data.full_name || '')
        setOrganizationName(data.organization_name || '')
      }
      setLoading(false)
    }

    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          organization_name: organizationName.trim() || null,
        })
        .eq('id', profile.id)

      if (error) throw error
      showToast('success', 'Profil mis à jour avec succès.')
    } catch (err) {
      console.error(err)
      showToast('error', 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-zinc-500 font-medium mb-1">Dashboard</p>
        <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">Paramètres</h1>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Profile form */}
      <div className="bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-zinc-900">Informations du profil</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Ces informations apparaîtront sur vos pages de courses.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Full name */}
          <div className="space-y-2">
            <label
              htmlFor="full_name"
              className="flex items-center gap-2 text-sm font-semibold text-zinc-600"
            >
              <User size={14} className="text-zinc-500" />
              Nom complet
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition-all"
            />
          </div>

          {/* Organization name */}
          <div className="space-y-2">
            <label
              htmlFor="organization_name"
              className="flex items-center gap-2 text-sm font-semibold text-zinc-600"
            >
              <Building2 size={14} className="text-zinc-500" />
              Nom de l&apos;organisation
            </label>
            <input
              id="organization_name"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Club Triathlon de Paris"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition-all"
            />
            <p className="text-xs text-zinc-400">
              Affiché en tant qu&apos;organisateur sur les pages de vos courses.
            </p>
          </div>

          {/* Email (read-only) */}
          {profile?.email && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                Adresse e-mail
              </label>
              <div className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-zinc-500 text-sm select-all cursor-default">
                {profile.email}
              </div>
              <p className="text-xs text-zinc-400">
                L&apos;e-mail ne peut pas être modifié ici.
              </p>
            </div>
          )}

          {/* Role (read-only) */}
          {profile?.role && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                Rôle
              </label>
              <div className="inline-flex items-center px-3 py-1.5 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold text-zinc-500 capitalize">
                {profile.role === 'admin' ? 'Administrateur' : 'Organisateur'}
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Enregistrement…
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
