'use client'

import { useState, useRef, useEffect } from 'react'
import { Edit2, Loader2 } from 'lucide-react'

interface InlineEditFieldProps {
  raceId: number
  field: string
  value: string | number | null
  type?: 'text' | 'number' | 'url'
  placeholder?: string
  onSaved: (field: string, value: string) => void
  validate?: (value: string) => string | null
  className?: string
}

export default function InlineEditField({
  raceId,
  field,
  value,
  type = 'text',
  placeholder,
  onSaved,
  validate,
  className,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update draft when value prop changes (e.g. parent refreshed data)
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''))
  }, [value, editing])

  function startEdit() {
    setDraft(String(value ?? ''))
    setError(null)
    setEditing(true)
  }

  async function save() {
    const trimmed = draft.trim()
    // If unchanged, just close
    if (trimmed === String(value ?? '')) {
      setEditing(false)
      return
    }
    // Validate
    if (validate) {
      const err = validate(trimmed)
      if (err) {
        setError(err)
        return
      }
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: type === 'number' ? (trimmed ? parseFloat(trimmed) : null) : trimmed,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved(field, trimmed)
      setEditing(false)
      // Flash green
      setFlash(true)
      setTimeout(() => setFlash(false), 1000)
    } catch {
      setError('Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') {
      setDraft(String(value ?? ''))
      setError(null)
      setEditing(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setDraft(v)
    if (validate) {
      const err = validate(v)
      setError(err)
    }
  }

  if (editing) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            autoFocus
            type={type}
            value={draft}
            onChange={handleChange}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className={`w-full text-sm text-zinc-900 bg-gray-100 rounded-lg px-2 py-1 border focus:outline-none focus:ring-2 ${
              error
                ? 'border-red-300 focus:ring-red-300'
                : 'border-violet-300 focus:ring-violet-400'
            }`}
          />
          {saving && <Loader2 size={12} className="animate-spin text-violet-500 shrink-0" />}
        </div>
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-1.5 cursor-pointer transition-colors rounded px-1 -mx-1 ${flash ? 'bg-green-50' : ''} ${className ?? ''}`}
      onClick={startEdit}
    >
      <span className="text-sm text-zinc-700 flex-1 truncate">
        {value !== null && value !== undefined && String(value).trim() !== '' ? (
          String(value)
        ) : (
          <span className="text-zinc-300 italic">{placeholder || 'vide'}</span>
        )}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          startEdit()
        }}
        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-violet-500 transition-opacity shrink-0"
        title="Editer"
      >
        <Edit2 size={13} />
      </button>
    </div>
  )
}
