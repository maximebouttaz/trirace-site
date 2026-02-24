'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, MapPin } from 'lucide-react'
import GeocodeButton from '@/components/admin/GeocodeButton'
import type { MapboxMapHandle } from './MapboxMap'

const MapboxMap = dynamic(() => import('./MapboxMap'), { ssr: false })

interface RaceWithoutGPS {
  id: number
  name: string
  city: string
  country: string
  slug: string
}

interface RaceWithGPS {
  id: number
  slug: string
  name: string
  latitude: number
  longitude: number
}

interface AdminMapClientProps {
  racesWithoutGPS: RaceWithoutGPS[]
  racesWithGPS: RaceWithGPS[]
}

export default function AdminMapClient({ racesWithoutGPS, racesWithGPS }: AdminMapClientProps) {
  const [search, setSearch] = useState('')
  const [geocodedIds, setGeocodedIds] = useState<Set<number>>(new Set())
  const [selectedRace, setSelectedRace] = useState<{
    id: number
    name: string
    city?: string
    country?: string
    latitude?: number
    longitude?: number
  } | null>(null)

  const mapRef = useRef<MapboxMapHandle>(null)

  const filteredRaces = useMemo(() => {
    const q = search.toLowerCase()
    return racesWithoutGPS.filter(
      (r) =>
        !geocodedIds.has(r.id) &&
        (r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.country.toLowerCase().includes(q))
    )
  }, [racesWithoutGPS, search, geocodedIds])

  const handleGeocoded = useCallback((raceId: number) => {
    setGeocodedIds((prev) => new Set([...prev, raceId]))
  }, [])

  function handleRaceClick(race: RaceWithoutGPS) {
    setSelectedRace({ id: race.id, name: race.name, city: race.city, country: race.country })
  }

  function handlePositionSaved() {
    if (selectedRace) {
      handleGeocoded(selectedRace.id)
    }
    setSelectedRace(null)
  }

  const remainingCount = racesWithoutGPS.length - geocodedIds.size

  return (
    <div className="-mx-6 -my-6 md:-mx-10 md:-my-10 flex h-screen overflow-hidden">
      {/* Sidebar left */}
      <aside className="w-80 shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={16} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-zinc-900">
              {remainingCount} cours{remainingCount > 1 ? 'es' : 'e'} sans GPS
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Géocodez les courses pour les placer sur la carte.
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 shrink-0 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par nom, ville..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
            />
          </div>
        </div>

        {/* Race list */}
        <div className="flex-1 overflow-y-auto">
          {filteredRaces.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">
                {search ? 'Aucun résultat' : 'Toutes les courses sont géocodées !'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredRaces.map((race) => (
                <li
                  key={race.id}
                  onClick={() => handleRaceClick(race)}
                  className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${
                    selectedRace?.id === race.id
                      ? 'bg-violet-50 border-l-2 border-violet-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{race.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {race.city}, {race.country}
                    </p>
                  </div>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <GeocodeButton
                      raceId={race.id}
                      city={race.city}
                      country={race.country}
                      onGeocoded={() => handleGeocoded(race.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recently geocoded section */}
        {geocodedIds.size > 0 && (
          <div className="border-t border-gray-200">
            <div className="px-4 py-3 bg-green-50/50">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                Géocodées récemment ({geocodedIds.size})
              </p>
            </div>
            <ul className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {racesWithoutGPS
                .filter((r) => geocodedIds.has(r.id))
                .map((race) => (
                  <li
                    key={race.id}
                    className="px-4 py-2 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <p className="text-xs text-zinc-600 truncate">{race.name}</p>
                    <span className="ml-auto text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                      Nouveau
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Map right */}
      <div className="flex-1 relative">
        <MapboxMap
          ref={mapRef}
          racesWithGPS={racesWithGPS}
          selectedRace={selectedRace}
          onPositionSaved={handlePositionSaved}
        />
      </div>
    </div>
  )
}
