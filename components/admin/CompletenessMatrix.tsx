'use client'

import { useMemo } from 'react'
import type { IncompleteRace } from '@/app/admin/incomplete/page'

const COMPLETENESS_FIELDS: {
  key: keyof IncompleteRace
  label: string
  shortLabel: string
}[] = [
  { key: 'name', label: 'Nom', shortLabel: 'Nom' },
  { key: 'city', label: 'Ville', shortLabel: 'Ville' },
  { key: 'date', label: 'Date', shortLabel: 'Date' },
  { key: 'category', label: 'Catégorie', shortLabel: 'Cat.' },
  { key: 'latitude', label: 'GPS', shortLabel: 'GPS' },
  { key: 'description', label: 'Description', shortLabel: 'Desc.' },
  { key: 'price_euros', label: 'Prix', shortLabel: 'Prix' },
  { key: 'swim_distance', label: 'Nat. dist.', shortLabel: 'Nat.' },
  { key: 'bike_distance', label: 'Vélo dist.', shortLabel: 'Vélo' },
  { key: 'run_distance', label: 'CAP dist.', shortLabel: 'CAP' },
  { key: 'image_url', label: 'Image', shortLabel: 'Img' },
  { key: 'website_url', label: 'Site web', shortLabel: 'Web' },
  { key: 'formats', label: 'Formats', shortLabel: 'Fmt' },
  { key: 'region', label: 'Région', shortLabel: 'Rég.' },
  { key: 'total_elevation', label: 'Dénivelé total', shortLabel: 'D+tot' },
  { key: 'bike_elevation', label: 'Dénivelé vélo', shortLabel: 'D+vélo' },
  { key: 'avg_water_temp_celsius', label: 'Temp. eau', shortLabel: 'T°eau' },
  { key: 'qualification_for', label: 'Qualification', shortLabel: 'Qualif' },
  { key: 'registration_deadline', label: 'Date inscr.', shortLabel: 'Inscr.' },
  { key: 'finishers_count', label: 'Nb finishers', shortLabel: 'Finish' },
  { key: 'time_limit_hours', label: 'Temps limite', shortLabel: 'TLim' },
  { key: 'max_participants', label: 'Max partic.', shortLabel: 'MaxP' },
  { key: 'swim_type', label: 'Type natation', shortLabel: 'Nage' },
  { key: 'record_men', label: 'Record H', shortLabel: 'Rec.H' },
  { key: 'record_women', label: 'Record F', shortLabel: 'Rec.F' },
]

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

interface CompletenessMatrixProps {
  races: IncompleteRace[]
  onColumnFilter?: (field: string) => void
}

export default function CompletenessMatrix({ races, onColumnFilter }: CompletenessMatrixProps) {
  // Sort columns by % missing (most missing first)
  const sortedFields = useMemo(() => {
    const withMissing = COMPLETENESS_FIELDS.map((f) => {
      const missingCount = races.filter((r) => !isFilled(r[f.key])).length
      return { ...f, missingCount }
    })
    return withMissing.sort((a, b) => b.missingCount - a.missingCount)
  }, [races])

  // Map field keys to missing_field API values
  const fieldToFilter: Record<string, string> = {
    image_url: 'image',
    latitude: 'gps',
    description: 'description',
    price_euros: 'price',
    swim_distance: 'distances',
    bike_distance: 'distances',
    run_distance: 'distances',
    region: 'region',
    website_url: 'website',
    total_elevation: 'elevation',
    bike_elevation: 'elevation',
    avg_water_temp_celsius: 'water_temp',
    qualification_for: 'qualification',
    registration_deadline: 'registration_deadline',
    finishers_count: 'finishers_count',
    time_limit_hours: 'time_limit',
    max_participants: 'max_participants',
    swim_type: 'swim_type',
    record_men: 'records',
    record_women: 'records',
  }

  function handleColumnClick(fieldKey: string) {
    const filterValue = fieldToFilter[fieldKey]
    if (filterValue && onColumnFilter) {
      onColumnFilter(filterValue)
    }
  }

  if (races.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-400 text-sm">
        Aucune course ne correspond aux filtres actifs.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              {/* Sticky first column: race name */}
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold text-zinc-600 border-b border-r border-gray-200 min-w-[140px] max-w-[140px]">
                Course
              </th>
              {sortedFields.map((f) => (
                <th
                  key={f.key}
                  onClick={() => handleColumnClick(f.key)}
                  title={`${f.label} — ${f.missingCount} manquant${f.missingCount > 1 ? 's' : ''} (cliquer pour filtrer)`}
                  className="bg-gray-50 border-b border-gray-200 px-1 py-2 cursor-pointer hover:bg-violet-50 transition-colors"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="block font-semibold text-zinc-500 whitespace-nowrap origin-center"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', lineHeight: 1.2 }}
                    >
                      {f.shortLabel}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {f.missingCount}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {races.map((race) => (
              <tr key={race.id} className="hover:bg-gray-50/50 transition-colors">
                {/* Sticky race name */}
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-gray-100 min-w-[140px] max-w-[140px]">
                  <p className="truncate font-medium text-zinc-900" title={race.name}>
                    {race.name}
                  </p>
                  <p className="truncate text-zinc-400 text-[10px]">
                    {race.city}
                  </p>
                </td>
                {sortedFields.map((f) => {
                  const filled = isFilled(race[f.key])
                  return (
                    <td key={f.key} className="px-1 py-1.5 text-center">
                      <div
                        className={`w-5 h-5 rounded mx-auto ${
                          filled ? 'bg-green-400' : 'bg-gray-200'
                        }`}
                        title={`${f.label}: ${filled ? 'Rempli' : 'Manquant'}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
