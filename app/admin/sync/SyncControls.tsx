'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import type { SyncStatus, SyncStep } from '@/app/api/admin/sync/status/route'

function formatLastSync(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'il y a moins d\'une minute'
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffDays === 1) return `hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type TriggerState = 'idle' | 'triggering' | 'watching' | 'done_ok' | 'done_fail'
type SyncSource = 'milesrepublic' | 'finishers' | 'ironman' | 'all'

function StepDot({ step }: { step: SyncStep }) {
  if (step.status === 'completed' && step.conclusion === 'success')
    return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  if (step.status === 'completed' && step.conclusion === 'failure')
    return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
  if (step.status === 'in_progress')
    return <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
  return <span className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
}

const BUTTON_CONFIG: { source: SyncSource; label: string; className: string }[] = [
  {
    source: 'milesrepublic',
    label: 'Sync MilesRepublic',
    className: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200',
  },
  {
    source: 'finishers',
    label: 'Sync Finishers',
    className: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200',
  },
  {
    source: 'ironman',
    label: 'Sync Ironman',
    className: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
  },
  {
    source: 'all',
    label: 'Sync complet',
    className: 'bg-zinc-900 text-white hover:bg-zinc-800 border-zinc-700',
  },
]

export default function SyncControls() {
  const [states, setStates] = useState<Record<SyncSource, TriggerState>>({
    milesrepublic: 'idle',
    finishers: 'idle',
    ironman: 'idle',
    all: 'idle',
  })
  const [activeSource, setActiveSource] = useState<SyncSource | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function setSourceState(source: SyncSource, state: TriggerState) {
    setStates(prev => ({ ...prev, [source]: state }))
  }

  async function pollStatus(source: SyncSource) {
    const res = await fetch('/api/admin/sync/status', { cache: 'no-store' })
    if (!res.ok) return
    const data: SyncStatus = await res.json()
    setSyncStatus(data)

    if (data.status === 'completed') {
      stopPolling()
      setSourceState(source, data.conclusion === 'success' ? 'done_ok' : 'done_fail')
    }
  }

  function startPolling(source: SyncSource) {
    stopPolling()
    pollStatus(source)
    pollRef.current = setInterval(() => pollStatus(source), 5000)
  }

  // Au montage : vérifier si un run est déjà en cours
  useEffect(() => {
    fetch('/api/admin/sync/status', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: SyncStatus) => {
        if (data.status === 'in_progress' || data.status === 'queued') {
          setSyncStatus(data)
          const src: SyncSource = 'all'
          setActiveSource(src)
          setSourceState(src, 'watching')
          startPolling(src)
        }
      })
      .catch(() => {})
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSync(source: SyncSource) {
    const currentState = states[source]
    if (currentState === 'triggering' || currentState === 'watching') return

    // Reset all states before starting a new sync
    setStates({ milesrepublic: 'idle', finishers: 'idle', ironman: 'idle', all: 'idle' })
    setActiveSource(source)
    setSourceState(source, 'triggering')
    setErrorMsg(null)
    setSyncStatus(null)

    const res = await fetch('/api/admin/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
    const data = await res.json()

    if (res.ok && data.success) {
      setSourceState(source, 'watching')
      setTimeout(() => startPolling(source), 2000)
    } else {
      setSourceState(source, 'idle')
      setActiveSource(null)
      setErrorMsg(data.error ?? 'Erreur inconnue.')
    }
  }

  const progress = syncStatus?.progress ?? 0
  const currentStep = syncStatus?.current_step
  const steps = syncStatus?.steps ?? []
  const lastSuccessAt = syncStatus?.last_success_at ?? null

  const anyActive = activeSource !== null &&
    (states[activeSource] === 'triggering' || states[activeSource] === 'watching')
  const showProgressBar = activeSource !== null &&
    (states[activeSource] === 'watching' || states[activeSource] === 'done_ok' || states[activeSource] === 'done_fail')

  return (
    <div className="space-y-3">
      {/* Boutons */}
      <div className="flex items-center gap-3 flex-wrap">
        {BUTTON_CONFIG.map(({ source, label, className }) => {
          const state = states[source]
          const isActive = state === 'triggering' || state === 'watching'
          const isDisabled = anyActive && !isActive

          return (
            <button
              key={source}
              onClick={() => handleSync(source)}
              disabled={isActive || isDisabled}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60 transition-colors border ${className}`}
            >
              <RefreshCw size={15} className={isActive ? 'animate-spin' : ''} />
              {state === 'triggering' ? 'Déclenchement...' : label}
            </button>
          )
        })}
      </div>

      {/* Messages status */}
      <div className="flex items-center gap-3 flex-wrap">
        {activeSource && states[activeSource] === 'done_ok' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle size={15} />
            Sync terminé avec succès
          </span>
        )}
        {activeSource && states[activeSource] === 'done_fail' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium">
            <AlertCircle size={15} />
            Le sync a échoué —{' '}
            {syncStatus?.run_url ? (
              <a
                href={syncStatus.run_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-red-700"
              >
                voir le run GitHub Actions
              </a>
            ) : (
              'voir GitHub Actions'
            )}
          </span>
        )}
        {errorMsg && (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={15} />
            {errorMsg}
          </span>
        )}

        {/* Dernière sync réussie */}
        {lastSuccessAt && !anyActive && (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <Clock size={12} />
            Dernière sync : {formatLastSync(lastSuccessAt)}
          </span>
        )}
      </div>

      {/* Barre de progression */}
      {showProgressBar && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3 max-w-lg">
          {/* Label + % */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {activeSource && states[activeSource] === 'done_ok' ? 'Terminé' :
               activeSource && states[activeSource] === 'done_fail' ? 'Échec' :
               currentStep ?? 'En attente...'}
            </span>
            <span className="text-xs font-semibold text-zinc-700">{progress}%</span>
          </div>

          {/* Barre */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                activeSource && states[activeSource] === 'done_fail' ? 'bg-red-500' :
                activeSource && states[activeSource] === 'done_ok' ? 'bg-green-500' :
                'bg-violet-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Détail des étapes */}
          {steps.length > 0 && (
            <div>
              <button
                onClick={() => setShowSteps(v => !v)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showSteps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showSteps ? 'Masquer les étapes' : 'Voir les étapes'}
              </button>

              {showSteps && (
                <ul className="mt-2 space-y-1.5">
                  {steps.map((step) => (
                    <li key={step.name} className="flex items-center gap-2">
                      <StepDot step={step} />
                      <span className={`text-xs ${
                        step.status === 'in_progress' ? 'text-violet-700 font-medium' :
                        step.status === 'completed' && step.conclusion === 'failure' ? 'text-red-600' :
                        step.status === 'completed' ? 'text-zinc-500' :
                        'text-zinc-300'
                      }`}>
                        {step.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
