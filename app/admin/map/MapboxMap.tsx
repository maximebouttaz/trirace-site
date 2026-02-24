'use client'

import { useRef, useMemo, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import Map, { Source, Layer, NavigationControl, Marker, Popup } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface RaceWithGPS {
  id: number
  slug: string
  name: string
  latitude: number
  longitude: number
}

interface SelectedRace {
  id: number
  name: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
}

interface MapboxMapProps {
  racesWithGPS: RaceWithGPS[]
  selectedRace?: SelectedRace | null
  onPositionSaved?: () => void
}

export interface MapboxMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void
}

const MapboxMap = forwardRef<MapboxMapHandle, MapboxMapProps>(function MapboxMap(
  { racesWithGPS, selectedRace, onPositionSaved },
  ref
) {
  const mapRef = useRef<MapRef>(null)
  const [markerPos, setMarkerPos] = useState<{ lng: number; lat: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [popupInfo, setPopupInfo] = useState<{ name: string; lng: number; lat: number } | null>(null)

  useImperativeHandle(ref, () => ({
    flyTo: (lng: number, lat: number, zoom = 14) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 })
    },
  }))

  useEffect(() => {
    if (selectedRace?.latitude && selectedRace?.longitude) {
      setMarkerPos({ lng: selectedRace.longitude, lat: selectedRace.latitude })
    } else {
      setMarkerPos(null)
    }
  }, [selectedRace])

  const existingGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: racesWithGPS.map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id, name: r.name },
        geometry: {
          type: 'Point' as const,
          coordinates: [r.longitude, r.latitude],
        },
      })),
    }),
    [racesWithGPS]
  )

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const features = e.features
    if (features && features.length > 0) {
      const feature = features[0]
      const coords = (feature.geometry as GeoJSON.Point).coordinates
      setPopupInfo({
        name: feature.properties?.name ?? 'Course',
        lng: coords[0],
        lat: coords[1],
      })
    } else {
      setPopupInfo(null)
    }
  }, [])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full w-full bg-gray-100 flex items-center justify-center">
        <p className="text-zinc-400 text-sm text-center px-8">
          Ajoutez{' '}
          <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>{' '}
          dans <code className="bg-gray-200 px-1 rounded">.env.local</code>
        </p>
      </div>
    )
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 2.3,
        latitude: 46.5,
        zoom: 5,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={['existing-points']}
      onClick={handleMapClick}
    >
      <NavigationControl position="top-right" />

      {/* Existing GPS points — grey */}
      <Source id="existing" type="geojson" data={existingGeojson}>
        <Layer
          id="existing-points"
          type="circle"
          paint={{
            'circle-color': '#9ca3af',
            'circle-radius': 5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.7,
          }}
        />
      </Source>

      {/* Draggable marker for selected race */}
      {selectedRace && markerPos && (
        <Marker
          longitude={markerPos.lng}
          latitude={markerPos.lat}
          draggable
          onDragEnd={(e) => {
            setMarkerPos({ lng: e.lngLat.lng, lat: e.lngLat.lat })
          }}
        >
          <div className="w-6 h-6 bg-violet-500 rounded-full border-2 border-white shadow-lg cursor-grab" />
        </Marker>
      )}

      {/* Save position popup */}
      {selectedRace && markerPos && (
        <Popup
          longitude={markerPos.lng}
          latitude={markerPos.lat}
          offset={[0, -20] as [number, number]}
          closeOnClick={false}
          closeButton={false}
          anchor="bottom"
        >
          <div className="p-2 min-w-[180px]">
            <p className="text-sm font-semibold text-zinc-900 mb-1">{selectedRace.name}</p>
            <p className="text-xs text-zinc-500 mb-2">
              {markerPos.lat.toFixed(5)}, {markerPos.lng.toFixed(5)}
            </p>
            <button
              onClick={async () => {
                setSaving(true)
                const res = await fetch(`/api/admin/races/${selectedRace.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ latitude: markerPos.lat, longitude: markerPos.lng }),
                })
                setSaving(false)
                if (res.ok) onPositionSaved?.()
              }}
              disabled={saving}
              className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </Popup>
      )}

      {/* Click popup for existing points */}
      {popupInfo && !selectedRace && (
        <Popup
          longitude={popupInfo.lng}
          latitude={popupInfo.lat}
          offset={[0, -8] as [number, number]}
          closeOnClick
          onClose={() => setPopupInfo(null)}
          anchor="bottom"
        >
          <p className="text-sm font-medium text-zinc-900 px-1">{popupInfo.name}</p>
        </Popup>
      )}

    </Map>
  )
})

export default MapboxMap
